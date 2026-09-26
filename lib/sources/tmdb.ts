import type { Availability, Candidate, NewItem, Provider } from "@/lib/db/schema";
import { fetchJson } from "./http";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

type TmdbKind = "movie" | "series";
const path = (k: TmdbKind) => (k === "movie" ? "movie" : "tv");

function tmdb<T>(p: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(BASE + p);
  url.searchParams.set("language", "pt-BR");
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  return fetchJson<T>(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}` },
  });
}

export const tmdbImage = (p: string | null | undefined, size = "w500") => (p ? `${IMG}/${size}${p}` : null);

type SearchResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  popularity?: number;
};

const yearOf = (d?: string) => (d ? Number(d.slice(0, 4)) || null : null);

function toCandidate(r: SearchResult, kind: TmdbKind): Candidate {
  const title = r.title ?? r.name ?? "";
  const original = r.original_title ?? r.original_name ?? null;
  return {
    externalId: String(r.id),
    title,
    year: yearOf(r.release_date ?? r.first_air_date),
    cover: tmdbImage(r.poster_path, "w185"),
    subtitle: [kind === "movie" ? "Filme" : "Série", original && original !== title ? original : null]
      .filter(Boolean)
      .join(" · "),
  };
}

export async function searchTmdb(kind: TmdbKind, query: string, year?: number) {
  const data = await tmdb<{ results: SearchResult[] }>(`/search/${path(kind)}`, {
    query,
    ...(year ? (kind === "movie" ? { year } : { first_air_date_year: year }) : {}),
  });
  return data.results.slice(0, 8).map((r) => ({ ...toCandidate(r, kind), original: r.original_title ?? r.original_name }));
}

export async function searchTmdbMulti(query: string) {
  const data = await tmdb<{ results: SearchResult[] }>("/search/multi", { query });
  return data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 10)
    .map((r) => ({ kind: (r.media_type === "movie" ? "movie" : "series") as TmdbKind, ...toCandidate(r, r.media_type === "movie" ? "movie" : "series") }));
}

export async function findByImdbId(imdbId: string) {
  const data = await tmdb<{ movie_results: SearchResult[]; tv_results: SearchResult[] }>(`/find/${imdbId}`, {
    external_source: "imdb_id",
  });
  if (data.movie_results[0]) return { kind: "movie" as const, id: data.movie_results[0].id };
  if (data.tv_results[0]) return { kind: "series" as const, id: data.tv_results[0].id };
  return null;
}

type RawProvider = { provider_id: number; provider_name: string; logo_path: string | null; display_priority: number };
type ProvidersBlock = { link?: string } & Partial<Record<"flatrate" | "free" | "ads" | "rent" | "buy", RawProvider[]>>;

const mapProviders = (list?: RawProvider[]): Provider[] | undefined =>
  list
    ?.sort((a, b) => a.display_priority - b.display_priority)
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logo: tmdbImage(p.logo_path, "w92") }));

export function toAvailability(br?: ProvidersBlock): Availability {
  if (!br) return {};
  return {
    link: br.link ?? null,
    flatrate: mapProviders(br.flatrate),
    free: mapProviders(br.free),
    ads: mapProviders(br.ads),
    rent: mapProviders(br.rent),
    buy: mapProviders(br.buy),
  };
}

type Details = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  genres?: { name: string }[];
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  imdb_id?: string | null;
  vote_average?: number;
  created_by?: { name: string }[];
  credits?: { crew?: { job: string; name: string }[] };
  external_ids?: { imdb_id?: string | null };
  "watch/providers"?: { results?: Record<string, ProvidersBlock> };
};

export async function getTmdbDetails(kind: TmdbKind, id: number | string): Promise<Partial<NewItem>> {
  const d = await tmdb<Details>(`/${path(kind)}/${id}`, {
    append_to_response: "credits,external_ids,watch/providers",
  });
  // Sinopse em pt-BR às vezes vem vazia; cai para inglês
  let overview = d.overview || null;
  if (!overview) {
    const en = await fetchJson<{ overview?: string }>(`${BASE}/${path(kind)}/${id}?language=en-US`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}` },
    });
    overview = en.overview || null;
  }

  const epRuntime = d.episode_run_time?.[0] ?? (d.runtime || 45);
  const creators =
    kind === "movie"
      ? (d.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name)
      : (d.created_by ?? []).map((c) => c.name);

  return {
    kind,
    tmdbId: d.id,
    title: d.title ?? d.name ?? "",
    originalTitle: d.original_title ?? d.original_name ?? null,
    year: yearOf(d.release_date ?? d.first_air_date),
    coverUrl: tmdbImage(d.poster_path, "w500"),
    backdropUrl: tmdbImage(d.backdrop_path, "w1280"),
    overview,
    genres: (d.genres ?? []).map((g) => g.name),
    creators: creators.slice(0, 3),
    imdbId: d.imdb_id ?? d.external_ids?.imdb_id ?? null,
    runtimeMinutes: kind === "movie" ? d.runtime || null : epRuntime,
    seasons: d.number_of_seasons ?? null,
    episodes: d.number_of_episodes ?? null,
    minutes: kind === "movie" ? d.runtime || null : d.number_of_episodes ? d.number_of_episodes * epRuntime : null,
    availability: toAvailability(d["watch/providers"]?.results?.BR),
    ratings: { tmdb: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null },
  };
}

export async function getTmdbProviders(kind: TmdbKind, id: number) {
  const d = await tmdb<{ results?: Record<string, ProvidersBlock> }>(`/${path(kind)}/${id}/watch/providers`);
  return toAvailability(d.results?.BR);
}

export async function listBrProviders() {
  const [movie, tv] = await Promise.all([
    tmdb<{ results: RawProvider[] & { display_priorities?: Record<string, number> }[] }>("/watch/providers/movie", { watch_region: "BR" }),
    tmdb<{ results: RawProvider[] }>("/watch/providers/tv", { watch_region: "BR" }),
  ]);
  const map = new Map<number, Provider & { priority: number }>();
  for (const p of [...movie.results, ...tv.results] as (RawProvider & { display_priorities?: Record<string, number> })[]) {
    const priority = p.display_priorities?.BR ?? p.display_priority;
    const existing = map.get(p.provider_id);
    if (!existing || priority < existing.priority)
      map.set(p.provider_id, { id: p.provider_id, name: p.provider_name, logo: tmdbImage(p.logo_path, "w92"), priority });
  }
  return [...map.values()].sort((a, b) => a.priority - b.priority);
}
