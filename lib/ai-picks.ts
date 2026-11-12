// Sugestões de jogos vindas de outras IAs: categorias normalizadas e a cor de cada IA

export const AI_CATEGORIES = [
  { id: "roguelike", label: "Roguelikes", emoji: "🎲" },
  { id: "acao", label: "Ação, soulslike e metroidvania", emoji: "⚔️" },
  { id: "rpg", label: "RPG", emoji: "🗡️" },
  { id: "scifi", label: "Ficção científica e narrativa", emoji: "🚀" },
  { id: "misterio", label: "Mistério, investigação e puzzle", emoji: "🔎" },
  { id: "automacao", label: "Automação, construção e gestão", emoji: "⚙️" },
  { id: "cartas", label: "Cartas e estratégia", emoji: "🃏" },
  { id: "corrida", label: "Corrida e veículos", emoji: "🏁" },
  { id: "voo", label: "Voo", emoji: "✈️" },
  { id: "tiro", label: "Tiro e co-op", emoji: "🎯" },
  { id: "plataforma", label: "Plataforma e fofinhos", emoji: "🧸" },
  { id: "relax", label: "Relaxantes e exploração", emoji: "🌿" },
] as const;

export const AI_SOURCES: { id: string; short: string; color: string; ink: string }[] = [
  { id: "Claude", short: "Claude", color: "#D97757", ink: "#fff" },
  { id: "ChatGPT", short: "GPT", color: "#10A37F", ink: "#fff" },
  { id: "Gemini", short: "Gemini", color: "#7B6CF6", ink: "#fff" },
  { id: "DeepSeek", short: "DeepSeek", color: "#4D6BFE", ink: "#fff" },
  { id: "Grok", short: "Grok", color: "#E8E8E8", ink: "#111" },
];

export const aiSource = (id: string) => AI_SOURCES.find((s) => s.id === id) ?? { id, short: id, color: "#555", ink: "#fff" };
