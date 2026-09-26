import type { Candidate, Kind, NewItem, Ratings } from "@/lib/db/schema";
import { normalize, similarity } from "@/lib/sources/http";
import { getTmdbDetails, searchTmdb } from "@/lib/sources/tmdb";
import { getOmdbRatings } from "@/lib/sources/omdb";
import { getIgdbDetails, getSteamPrice, PLATFORM, searchIgdb } from "@/lib/sources/igdb";
import { getBookDetails, searchBooks } from "@/lib/sources/books";
import { analyzeCover, fallbackBookCover } from "@/lib/palette";

export type SearchHint = { author?: string | null; year?: number | null; myPlatforms?: string[] };

export async function searchCandidates(kind: Kind, query: string, hint: SearchHint = {}): Promise<Candidate[]> {
  switch (kind) {
    case "movie":
    case "series":
      return searchTmdb(kind, query, hint.year ?? undefined);
    case "game":
      return searchIgdb(query);
    case "book":
      return searchBooks(query, hint.author ?? undefined);
  }
}

// Média bayesiana: nota com poucos votos é puxada para uma média típica (evita um "5.0" de 2 leitores no topo)
const bayes = (value: number, votes: number, prior: number, weight: number) =>
  Math.round(((value * votes + prior * weight) / (votes + weight)) * 10) / 10;

// Nota 0-10 usada para ordenar e para dar peso na roleta
export function computeScore(kind: Kind, r: Ratings): number | null {
  switch (kind) {
    case "movie":
    case "series":
      if (r.imdb != null) return r.imdbVotes != null ? bayes(r.imdb, r.imdbVotes, 6.4, 2500) : r.imdb;
      return r.tmdb != null ? bayes(r.tmdb, 0, 6.4, 0) : null;
    case "game":
      if (r.igdb != null) return bayes(r.igdb / 10, r.igdbCount ?? 1, 7.0, 10);
      if (r.igdbCritic != null) return bayes(r.igdbCritic / 10, r.igdbCriticCount ?? 1, 7.0, 3);
      return null;
    case "book":
      return r.hardcover != null ? bayes(r.hardcover * 2, r.hardcoverCount ?? 1, 7.4, 25) : null;
  }
}

export async function enrich(kind: Kind, externalId: string, hint: SearchHint = {}): Promise<Partial<NewItem>> {
  let data: Partial<NewItem>;
  switch (kind) {
    case "movie":
    case "series": {
      data = await getTmdbDetails(kind, externalId);
      if (data.imdbId) {
        try {
          data.ratings = { ...data.ratings, ...(await getOmdbRatings(data.imdbId)) };
        } catch {
          // OMDb fora do ar não impede o cadastro
        }
      }
      break;
    }
    case "game": {
      data = await getIgdbDetails(externalId);
      if (data.steamAppId) {
        try {
          data.steamPrice = await getSteamPrice(data.steamAppId);
        } catch {
          data.steamPrice = null;
        }
      }
      break;
    }
    case "book": {
      const { altCover, ...book } = await getBookDetails(externalId, hint);
      data = book;
      const info = await analyzeCover(data.coverUrl);
      if (info) Object.assign(data, { coverColor: info.color, coverBlur: info.blur });
      else {
        // Capa do Google inválida ("imagem indisponível"): tenta Open Library e Hardcover
        const fb = await fallbackBookCover(data.isbn ?? null, altCover);
        Object.assign(data, fb ? { coverUrl: fb.url, coverColor: fb.info.color, coverBlur: fb.info.blur } : { coverUrl: null });
      }
      break;
    }
  }
  if (kind !== "book") {
    const info = await analyzeCover(data.coverUrl);
    if (info) Object.assign(data, { coverColor: info.color, coverBlur: info.blur });
  }
  data.score = computeScore(kind, data.ratings ?? {});
  data.enrichedAt = new Date();
  return data;
}

// Autor do Obsidian pode ser "A, B e C"; basta um sobrenome bater
function authorSimilarity(a: string, b: string) {
  const names = (s: string) => s.split(/,| e | and |&/).map((x) => x.trim()).filter(Boolean);
  let best = 0;
  for (const x of names(a)) for (const y of names(b)) best = Math.max(best, similarity(x, y), lastName(x) === lastName(y) ? 0.8 : 0);
  return best;
}
const lastName = (s: string) => normalize(s).split(" ").pop() ?? "";

type Scored = Candidate & { popularity?: number; platformIds?: number[]; original?: string };

// Escolhe o melhor candidato e diz se a escolha é confiável o bastante para dispensar revisão
export function pickMatch(kind: Kind, query: string, candidates: Scored[], hint: SearchHint = {}) {
  if (!candidates.length) return { best: null, confident: false };

  // "Sapiens - Uma Breve História" também casa com "Sapiens"
  const mainQuery = query.split(/\s+[-–:]\s+|:\s+/)[0];
  const titleSimOf = (c: Scored) =>
    Math.max(
      similarity(query, c.title),
      c.original ? similarity(query, c.original) : 0,
      mainQuery !== query ? similarity(mainQuery, c.title.split(/\s*[:–-]\s+/)[0]) : 0,
    );

  const scored = candidates.map((c, i) => {
    const titleSim = titleSimOf(c);
    let s = titleSim;
    // Resultados no topo da busca ganham um pequeno bônus
    s += (candidates.length - i) * 0.01;
    if (kind === "game") {
      const wants = hint.myPlatforms ?? [];
      const ids = c.platformIds ?? [];
      if (wants.includes("Switch") && (ids.includes(PLATFORM.SWITCH) || ids.includes(PLATFORM.SWITCH2))) s += 0.15;
      if (wants.includes("PC") && ids.includes(PLATFORM.PC)) s += 0.15;
      s += Math.min(0.1, (c.popularity ?? 0) / 2000);
    }
    const authorSim =
      kind === "book" && hint.author && c.subtitle ? authorSimilarity(hint.author, c.subtitle.replace(/^Livro · /, "")) : 0;
    s += authorSim * 0.3;
    return { c, s, titleSim, authorSim, first: i === 0 };
  });
  scored.sort((a, b) => b.s - a.s);
  const [top, second] = scored;
  const clearWinner = !second || top.s - second.s > 0.05 || second.titleSim < top.titleSim;
  let confident = top.titleSim >= 0.85 && (clearWinner || top.first);
  // Livros: várias edições com o mesmo título são esperadas; o que importa é título + autor
  if (kind === "book") confident = top.titleSim >= 0.8 && (!hint.author || top.authorSim >= 0.5);
  return { best: top.c, confident };
}
