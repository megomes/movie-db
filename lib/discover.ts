import "server-only";
import { unstable_cache } from "next/cache";
import { GAME_TYPES, igdb, img, PLATFORM } from "@/lib/sources/igdb";

import { type DiscoverGame, type ListId } from "@/lib/discover-lists";

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
};

// Só o Switch original: jogos exclusivos do Switch 2 ficam de fora (as "Switch 2 Edition" também saem no Switch)
const SWITCH = `(${PLATFORM.SWITCH})`;
const FIELDS = "fields name,first_release_date,cover.image_id,screenshots.image_id,total_rating,total_rating_count,genres.name";
const POPULARITY = { visits: 1, wantToPlay: 2 } as const;
const LIMIT = 100;

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

// Popularidade no IGDB é de todas as plataformas: pega os mais populares e fica com os de Switch, na mesma ordem
async function byPopularity(type: number) {
  const order = new Map<number, number>();
  for (let page = 0; page < 4 && order.size < 1500; page++) {
    const rows = await igdb<{ game_id: number }[]>("popularity_primitives", `fields game_id; where popularity_type = ${type}; sort value desc; limit 500; offset ${page * 500};`);
    for (const r of rows) if (!order.has(r.game_id)) order.set(r.game_id, order.size);
    if (rows.length < 500) break;
  }
  const ids = [...order.keys()];
  const out: Raw[] = [];
  for (let i = 0; i < ids.length && out.length < LIMIT * 2; i += 500) {
    out.push(...(await igdb<Raw[]>("games", `${FIELDS}; where id = (${ids.slice(i, i + 500).join(",")}) & platforms = ${SWITCH} & game_type = ${GAME_TYPES}; limit 500;`)));
  }
  return out.sort((a, b) => order.get(a.id)! - order.get(b.id)!).slice(0, LIMIT);
}

async function fetchList(id: ListId): Promise<DiscoverGame[]> {
  const now = Math.floor(Date.now() / 1000);
  const where = `platforms = ${SWITCH} & game_type = ${GAME_TYPES}`;
  let rows: Raw[];
  switch (id) {
    case "top":
      rows = await igdb<Raw[]>("games", `${FIELDS}; where ${where} & total_rating_count >= 40; sort total_rating desc; limit ${LIMIT};`);
      break;
    case "hot":
      rows = await byPopularity(POPULARITY.visits);
      break;
    case "wanted":
      rows = await byPopularity(POPULARITY.wantToPlay);
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
  }
  return rows.map(toGame);
}

// Atualiza a cada 12h: as listas mudam devagar e o IGDB limita a 4 req/s
export const getDiscoverList = unstable_cache(fetchList, ["discover-switch-v2"], { revalidate: 60 * 60 * 12 });
