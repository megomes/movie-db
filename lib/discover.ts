import "server-only";
import { unstable_cache } from "next/cache";
import { GAME_TYPES, igdb, img } from "@/lib/sources/igdb";
import { normalize } from "@/lib/sources/http";
import { getMetacriticList, type MetacriticRow } from "@/lib/sources/metacritic";

import { PERIODS, platformOf, type DiscoverGame, type DiscoverGroup, type ListId, type PeriodId, type PlatformId } from "@/lib/discover-lists";

export * from "@/lib/discover-lists";

type Raw = {
  id: number;
  name: string;
  first_release_date?: number;
  cover?: { image_id: string };
  screenshots?: { image_id: string }[];
  total_rating?: number;
  total_rating_count?: number;
  genres?: { name: string }[];
  platforms?: number[];
};

const FIELDS = "fields name,first_release_date,cover.image_id,screenshots.image_id,total_rating,total_rating_count,genres.name";
const POPULARITY = { visits: 1, wantToPlay: 2 } as const;
const LIMIT = 100;
// Cada grupo dos "Melhores" mostra no máximo isso; os cortados podem aparecer no grupo seguinte
const PER_GROUP = 60;

function toGame(g: Raw): DiscoverGame {
  const ts = g.first_release_date;
  return {
    igdbId: g.id,
    title: g.name,
    year: ts ? new Date(ts * 1000).getUTCFullYear() : null,
    releaseDate: ts ? new Date(ts * 1000).toISOString() : null,
    coverUrl: img(g.cover?.image_id, "cover_big_2x"),
    screenshots: (g.screenshots ?? []).slice(0, 8).map((s) => img(s.image_id, "screenshot_big")!),
    rating: g.total_rating ? Math.round(g.total_rating) : null,
    ratingCount: g.total_rating_count ?? 0,
    genres: (g.genres ?? []).map((x) => x.name),
  };
}

// Popularidade no IGDB é de todas as plataformas: pega os mais populares e fica com os da plataforma, na mesma ordem
async function byPopularity(platform: number, type: number) {
  const order = new Map<number, number>();
  for (let page = 0; page < 4 && order.size < 1500; page++) {
    const rows = await igdb<{ game_id: number }[]>("popularity_primitives", `fields game_id; where popularity_type = ${type}; sort value desc; limit 500; offset ${page * 500};`);
    for (const r of rows) if (!order.has(r.game_id)) order.set(r.game_id, order.size);
    if (rows.length < 500) break;
  }
  const ids = [...order.keys()];
  const out: Raw[] = [];
  for (let i = 0; i < ids.length && out.length < LIMIT * 2; i += 500) {
    out.push(...(await igdb<Raw[]>("games", `${FIELDS}; where id = (${ids.slice(i, i + 500).join(",")}) & platforms = (${platform}) & game_type = ${GAME_TYPES}; limit 500;`)));
  }
  return out.sort((a, b) => order.get(a.id)! - order.get(b.id)!).slice(0, LIMIT);
}

async function fetchList(platformId: PlatformId, id: ListId, period: PeriodId = "todos"): Promise<DiscoverGame[]> {
  const now = Math.floor(Date.now() / 1000);
  const platform = platformOf(platformId).igdb;
  const where = `platforms = (${platform}) & game_type = ${GAME_TYPES}`;
  let rows: Raw[];
  switch (id) {
    case "top": {
      // Busca o bastante para sobrar 60 novos depois de pular os grupos de cima (até 60 de cada um)
      const i = PERIODS.findIndex((x) => x.id === period);
      const p = PERIODS[i];
      const released = p.days == null ? "" : ` & first_release_date > ${now - p.days * 86400} & first_release_date <= ${now}`;
      const limit = Math.min(500, PER_GROUP * (i + 1));
      rows = await igdb<Raw[]>("games", `${FIELDS}; where ${where}${released} & total_rating_count >= ${p.minRatings}; sort total_rating desc; limit ${limit};`);
      break;
    }
    case "hot":
      rows = await byPopularity(platform, POPULARITY.visits);
      break;
    case "wanted":
      rows = await byPopularity(platform, POPULARITY.wantToPlay);
      break;
    case "new":
      rows = await igdb<Raw[]>(
        "games",
        `${FIELDS}; where ${where} & first_release_date > ${now - 90 * 86400} & first_release_date <= ${now}; sort total_rating_count desc; limit ${LIMIT};`,
      );
      break;
    case "soon":
      rows = await igdb<Raw[]>("games", `${FIELDS}; where ${where} & first_release_date > ${now}; sort hypes desc; limit ${LIMIT};`);
      break;
    default:
      // Listas do Metacritic têm o próprio caminho (getMetacritic)
      rows = [];
  }
  return rows.map(toGame);
}

