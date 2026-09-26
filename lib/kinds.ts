import type { Availability, Item, Kind, Provider } from "@/lib/db/schema";

export const KINDS: Kind[] = ["movie", "series", "game", "book"];

export const KIND_META: Record<Kind, { label: string; plural: string; verb: string }> = {
  movie: { label: "Filme", plural: "Filmes", verb: "assistir" },
  series: { label: "Série", plural: "Séries", verb: "maratonar" },
  game: { label: "Jogo", plural: "Jogos", verb: "jogar" },
  book: { label: "Livro", plural: "Livros", verb: "ler" },
};

export type Tier = "mine" | "stream" | "rent" | "none" | "owned" | "shop" | "unknown";

export type Access = { tier: Tier; label: string; providers: Provider[] };

const streamable = (a: Availability) => [...(a.flatrate ?? []), ...(a.free ?? []), ...(a.ads ?? [])];

// Onde/como consumir o item no Brasil, do ponto de vista do usuário
export function accessFor(item: Pick<Item, "kind" | "availability" | "myPlatforms" | "gamePass" | "steamPrice">, myProviders: number[]): Access {
  if (item.kind === "movie" || item.kind === "series") {
    const a = item.availability ?? {};
    const stream = streamable(a);
    const mine = stream.filter((p) => myProviders.includes(p.id));
    if (mine.length) return { tier: "mine", label: `No seu ${mine[0].name}`, providers: mine };
    if (stream.length) return { tier: "stream", label: `Em ${stream[0].name}`, providers: stream };
    const paid = [...(a.rent ?? []), ...(a.buy ?? [])];
    if (paid.length) return { tier: "rent", label: a.rent?.length ? "Alugar ou comprar" : "Comprar", providers: paid };
    return { tier: "none", label: "Indisponível no BR", providers: [] };
  }
  if (item.kind === "game") {
    if (item.gamePass) return { tier: "stream", label: "Game Pass (nuvem)", providers: [] };
    const price = item.steamPrice;
    if (price?.isFree) return { tier: "mine", label: "Grátis na Steam", providers: [] };
    if (price?.formatted)
      return {
        tier: "shop",
        label: price.discountPercent ? `Steam ${price.formatted} (-${price.discountPercent}%)` : `Steam ${price.formatted}`,
        providers: [],
      };
    if (item.myPlatforms.includes("Switch")) return { tier: "shop", label: "eShop (Switch)", providers: [] };
    return { tier: "unknown", label: item.myPlatforms.join(" · ") || "Jogo", providers: [] };
  }
  return { tier: "shop", label: "Livro", providers: [] };
}

// Só o que já está liberado pra você ganha cor (verde); o resto fica neutro
export const TIER_COLOR: Record<Tier, string> = {
  mine: "var(--success)",
  stream: "var(--text-2)",
  rent: "var(--text-2)",
  shop: "var(--text-2)",
  none: "var(--text-3)",
  owned: "var(--success)",
  unknown: "var(--text-3)",
};

export function formatMinutes(min: number | null | undefined, kind: Kind) {
  if (!min) return null;
  if (kind === "book") return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 10) return `${h}h`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function scoreLabel(item: Pick<Item, "kind" | "ratings" | "score">) {
  const r = item.ratings ?? {};
  switch (item.kind) {
    case "movie":
    case "series":
      if (r.imdb != null) return { source: "IMDb", value: r.imdb.toFixed(1) };
      if (r.tmdb != null) return { source: "TMDB", value: r.tmdb.toFixed(1) };
      return null;
    case "game":
      if (r.igdb != null) return { source: "IGDB", value: String(r.igdb) };
      if (r.igdbCritic != null) return { source: "Crítica", value: String(r.igdbCritic) };
      return null;
    case "book":
      if (r.hardcover != null) return { source: "Hardcover", value: r.hardcover.toFixed(1) };
      return null;
  }
}

// Semente que muda uma vez por dia (destaques da home)
export const daySeed = () => Math.floor(Date.now() / 86_400_000) % 997;
// Horas pra consumir um item (estimativa grosseira: série ~8h/temporada, livro ~1,3 min/página)
export function hoursOf(i: { kind: string; minutes: number | null; seasons: number | null; pages: number | null }) {
  if (i.kind === "movie") return (i.minutes ?? 110) / 60;
  if (i.kind === "series") return (i.seasons ?? 1) * 8;
  if (i.kind === "game") return (i.minutes ?? 900) / 60;
  return ((i.pages ?? 300) * 1.3) / 60;
}

// Quantos "vistos" liberam as estatísticas
export const STATS_MIN = 5;

// Semente nova a cada visita (prateleiras que variam sempre)
export const visitSeed = () => Math.floor(Math.random() * 1e9);
