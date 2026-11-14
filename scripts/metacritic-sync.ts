/**
 * Guarda as listas do Metacritic no banco (tabela metacritic_lists) para o Descobrir:
 * posição, nome, nota e o jogo do IGDB correspondente. A página só busca capa/screenshots no IGDB pelos ids.
 *   npm run sync:metacritic                 -> todas (PC e Switch)
 *   npm run sync:metacritic -- --only=pc    -> só uma plataforma
 *   npm run sync:metacritic -- --dry        -> só mostra o que faria
 * Lê as páginas públicas /browse (o robots.txt permite), com pausa entre elas. Nomes que já foram ligados a um
 * jogo do IGDB numa rodada anterior não são procurados de novo.
 */
import { eq } from "drizzle-orm";
import { db, metacriticLists, type MetacriticEntry } from "../lib/db";
import { igdb } from "../lib/sources/igdb";
import { normalize, sleep } from "../lib/sources/http";
import { getMetacriticList, getMetacriticPage, metacriticUrl, type MetacriticRow } from "../lib/sources/metacritic";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ONLY = arg("only");
const DRY = process.argv.includes("--dry");

const PLATFORMS = [
  { id: "pc", mc: "pc", igdb: 6 },
  { id: "switch", mc: "nintendo-switch", igdb: 130 },
] as const;

// Gêneros do filtro do Metacritic (o "-" do nome vira "---" e a "/" vira "-or-"). Vários grandes (Platformer, Fighting,
// Shooter, FPS, Tactics...) não devolvem nada lá; só entra o gênero que tiver pelo menos MIN_GENRE jogos na plataforma.
const GENRES: [slug: string, label: string][] = [
  ["action-rpg", "RPG de ação"],
  ["rpg", "RPG"],
  ["roguelike", "Roguelike"],
  ["action-adventure", "Ação e aventura"],
  ["adventure", "Aventura"],
  ["action", "Ação"],
  ["survival", "Sobrevivência"],
  ["third-person-shooter", "Tiro em 3ª pessoa"],
  ["real---time-strategy", "Estratégia em tempo real"],
  ["turn---based-strategy", "Estratégia por turnos"],
  ["strategy", "Estratégia"],
  ["card-battle", "Cartas"],
  ["action-puzzle", "Ação e puzzle"],
  ["puzzle", "Puzzle"],
  ["sandbox", "Sandbox"],
  ["simulation", "Simulação"],
  ["racing", "Corrida"],
  ["rhythm", "Ritmo"],
  ["visual-novel", "Visual novel"],
  ["arcade", "Arcade"],
];
const MIN_GENRE = 15;
const FIRST_YEAR = 2017;

type ListDef = { id: string; platform: string; group: string; label: string; position: number; path: string; query: string; pages: number };

