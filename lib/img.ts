// Reescreve URLs de capa/arte para o tamanho certo em cada CDN de origem.
// Guardamos no banco a URL "canônica" (grande) e escolhemos a variante na hora de exibir.

export type CoverSize = "sm" | "md" | "lg";
export type ArtSize = "md" | "lg";

const TMDB_POSTER: Record<CoverSize, string> = { sm: "w342", md: "w500", lg: "w780" };
const TMDB_ART: Record<ArtSize, string> = { md: "w780", lg: "w1280" };
const IGDB_COVER: Record<CoverSize, string> = { sm: "t_cover_big", md: "t_cover_big_2x", lg: "t_cover_big_2x" };
const IGDB_ART: Record<ArtSize, string> = { md: "t_screenshot_big", lg: "t_1080p" };
const GB_WIDTH: Record<CoverSize, number> = { sm: 320, md: 500, lg: 800 };
const OL_SIZE: Record<CoverSize, string> = { sm: "M", md: "L", lg: "L" };

function googleBooks(url: string, width: number) {
  const id = url.match(/[?&]id=([^&]+)/)?.[1] ?? url.match(/frontcover\/([^?]+)/)?.[1];
  return id ? `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&fife=w${width}` : url;
}

export function coverSrc(url: string | null | undefined, size: CoverSize = "sm") {
  if (!url) return null;
  if (url.includes("image.tmdb.org")) return url.replace(/\/t\/p\/[^/]+\//, `/t/p/${TMDB_POSTER[size]}/`);
  if (url.includes("images.igdb.com")) return url.replace(/\/t_[a-z0-9_]+\//, `/${IGDB_COVER[size]}/`);
  if (url.includes("books.google.")) return googleBooks(url, GB_WIDTH[size]);
  if (url.includes("covers.openlibrary.org")) return url.replace(/-[SML]\.jpg/, `-${OL_SIZE[size]}.jpg`);
  return url;
}

export function artSrc(url: string | null | undefined, size: ArtSize = "lg") {
  if (!url) return null;
  if (url.includes("image.tmdb.org")) return url.replace(/\/t\/p\/[^/]+\//, `/t/p/${TMDB_ART[size]}/`);
  if (url.includes("images.igdb.com")) return url.replace(/\/t_[a-z0-9_]+\//, `/${IGDB_ART[size]}/`);
  return url;
}