// Nome do Metacritic -> jogo do IGDB. Primeiro por nome exato (sem diferenciar maiúsculas), 25 por consulta; quem
// não bater vai pela busca do IGDB. Com mais de um jogo do mesmo nome (remakes), fica o da plataforma e do ano certos.
export async function matchIgdb(rows: MetacriticRow[], platform: number): Promise<DiscoverGame[]> {
  const clean = (t: string) => t.replace(/\s*\(\d{4}\)$/, "").replace(/["\\]/g, "").trim();
  const fields = `${FIELDS},platforms`;
  const byName = new Map<string, Raw[]>();
  for (let i = 0; i < rows.length; i += 25) {
    const names = rows.slice(i, i + 25).map((r) => `name ~ "${clean(r.title)}"`);
    const found = await igdb<Raw[]>("games", `${fields}; where (${names.join(" | ")}) & game_type = (0,3,4,8,9,10,11); limit 500;`);
    for (const g of found) byName.set(normalize(g.name), [...(byName.get(normalize(g.name)) ?? []), g]);
  }
  const yearOf = (g: Raw) => (g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null);
  const pick = (list: Raw[], row: MetacriticRow) =>
    [...list].sort((a, b) => {
      const plat = Number(!!b.platforms?.includes(platform)) - Number(!!a.platforms?.includes(platform));
      if (plat) return plat;
      if (row.year != null) {
        const d = Math.abs((yearOf(a) ?? 0) - row.year) - Math.abs((yearOf(b) ?? 0) - row.year);
        if (d) return d;
      }
      return (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0);
    })[0];

  const out: DiscoverGame[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    let g = byName.get(normalize(clean(row.title))) ? pick(byName.get(normalize(clean(row.title)))!, row) : undefined;
    if (!g) {
      const hits = await igdb<Raw[]>("games", `search "${clean(row.title)}"; ${fields}; where platforms = (${platform}) & game_type = (0,3,4,8,9,10,11); limit 5;`);
      g = hits.find((h) => row.year == null || Math.abs((yearOf(h) ?? 0) - row.year) <= 1) ?? hits[0];
    }
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);
    out.push({ ...toGame(g), score: row.score || undefined });
  }
  return out;
}

const MC_YEARS = 5;
// Lista do Metacritic (uma página = 50 jogos) já com os dados do IGDB
async function fetchMetacritic(platformId: PlatformId, id: ListId, year?: number): Promise<DiscoverGame[]> {
  const p = platformOf(platformId);
  if (!p.metacritic) return [];
  const path =
    id === "mc-users" ? `${p.metacritic}/all/all-time/userscore` : id === "mc-year" ? `${p.metacritic}/all/${year}/metascore` : `${p.metacritic}/all/all-time/metascore`;
  const rows = await getMetacriticList(path, id === "mc-year" ? 1 : 2);
  return matchIgdb(rows, p.igdb);
}
// Uma vez por dia: as listas do Metacritic mudam devagar e assim quase não pedimos nada a eles
const getMetacritic = unstable_cache(fetchMetacritic, ["discover-mc-v1"], { revalidate: 60 * 60 * 24 });

// Atualiza a cada 12h: as listas mudam devagar e o IGDB limita a 4 req/s
export const getDiscoverList = unstable_cache(fetchList, ["discover-v5"], { revalidate: 60 * 60 * 12 });

// Lista pronta para a página: "Melhores" vem em grupos por data de lançamento, cada um sem repetir os de cima
export async function getDiscoverGroups(platform: PlatformId, id: ListId): Promise<DiscoverGroup[]> {
  if (id === "mc-year") {
    // Um grupo por ano, do atual para trás
    const now = new Date().getUTCFullYear();
    const years = Array.from({ length: MC_YEARS }, (_, i) => now - i);
    const lists = await Promise.all(years.map((y) => getMetacritic(platform, id, y)));
    return years
      .map((y, i) => ({ id: String(y), title: String(y), hint: i === 0 ? "Até agora, neste ano" : null, games: lists[i] }))
      .filter((g) => g.games.length);
  }
  if (id === "mc-top" || id === "mc-users") return [{ id, title: null, hint: null, games: await getMetacritic(platform, id) }];
  if (id !== "top") return [{ id, title: null, hint: null, games: await getDiscoverList(platform, id) }];
  const lists = await Promise.all(PERIODS.map((p) => getDiscoverList(platform, "top", p.id)));
  const seen = new Set<number>();
  return PERIODS.map((p, i) => {
    const games = lists[i].filter((g) => !seen.has(g.igdbId)).slice(0, PER_GROUP);
    for (const g of games) seen.add(g.igdbId);
    return { id: p.id, title: p.label, hint: p.hint, games };
  }).filter((g) => g.games.length);
}
