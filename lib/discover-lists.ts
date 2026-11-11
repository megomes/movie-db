// Listas para descobrir jogos, direto do IGDB (nada é guardado no banco)

// Plataformas (IDs do IGDB). Switch é só o original: exclusivos do Switch 2 ficam de fora.
// "tag" é a tag do backlog que o jogo ganha quando entra por aqui.
export const PLATFORMS = [
  { id: "pc", label: "PC", igdb: 6, tag: "PC" },
  { id: "switch", label: "Switch", igdb: 130, tag: "Switch" },
  { id: "android", label: "Android", igdb: 34, tag: "Android" },
] as const;
export type PlatformId = (typeof PLATFORMS)[number]["id"];
export const isPlatformId = (v: unknown): v is PlatformId => PLATFORMS.some((p) => p.id === v);
export const platformOf = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)!;
export const LISTS = [
  { id: "top", label: "Melhores", short: "Melhores", hint: "Nota mais alta, agrupados por quando foram lançados" },
  { id: "hot", label: "Em alta agora", short: "Em alta", hint: "Os mais visitados no IGDB nos últimos dias" },
  { id: "wanted", label: "Mais desejados", short: "Desejados", hint: "Os que mais gente marcou como “quero jogar”" },
  { id: "new", label: "Lançamentos recentes", short: "Lançamentos", hint: "Lançados nos últimos 90 dias, os mais avaliados primeiro" },
  { id: "soon", label: "Em breve", short: "Em breve", hint: "Ainda não lançados, os mais aguardados primeiro" },
] as const;
export type ListId = (typeof LISTS)[number]["id"];
export const isListId = (v: unknown): v is ListId => LISTS.some((l) => l.id === v);

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
};