// Nome do Metacritic -> id do IGDB. Primeiro por nome exato (sem diferenciar maiúsculas), 25 por consulta; quem não bater
// vai pela busca do IGDB. Com mais de um jogo do mesmo nome (remakes), fica o da plataforma e do ano certos.
type Raw = { id: number; name: string; first_release_date?: number; total_rating_count?: number; platforms?: number[] };
const FIELDS = "fields name,first_release_date,total_rating_count,platforms";
const TYPES = "(0,3,4,8,9,10,11)";
const clean = (t: string) => t.replace(/\s*\(\d{4}\)$/, "").replace(/["\\]/g, "").trim();
const yearOf = (g: Raw) => (g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null);

async function matchIds(rows: MetacriticRow[], platform: number): Promise<(number | null)[]> {
  const byName = new Map<string, Raw[]>();
  for (let i = 0; i < rows.length; i += 25) {
    const names = rows.slice(i, i + 25).map((r) => `name ~ "${clean(r.title)}"`);
    const found = await igdb<Raw[]>("games", `${FIELDS}; where (${names.join(" | ")}) & game_type = ${TYPES}; limit 500;`);
    for (const g of found) byName.set(normalize(g.name), [...(byName.get(normalize(g.name)) ?? []), g]);
  }
  const pick = (list: Raw[], row: MetacriticRow) =>
    [...list].sort((a, b) => {
      const plat = Number(!!b.platforms?.includes(platform)) - Number(!!a.platforms?.includes(platform));
      if (plat) return plat;
      if (row.year != null) {
        const d = Math.abs((yearOf(a) ?? 0) - row.year) - Math.abs((yearOf(b) ?? 0) - row.year);
        if (d) return d;
      }
      return (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0);
    })[0];
  const out: (number | null)[] = [];
  for (const row of rows) {
    const same = byName.get(normalize(clean(row.title)));
    let g = same ? pick(same, row) : undefined;
    if (!g) {
      const hits = await igdb<Raw[]>("games", `search "${clean(row.title)}"; ${FIELDS}; where platforms = (${platform}) & game_type = ${TYPES}; limit 5;`);
      g = hits.find((h) => row.year == null || Math.abs((yearOf(h) ?? 0) - row.year) <= 1);
    }
    out.push(g?.id ?? null);
  }
  return out;
}

async function main() {
  // Correspondências já feitas antes (mesmo nome, ano e plataforma): não procura de novo
  const known = new Map<string, number | null>();
  const keyOf = (platform: string, r: { title: string; year: number | null }) => `${platform}|${normalize(r.title)}|${r.year ?? ""}`;
  for (const l of await db.select().from(metacriticLists)) for (const e of l.entries) known.set(keyOf(l.platform, e), e.igdbId);

  const year = new Date().getUTCFullYear();
  for (const p of PLATFORMS.filter((x) => !ONLY || x.id === ONLY)) {
    const defs: ListDef[] = [
      { id: `${p.id}/top`, platform: p.id, group: "geral", label: "Melhores de sempre", position: 0, path: `${p.mc}/all/all-time/metascore`, query: "", pages: 2 },
      { id: `${p.id}/jogadores`, platform: p.id, group: "geral", label: "Nota dos jogadores", position: 1, path: `${p.mc}/all/all-time/userscore`, query: "", pages: 2 },
    ];
    for (let y = year; y >= FIRST_YEAR; y--) {
      defs.push({ id: `${p.id}/ano-${y}`, platform: p.id, group: "ano", label: String(y), position: 100 + (year - y), path: `${p.mc}/all/${y}/metascore`, query: "", pages: 1 });
    }
    // Gênero só se tiver jogos suficientes nesta plataforma
    for (const [i, [slug, label]] of GENRES.entries()) {
      const { total } = await getMetacriticPage(`${p.mc}/all/all-time/metascore`, `genre=${slug}`);
      await sleep(900);
      if (total < MIN_GENRE) {
        console.log(`  ${p.id} · ${label}: ${total} jogos, fica de fora`);
        continue;
      }
      defs.push({ id: `${p.id}/genero-${slug}`, platform: p.id, group: "genero", label, position: 200 + i, path: `${p.mc}/all/all-time/metascore`, query: `genre=${slug}`, pages: 1 });
    }

    for (const d of defs) {
      const rows = await getMetacriticList(d.path, d.query, d.pages);
      await sleep(900);
      const todo = rows.filter((r) => !known.has(keyOf(p.id, r)));
      const ids = todo.length ? await matchIds(todo, p.igdb) : [];
      todo.forEach((r, i) => known.set(keyOf(p.id, r), ids[i]));
      const entries: MetacriticEntry[] = rows.map((r) => ({ ...r, igdbId: known.get(keyOf(p.id, r)) ?? null }));
      const hit = entries.filter((e) => e.igdbId != null).length;
      console.log(`${d.id}: ${rows.length} no Metacritic, ${hit} no IGDB (${todo.length} procurados agora)`);
      if (DRY || !rows.length) continue;
      const values = { platform: d.platform, group: d.group, label: d.label, position: d.position, url: metacriticUrl(d.path, d.query), entries, updatedAt: new Date() };
      await db.insert(metacriticLists).values({ id: d.id, ...values }).onConflictDoUpdate({ target: metacriticLists.id, set: values });
    }
    // Listas que não existem mais nesta rodada (ex.: gênero que caiu abaixo do mínimo) saem
    if (!DRY) {
      const keep = new Set(defs.map((d) => d.id));
      for (const l of await db.select({ id: metacriticLists.id }).from(metacriticLists).where(eq(metacriticLists.platform, p.id))) {
        if (!keep.has(l.id)) await db.delete(metacriticLists).where(eq(metacriticLists.id, l.id));
      }
    }
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
