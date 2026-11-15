// Listas para descobrir jogos: do IGDB, dos trailers mais vistos no YouTube (GameTrailers, IGN) ou do Metacritic (estas
// guardadas no banco pelos scripts de sync; capa, screenshots etc. sempre do IGDB).

// Plataformas (IDs do IGDB). Switch é só o original: exclusivos do Switch 2 ficam de fora.
// metacritic: o caminho da plataforma no Metacritic (lá não tem Android)
export const PLATFORMS = [
  { id: "pc", label: "PC", igdb: 6, metacritic: "pc" },
  { id: "switch", label: "Switch", igdb: 130, metacritic: "nintendo-switch" },
  { id: "android", label: "Android", igdb: 34, metacritic: null },
] as const;
export type PlatformId = (typeof PLATFORMS)[number]["id"];
export const isPlatformId = (v: unknown): v is PlatformId => PLATFORMS.some((p) => p.id === v);
export const platformOf = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)!;
// Fontes (abas de cima) e as listas de cada uma. IGDB: listas montadas na hora. GameTrailers, IGN e Metacritic ("stored"):
// listas guardadas no banco pelos scripts de sync, cada uma com sublistas (geral, por ano, por gênero) em ?mc=
export const SOURCES = [
  { id: "igdb", label: "IGDB" },
  { id: "gametrailers", label: "GameTrailers" },
  { id: "ign", label: "IGN" },
  { id: "mc", label: "Metacritic" },
] as const;
export type SourceId = (typeof SOURCES)[number]["id"];
export const LISTS = [
  { id: "top", source: "igdb", label: "Melhores", short: "Melhores", hint: "Nota mais alta, agrupados por quando foram lançados", stored: false },
  { id: "hot", source: "igdb", label: "Em alta agora", short: "Em alta", hint: "Os mais visitados no IGDB nos últimos dias", stored: false },
  { id: "wanted", source: "igdb", label: "Mais desejados", short: "Desejados", hint: "Os que mais gente marcou como “quero jogar”", stored: false },
  { id: "new", source: "igdb", label: "Lançamentos recentes", short: "Lançamentos", hint: "Lançados nos últimos 90 dias, os mais avaliados primeiro", stored: false },
  { id: "soon", source: "igdb", label: "Em breve", short: "Em breve", hint: "Ainda não lançados, os mais aguardados primeiro", stored: false },
  { id: "gametrailers", source: "gametrailers", label: "GameTrailers", short: "GameTrailers", hint: "Trailers mais vistos no canal desde 2022, sem anúncios pagos", stored: true },
  { id: "ign", source: "ign", label: "IGN", short: "IGN", hint: "Trailers mais vistos no canal desde 2022, sem anúncios pagos", stored: true },
  { id: "mc", source: "mc", label: "Metacritic", short: "Metacritic", hint: "Listas do Metacritic (guardadas no app), com os dados do IGDB", stored: true },
] as const;
export type ListId = (typeof LISTS)[number]["id"];
export const isListId = (v: unknown): v is ListId => LISTS.some((l) => l.id === v);
export const listOf = (id: ListId) => LISTS.find((l) => l.id === id)!;
/** Listas que existem para a plataforma (o Metacritic não tem Android) */
export const listsFor = (p: PlatformId) => LISTS.filter((l) => l.id !== "mc" || platformOf(p).metacritic);
/** Fontes com alguma lista na plataforma */
export const sourcesFor = (p: PlatformId) => SOURCES.filter((s) => listsFor(p).some((l) => l.source === s.id));

// Grupos dos "Melhores" por data de lançamento, acumulando: cada um pega tudo até o seu limite (2 anos = os últimos 2 anos
// inteiros) e pula o que já apareceu acima. Quem ficou de fora pelo corte de 60 num grupo pode aparecer no seguinte.
// Jogo recente tem poucas avaliações no IGDB, então o mínimo de avaliações cresce com a janela.
export const PERIODS = [
  { id: "1m", label: "Último mês", hint: "Lançados nos últimos 30 dias, com pelo menos 3 avaliações", days: 30, minRatings: 3 },
  { id: "3m", label: "Último trimestre", hint: "Lançados nos últimos 3 meses, com pelo menos 3 avaliações, sem repetir os de cima", days: 91, minRatings: 3 },
  { id: "6m", label: "Últimos 6 meses", hint: "Lançados nos últimos 6 meses, com pelo menos 3 avaliações, sem repetir os de cima", days: 182, minRatings: 3 },
  { id: "1a", label: "Último ano", hint: "Lançados no último ano, com pelo menos 5 avaliações, sem repetir os de cima", days: 365, minRatings: 5 },
  { id: "2a", label: "Últimos 2 anos", hint: "Lançados nos últimos 2 anos, com pelo menos 10 avaliações, sem repetir os de cima", days: 730, minRatings: 10 },
  { id: "5a", label: "Últimos 5 anos", hint: "Lançados nos últimos 5 anos, com pelo menos 15 avaliações, sem repetir os de cima", days: 1826, minRatings: 15 },
  { id: "10a", label: "Últimos 10 anos", hint: "Lançados nos últimos 10 anos, com pelo menos 25 avaliações, sem repetir os de cima", days: 3652, minRatings: 25 },
  { id: "todos", label: "De todos os tempos", hint: "Com pelo menos 40 avaliações, sem repetir os de cima", days: null, minRatings: 40 },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

export type DiscoverGroup = { id: string; title: string | null; hint: string | null; games: DiscoverGame[] };

export type DiscoverGame = {
  igdbId: number;
  title: string;
  year: number | null;
  releaseDate: string | null;
  coverUrl: string | null;
  screenshots: string[];
  rating: number | null;
  ratingCount: number;
  genres: string[];
  /** Nota do Metacritic, nas listas de lá (ex.: "97" ou "9.6") */
  score?: string;
  /** Visualizações somadas dos trailers (listas do GameTrailers e da IGN) */
  views?: number;
};
