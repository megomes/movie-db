import "server-only";
import type { Kind } from "@/lib/db";
import { searchCandidates } from "@/lib/enrich";
import { searchTmdbMulti } from "@/lib/sources/tmdb";

const KINDS = new Set<string>(["movie", "series", "game", "book"]);

export type SearchResult = Awaited<ReturnType<typeof searchAll>>[number];

// Busca nas APIs externas; "any" junta filmes/séries, jogos e livros
export async function searchAll(kind: string, query: string) {
  const q = query.trim();
  if (!q) return [];
  if (kind === "any") {
    const [av, games, books] = await Promise.allSettled([searchTmdbMulti(q), searchCandidates("game", q), searchCandidates("book", q)]);
    const ok = <T,>(r: PromiseSettledResult<T[]>) => (r.status === "fulfilled" ? r.value : []);
    return [
      ...ok(av),
      ...ok(games).slice(0, 6).map((c) => ({ ...c, kind: "game" as const })),
      ...ok(books).slice(0, 6).map((c) => ({ ...c, kind: "book" as const })),
    ]
      .filter((r) => r.title) // Google Books/IGDB às vezes devolvem resultado sem título
      .map(({ externalId, title, year, cover, subtitle, kind }) => ({ externalId, title, year, cover, subtitle, kind }));
  }
  if (!KINDS.has(kind)) throw new Error("Tipo inválido");
  const k = kind as Kind;
  const results = await searchCandidates(k, q);
  return results.filter((r) => r.title).map(({ externalId, title, year, cover, subtitle }) => ({ externalId, title, year, cover, subtitle, kind: k }));
}
