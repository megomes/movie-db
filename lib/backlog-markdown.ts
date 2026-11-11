import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, items, switchGames, type Item, type Kind } from "@/lib/db";
import { COLLECTIONS, FAMILY_LIST } from "@/lib/collections";

// Backlog em markdown para colar em outro agente de IA: só o que identifica cada obra sem ambiguidade + o status

const SECTIONS: { kind: Kind; title: string; todo: string; done: string }[] = [
  { kind: "movie", title: "Filmes", todo: "Quero ver", done: "Já vi" },
  { kind: "series", title: "Séries", todo: "Quero ver", done: "Já vi" },
  { kind: "game", title: "Jogos", todo: "Quero jogar", done: "Já joguei" },
  { kind: "book", title: "Livros", todo: "Quero ler", done: "Já li" },
];

const PLATFORMS = ["PC", "Switch", "Android"];
const PLATFORM_LABEL: Record<string, string> = { switch: "Switch", pc: "PC" };

type Installed = { igdbId: number | null; platform: string; title: string; sizeMb: number | null };

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const month = (d: Date) => d.toISOString().slice(0, 7);

function line(i: Item, installed: Installed[]) {
  const head = `${clean(i.title)}${i.year ? ` (${i.year})` : ""}`;
  const bits: string[] = [];
  const who = [...new Set(i.creators.map(clean))].slice(0, 2).join(", ");
  if (i.kind === "movie" && who) bits.push(`dir. ${who}`);
  if (i.kind === "series" && who) bits.push(`criada por ${who}`);
  if (i.kind === "book" && who) bits.push(who);
  if (i.kind === "game") {
    if (who) bits.push(who);
    const plats = i.platforms.filter((p) => PLATFORMS.includes(p) && !i.hiddenPlatforms.includes(p));
    if (plats.length) bits.push(plats.join("/"));
    const inst = installed.filter((g) => g.igdbId != null && g.igdbId === i.igdbId).map((g) => PLATFORM_LABEL[g.platform] ?? g.platform);
    if (inst.length) bits.push(`instalado no ${inst.join(" e no ")}`);
  }
  if (!i.doneAt && i.pinned) bits.push("★ quero muito");
  if (i.doneAt) bits.push(`terminado em ${month(i.doneAt)}`);
  return `- ${head}${bits.length ? ` — ${bits.join(" · ")}` : ""}`;
}

function block(title: string, rows: Item[], installed: Installed[]) {
  if (!rows.length) return [];
  return [`### ${title} (${rows.length})`, ...rows.map((r) => line(r, installed)), ""];
}

export async function backlogMarkdown(ownerId: string, name?: string | null) {
  const [mine, family, installed] = await Promise.all([
    db.select().from(items).where(eq(items.ownerId, ownerId)).orderBy(asc(items.title)),
    db.select().from(items).where(eq(items.ownerId, FAMILY_LIST)).orderBy(asc(items.title)),
    db
      .select({ igdbId: switchGames.igdbId, platform: switchGames.platform, title: switchGames.title, sizeMb: switchGames.sizeMb })
      .from(switchGames)
      .where(eq(switchGames.ownerId, ownerId))
      .orderBy(asc(switchGames.title)),
  ]);
  // Só o que já está identificado (os "a revisar" podem ser a obra errada)
  const ok = mine.filter((i) => i.matchStatus === "matched");
  const today = new Date().toISOString().slice(0, 10);

  const out: string[] = [
    `# Backlog${name ? ` de ${name}` : ""} (exportado em ${today})`,
    "",
    "Filmes, séries, jogos e livros que quero consumir e os que já terminei. " +
      "★ = prioridade (quero muito). Nos jogos, as plataformas são onde eu jogaria; \"instalado\" = já está no aparelho.",
    "",
  ];

  for (const s of SECTIONS) {
    const rows = ok.filter((i) => i.kind === s.kind);
    const todo = rows.filter((i) => !i.doneAt).sort((a, b) => Number(b.pinned) - Number(a.pinned));
    const done = rows.filter((i) => i.doneAt).sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime());
    const fam = s.kind === "book" ? family.filter((i) => !i.doneAt && i.matchStatus === "matched") : [];

    // Instalados que nem estão no backlog (ex.: importados do Switch)
    const known = new Set(rows.map((i) => i.igdbId).filter(Boolean));
    const loose = s.kind === "game" ? installed.filter((g) => !g.igdbId || !known.has(g.igdbId)) : [];

    if (!todo.length && !done.length && !fam.length && !loose.length) continue;
    out.push(`## ${s.title}`, "");
    out.push(...block(s.todo, todo, installed));
    if (loose.length) {
      out.push(`### Instalados, fora do backlog (${loose.length})`);
      out.push(...loose.map((g) => `- ${clean(g.title)} — instalado no ${PLATFORM_LABEL[g.platform] ?? g.platform}`), "");
    }
    out.push(...block(s.done, done, installed));
    if (fam.length) out.push(...block(`${COLLECTIONS[FAMILY_LIST].title} — lista compartilhada`, fam, installed));
  }
  return out.join("\n").trimEnd() + "\n";
}
