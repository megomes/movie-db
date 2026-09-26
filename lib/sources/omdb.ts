import type { Ratings } from "@/lib/db/schema";
import { fetchJson } from "./http";

type OmdbResponse = {
  Response: "True" | "False";
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Ratings?: { Source: string; Value: string }[];
};

const num = (s?: string) => {
  if (!s || s === "N/A") return null;
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export async function getOmdbRatings(imdbId: string): Promise<Ratings> {
  const d = await fetchJson<OmdbResponse>(
    `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${process.env.OMDB_API_KEY}`,
  );
  if (d.Response !== "True") return {};
  const rt = d.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value;
  return {
    imdb: num(d.imdbRating),
    imdbVotes: num(d.imdbVotes),
    rottenTomatoes: num(rt),
    metacritic: num(d.Metascore),
  };
}
