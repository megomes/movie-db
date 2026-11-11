// Listas para descobrir jogos de Switch, direto do IGDB (nada é guardado no banco)
export const LISTS = [
  { id: "top", label: "Melhores", short: "Melhores", hint: "Nota mais alta, agrupados por quando foram lançados" },
  { id: "hot", label: "Em alta agora", short: "Em alta", hint: "Os mais visitados no IGDB nos últimos dias" },
  { id: "wanted", label: "Mais desejados", short: "Desejados", hint: "Os que mais gente marcou como “quero jogar”" },
  { id: "new", label: "Lançamentos recentes", short: "Lançamentos", hint: "Lançados nos últimos 90 dias, os mais avaliados primeiro" },
  { id: "soon", label: "Em breve", short: "Em breve", hint: "Ainda não lançados, os mais aguardados primeiro" },
] as const;
export type ListId = (typeof LISTS)[number]["id"];
export const isListId = (v: unknown): v is ListId => LISTS.some((l) => l.id === v);

// Grupos dos "Melhores" por janela de lançamento, sem sobreposição: cada uma começa onde a anterior termina.
// Jogo recente tem poucas avaliações no IGDB, então o mínimo de avaliações cai junto com a janela.
export const PERIODS = [
  { id: "1m", label: "Último mês", hint: "Lançados nos últimos 30 dias, com pelo menos 3 avaliações", fromDays: 0, toDays: 30, minRatings: 3 },
  { id: "3m", label: "Último trimestre", hint: "Lançados entre 1 e 3 meses atrás, com pelo menos 3 avaliações", fromDays: 30, toDays: 91, minRatings: 3 },
  { id: "6m", label: "Últimos 6 meses", hint: "Lançados entre 3 e 6 meses atrás, com pelo menos 3 avaliações", fromDays: 91, toDays: 182, minRatings: 3 },
  { id: "1a", label: "Último ano", hint: "Lançados entre 6 meses e 1 ano atrás, com pelo menos 5 avaliações", fromDays: 182, toDays: 365, minRatings: 5 },
  { id: "2a", label: "Últimos 2 anos", hint: "Lançados entre 1 e 2 anos atrás, com pelo menos 10 avaliações", fromDays: 365, toDays: 730, minRatings: 10 },
  { id: "todos", label: "De todos os tempos", hint: "Com pelo menos 40 avaliações, sem repetir os de cima", fromDays: null, toDays: null, minRatings: 40 },
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
