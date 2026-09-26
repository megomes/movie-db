import type { Candidate, NewItem, SteamPrice } from "@/lib/db/schema";
import { fetchJson, sleep } from "./http";

let token: { value: string; expiresAt: number } | null = null;

async function getToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const d = await fetchJson<{ access_token: string; expires_in: number }>(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" },
  );
  token = { value: d.access_token, expiresAt: Date.now() + d.expires_in * 1000 };
  return token.value;
}

// IGDB limita a 4 req/s
let last = 0;
async function igdb<T>(endpoint: string, body: string) {
  const wait = last + 260 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  return fetchJson<T>(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: { "Client-ID": process.env.IGDB_CLIENT_ID!, Authorization: `Bearer ${await getToken()}` },
    body,
  });
}

const img = (id: string | undefined, size: string) =>
  id ? `https://images.igdb.com/igdb/image/upload/t_${size}/${id}.jpg` : null;

export const PLATFORM = { PC: 6, SWITCH: 130, SWITCH2: 508 } as const;

// Só jogos principais, remakes, remasters, expansões standalone, ports
const GAME_TYPES = "(0,4,8,9,10,11)";

type SearchGame = {
  id: number;
  name: string;
  first_release_date?: number;
  cover?: { image_id: string };
  platforms?: { id: number; abbreviation?: string; name: string }[];
  total_rating_count?: number;
};

const year = (ts?: number) => (ts ? new Date(ts * 1000).getUTCFullYear() : null);

export async function searchIgdb(query: string): Promise<(Candidate & { popularity: number; platformIds: number[] })[]> {
  const q = query.replace(/"/g, "");
  const games = await igdb<(SearchGame & { platforms?: { id: number; abbreviation?: string; name: string }[] })[]>(
    "games",
    `search "${q}"; fields name,first_release_date,cover.image_id,platforms.id,platforms.abbreviation,platforms.name,total_rating_count; where game_type = ${GAME_TYPES}; limit 10;`,
  );
  return games.map((g) => ({
    externalId: String(g.id),
    title: g.name,
    year: year(g.first_release_date),
    cover: img(g.cover?.image_id, "cover_small"),
    subtitle: ["Jogo", (g.platforms ?? []).map((p) => p.abbreviation ?? p.name).slice(0, 4).join(", ")]
      .filter(Boolean)
      .join(" · "),
    popularity: g.total_rating_count ?? 0,
    platformIds: (g.platforms ?? []).map((p) => p.id),
  }));
}

type GameDetails = SearchGame & {
  summary?: string;
  genres?: { name: string }[];
  total_rating?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  involved_companies?: { developer: boolean; company: { name: string } }[];
  external_games?: { uid: string; external_game_source: number }[];
};

const SOURCE = { STEAM: 1, GAME_PASS_CLOUD: 54 };

export async function getIgdbDetails(id: number | string): Promise<Partial<NewItem>> {
  const [g] = await igdb<GameDetails[]>(
    "games",
    `fields name,first_release_date,summary,cover.image_id,artworks.image_id,screenshots.image_id,genres.name,platforms.abbreviation,platforms.name,total_rating,total_rating_count,aggregated_rating,aggregated_rating_count,involved_companies.developer,involved_companies.company.name,external_games.uid,external_games.external_game_source; where id = ${Number(id)};`,
  );
  if (!g) throw new Error(`Jogo IGDB ${id} não encontrado`);

  const [ttb] = await igdb<{ normally?: number; hastily?: number }[]>(
    "game_time_to_beats",
    `fields normally,hastily; where game_id = ${g.id};`,
  );
  const seconds = ttb?.normally ?? ttb?.hastily;

  const steamAppId = g.external_games?.find((e) => e.external_game_source === SOURCE.STEAM)?.uid ?? null;
  const backdrop = g.artworks?.[0]?.image_id ?? g.screenshots?.[0]?.image_id;

  return {
    kind: "game",
    igdbId: g.id,
    title: g.name,
    year: year(g.first_release_date),
    coverUrl: img(g.cover?.image_id, "cover_big_2x"),
    backdropUrl: img(backdrop, "1080p"),
    overview: g.summary ?? null,
    genres: (g.genres ?? []).map((x) => x.name),
    creators: (g.involved_companies ?? []).filter((c) => c.developer).map((c) => c.company.name).slice(0, 2),
    platforms: (g.platforms ?? []).map((p) => p.abbreviation ?? p.name),
    gamePass: !!g.external_games?.some((e) => e.external_game_source === SOURCE.GAME_PASS_CLOUD),
    steamAppId,
    minutes: seconds ? Math.round(seconds / 60) : null,
    ratings: {
      igdb: g.total_rating ? Math.round(g.total_rating) : null,
      igdbCount: g.total_rating_count ?? null,
      igdbCritic: g.aggregated_rating ? Math.round(g.aggregated_rating) : null,
      igdbCriticCount: g.aggregated_rating_count ?? null,
    },
  };
}

export async function getSteamPrice(appId: string): Promise<SteamPrice | null> {
  type R = Record<string, { success: boolean; data?: { is_free?: boolean; price_overview?: { initial: number; final: number; discount_percent: number; final_formatted: string } } }>;
  const d = await fetchJson<R>(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=br&l=portuguese&filters=basic,price_overview`);
  const entry = d[appId];
  if (!entry?.success || !entry.data) return null;
  const p = entry.data.price_overview;
  return {
    appId,
    isFree: !!entry.data.is_free,
    initial: p ? p.initial / 100 : null,
    final: p ? p.final / 100 : null,
    discountPercent: p?.discount_percent ?? 0,
    formatted: p?.final_formatted ?? null,
  };
}
