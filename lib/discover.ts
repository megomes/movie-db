import "server-only";
import { unstable_cache } from "next/cache";
import { GAME_TYPES, igdb, img } from "@/lib/sources/igdb";
import { arrayContains, asc, desc, eq } from "drizzle-orm";
import { db, metacriticLists, trailerGames } from "@/lib/db";

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

// Jogos do IGDB por id (listas do Metacritic guardadas no banco): uma consulta a cada 500, na ordem pedida
async function fetchByIds(key: string): Promise<DiscoverGame[]> {
  const ids = key.split(",").map(Number).filter(Boolean);
  const out: Raw[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    out.push(...(await igdb<Raw[]>("games", `${FIELDS}; where id = (${ids.slice(i, i + 500).join(",")}); limit 500;`)));
  }
  return out.map(toGame);
}
const getByIds = unstable_cache(fetchByIds, ["discover-ids-v1"], { revalidate: 60 * 60 * 12 });

/** As listas do Metacritic guardadas para a plataforma (sem os jogos), na ordem de exibição */
export async function listMetacriticLists(platform: PlatformId) {
  const rows = await db
    .select({ id: metacriticLists.id, group: metacriticLists.group, label: metacriticLists.label, position: metacriticLists.position, url: metacriticLists.url })
    .from(metacriticLists)
    .where(eq(metacriticLists.platform, platform))
    .orderBy(asc(metacriticLists.position));
  return rows;
}
export type MetacriticListMeta = Awaited<ReturnType<typeof listMetacriticLists>>[number];

/** Uma lista do Metacritic: a ordem e a nota vêm do banco; capa, screenshots etc. do IGDB pelos ids */
export async function getMetacriticGroups(listId: string): Promise<DiscoverGroup[]> {
  const [row] = await db.select().from(metacriticLists).where(eq(metacriticLists.id, listId));
  if (!row) return [];
  const entries = row.entries.filter((e) => e.igdbId != null);
  const ids = [...new Set(entries.map((e) => e.igdbId!))];
  const byId = new Map((await getByIds(ids.join(","))).map((g) => [g.igdbId, g]));
  const seen = new Set<number>();
  const games: DiscoverGame[] = [];
  for (const e of entries) {
    const g = byId.get(e.igdbId!);
    if (!g || seen.has(g.igdbId)) continue;
    seen.add(g.igdbId);
    games.push({ ...g, score: e.score || undefined });
  }
  return [{ id: row.id, title: null, hint: null, games }];
}

// Trailers mais vistos (GameTrailers + IGN, guardados pelo sync) dos jogos que saem na plataforma
const TRAILER_LIMIT = 150;
export async function getTrailerGroups(platform: PlatformId): Promise<DiscoverGroup[]> {
  const rows = await db
    .select({ igdbId: trailerGames.igdbId, views: trailerGames.views })
    .from(trailerGames)
    .where(arrayContains(trailerGames.platforms, [platformOf(platform).igdb]))
    .orderBy(desc(trailerGames.views))
    .limit(TRAILER_LIMIT);
  const byId = new Map((await getByIds(rows.map((r) => r.igdbId).join(","))).map((g) => [g.igdbId, g]));
  const games = rows.flatMap((r) => {
    const g = byId.get(r.igdbId);
    return g ? [{ ...g, views: r.views }] : [];
  });
  return [{ id: "trailers", title: null, hint: null, games }];
}

// Atualiza a cada 12h: as listas mudam devagar e o IGDB limita a 4 req/s
export const getDiscoverList = unstable_cache(fetchList, ["discover-v5"], { revalidate: 60 * 60 * 12 });

// Lista pronta para a página: "Melhores" vem em grupos por data de lançamento, cada um sem repetir os de cima
export async function getDiscoverGroups(platform: PlatformId, id: ListId): Promise<DiscoverGroup[]> {
  if (id !== "top") return [{ id, title: null, hint: null, games: await getDiscoverList(platform, id) }];
  const lists = await Promise.all(PERIODS.map((p) => getDiscoverList(platform, "top", p.id)));
  const seen = new Set<number>();
  return PERIODS.map((p, i) => {
    const games = lists[i].filter((g) => !seen.has(g.igdbId)).slice(0, PER_GROUP);
    for (const g of games) seen.add(g.igdbId);
    return { id: p.id, title: p.label, hint: p.hint, games };
  }).filter((g) => g.games.length);
}
