// Listas para descobrir jogos de Switch, direto do IGDB (nada é guardado no banco)
export const LISTS = [
  { id: "top", label: "Melhores de todos os tempos", short: "Melhores", hint: "Nota mais alta, com pelo menos 40 avaliações" },
  { id: "hot", label: "Em alta agora", short: "Em alta", hint: "Os mais visitados no IGDB nos últimos dias" },
  { id: "wanted", label: "Mais desejados", short: "Desejados", hint: "Os que mais gente marcou como “quero jogar”" },
  { id: "new", label: "Lançamentos recentes", short: "Lançamentos", hint: "Lançados nos últimos 90 dias, os mais avaliados primeiro" },
  { id: "soon", label: "Em breve", short: "Em breve", hint: "Ainda não lançados, os mais aguardados primeiro" },
] as const;
export type ListId = (typeof LISTS)[number]["id"];
export const isListId = (v: unknown): v is ListId => LISTS.some((l) => l.id === v);

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
  /** Só roda no Switch 2 */
  switch2Only: boolean;
};
