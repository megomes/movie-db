import type { Kind } from "@/lib/db/schema";

// IGDB e Google Books devolvem gêneros em inglês; TMDB já vem em pt-BR.
const PT: Record<string, string> = {
  // IGDB
  adventure: "Aventura",
  "role-playing (rpg)": "RPG",
  shooter: "Tiro",
  platform: "Plataforma",
  puzzle: "Quebra-cabeça",
  racing: "Corrida",
  simulator: "Simulação",
  strategy: "Estratégia",
  "real time strategy (rts)": "Estratégia",
  "turn-based strategy (tbs)": "Estratégia",
  tactical: "Tático",
  indie: "Indie",
  arcade: "Arcade",
  fighting: "Luta",
  sport: "Esporte",
  "hack and slash/beat 'em up": "Ação",
  music: "Música",
  "card & board game": "Cartas e tabuleiro",
  "point-and-click": "Point-and-click",
  "visual novel": "Visual novel",
  "quiz/trivia": "Quiz",
  moba: "MOBA",
  pinball: "Pinball",
  // Google Books
  fiction: "Ficção",
  "juvenile fiction": "Infantojuvenil",
  "young adult fiction": "Infantojuvenil",
  "biography & autobiography": "Biografia",
  "self-help": "Autoajuda",
  religion: "Religião",
  science: "Ciência",
  "business & economics": "Negócios",
  computers: "Tecnologia",
  technology: "Tecnologia",
  "technology & engineering": "Tecnologia",
  psychology: "Psicologia",
  history: "História",
  philosophy: "Filosofia",
  "body, mind & spirit": "Espiritualidade",
  "health & fitness": "Saúde",
  "social science": "Ciências sociais",
  "political science": "Política",
  "true crime": "True crime",
  "literary criticism": "Crítica literária",
  "literary collections": "Literatura",
  "family & relationships": "Relacionamentos",
  education: "Educação",
  "language arts & disciplines": "Linguagem",
  "performing arts": "Artes",
  art: "Artes",
  travel: "Viagem",
  "sports & recreation": "Esporte",
  // Categorias do Obsidian
  "auto-ajuda": "Autoajuda",
  study: "Estudo",
  "não-ficção": "Não-ficção",
  "nao-ficcao": "Não-ficção",
};

// Subgêneros do Google que viram ruído ("Fiction / Classics")
const IGNORE = new Set(["general", "classics", "literary", "nonfiction", "non-fiction"]);

export function ptGenre(g: string) {
  const key = g.trim().toLowerCase();
  return PT[key] ?? g.trim();
}

// Gêneros para exibir: traduzidos, sem duplicatas, categoria do Obsidian primeiro
export function displayGenres(item: { kind: Kind; genres: string[]; category?: string | null }) {
  const raw = [item.category, ...item.genres].filter(Boolean) as string[];
  const out: string[] = [];
  for (const g of raw) {
    if (IGNORE.has(g.trim().toLowerCase())) continue;
    const pt = ptGenre(g);
    if (!out.some((x) => x.toLowerCase() === pt.toLowerCase())) out.push(pt);
  }
  return out;
}

// Gênero principal usado para agrupar na grade (livros: categoria do Obsidian quando existe)
export function facetGenres(item: { kind: Kind; genres: string[]; category?: string | null }) {
  const g = displayGenres(item);
  return item.kind === "book" ? g.slice(0, 2) : g.slice(0, 3);
}
