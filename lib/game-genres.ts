// Gêneros das listas guardadas do Descobrir (Metacritic, GameTrailers, IGN): o jogo entra pelo gênero, tema ou
// palavra-chave do IGDB. Usado pelos scripts de sync.
export type Tax = { genres?: number[]; themes?: number[]; keywords?: number[] };
const has = (list: number[] | undefined, ids: number[]) => !!list?.some((x) => ids.includes(x));

export const GENRES: [slug: string, label: string, test: (t: Tax) => boolean][] = [
  ["rpg", "RPG", (t) => has(t.genres, [12])],
  ["roguelike", "Roguelike e roguelite", (t) => has(t.keywords, [416, 17292])],
  ["metroidvania", "Metroidvania", (t) => has(t.keywords, [477])],
  ["soulslike", "Soulslike", (t) => has(t.keywords, [17326, 58746])],
  ["acao", "Ação", (t) => has(t.themes, [1])],
  ["aventura", "Aventura", (t) => has(t.genres, [31])],
  ["plataforma", "Plataforma", (t) => has(t.genres, [8])],
  ["tiro", "Tiro", (t) => has(t.genres, [5])],
  ["hack-and-slash", "Hack and slash", (t) => has(t.genres, [25])],
  ["luta", "Luta", (t) => has(t.genres, [4])],
  ["corrida", "Corrida", (t) => has(t.genres, [10])],
  ["esporte", "Esporte", (t) => has(t.genres, [14])],
  ["estrategia", "Estratégia", (t) => has(t.genres, [15, 11, 16, 24])],
  ["taticos", "Táticos e por turnos", (t) => has(t.genres, [16, 24])],
  ["tempo-real", "Estratégia em tempo real", (t) => has(t.genres, [11])],
  ["construcao", "Construção de cidades", (t) => has(t.keywords, [3533])],
  ["simulacao", "Simulação", (t) => has(t.genres, [13])],
  ["puzzle", "Puzzle", (t) => has(t.genres, [9])],
  ["cartas", "Cartas e tabuleiro", (t) => has(t.genres, [35]) || has(t.keywords, [52703, 54521])],
  ["point-and-click", "Point-and-click", (t) => has(t.genres, [2])],
  ["visual-novel", "Visual novel", (t) => has(t.genres, [34])],
  ["musica", "Ritmo e música", (t) => has(t.genres, [7])],
  ["arcade", "Arcade", (t) => has(t.genres, [33])],
  ["indie", "Indie", (t) => has(t.genres, [32])],
  ["sobrevivencia", "Sobrevivência", (t) => has(t.themes, [21])],
  ["terror", "Terror", (t) => has(t.themes, [19])],
  ["mundo-aberto", "Mundo aberto", (t) => has(t.themes, [38])],
  ["sandbox", "Sandbox", (t) => has(t.themes, [33])],
  ["ficcao-cientifica", "Ficção científica", (t) => has(t.themes, [18])],
  ["fantasia", "Fantasia", (t) => has(t.themes, [17])],
  ["furtividade", "Furtividade", (t) => has(t.themes, [23])],
  ["misterio", "Mistério", (t) => has(t.themes, [43])],
  ["immersive-sim", "Immersive sim", (t) => has(t.keywords, [43194])],
  ["cozy", "Cozy", (t) => has(t.keywords, [24685])],
];
// Lista de gênero só existe com pelo menos MIN_GENRE jogos; mostra até MAX_GENRE
export const MIN_GENRE = 50;
export const MAX_GENRE = 100;
