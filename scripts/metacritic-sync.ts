/**
 * Guarda as listas do Metacritic no banco (tabela metacritic_lists) para o Descobrir:
 * posição, nome, nota e o jogo do IGDB correspondente. A página só busca capa/screenshots no IGDB pelos ids.
 *   npm run sync:metacritic                 -> todas (PC e Switch)
 *   npm run sync:metacritic -- --only=pc    -> só uma plataforma
 *   npm run sync:metacritic -- --dry        -> só mostra o que faria
 * Lê as páginas públicas /browse (o robots.txt permite), com pausa entre elas. Nomes que já foram ligados a um
 * jogo do IGDB numa rodada anterior não são procurados de novo.
 */
import { and, eq } from "drizzle-orm";
import { db, metacriticLists, type MetacriticEntry } from "../lib/db";
import { igdb } from "../lib/sources/igdb";
import { normalize, sleep } from "../lib/sources/http";
import { getMetacriticPage, metacriticUrl, type MetacriticRow } from "../lib/sources/metacritic";
import { GENRES, MAX_GENRE, MIN_GENRE, type Tax } from "../lib/game-genres";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ONLY = arg("only");
const DRY = process.argv.includes("--dry");

const PLATFORMS = [
  { id: "pc", mc: "pc", igdb: 6 },
  { id: "switch", mc: "nintendo-switch", igdb: 130 },
] as const;

// Gêneros: o filtro de gênero do Metacritic marca poucos jogos (vários gêneros grandes nem devolvem nada), então a lista
// de gênero é a base dos melhores do Metacritic desde FIRST_YEAR (na ordem e com a nota deles) separada pelo gênero,
// tema ou palavra-chave do IGDB (lib/game-genres).
// Base dos gêneros: todos os jogos com nota no Metacritic desde FIRST_YEAR, ano a ano (até POOL_PAGES páginas por ano)
const POOL_PAGES = 20;
const FIRST_YEAR = 2022;

// want: quantos jogos achados no IGDB a lista deve ter (busca mais páginas até chegar lá ou acabar, no máximo MAX_PAGES)
type ListDef = { id: string; platform: string; group: string; label: string; position: number; path: string; query: string; want: number };
const MAX_PAGES = 8;

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

// Lançamento original pelo IGDB: o Metacritic data pela versão da plataforma (God of War de 2018 chega ao PC em 2022
// e conta como 2022). Jogo que saiu antes de FIRST_YEAR em qualquer lugar não entra em lista nenhuma.
const origYear = new Map<number, number | null>();
async function loadOrigYears(ids: (number | null)[]) {
  const todo = [...new Set(ids.filter((x): x is number => x != null && !origYear.has(x)))];
  for (let i = 0; i < todo.length; i += 500) {
    const chunk = todo.slice(i, i + 500);
    const rows = await igdb<Raw[]>("games", `fields first_release_date; where id = (${chunk.join(",")}); limit 500;`);
    for (const id of chunk) origYear.set(id, null);
    for (const g of rows) origYear.set(g.id, yearOf(g));
  }
}
const isOld = (e: MetacriticEntry) => e.igdbId != null && (origYear.get(e.igdbId) ?? FIRST_YEAR) < FIRST_YEAR;
let dropped: string[] = [];

async function main() {
  // Correspondências já feitas antes (mesmo nome, ano e plataforma): não procura de novo
  const known = new Map<string, number | null>();
  const keyOf = (platform: string, r: { title: string; year: number | null }) => `${platform}|${normalize(r.title)}|${r.year ?? ""}`;
  for (const l of await db.select().from(metacriticLists)) for (const e of l.entries) known.set(keyOf(l.platform, e), e.igdbId);

  const year = new Date().getUTCFullYear();
  // "Melhores" e gêneros: só jogos lançados de FIRST_YEAR para cá
  const since = `releaseYearMin=${FIRST_YEAR}&releaseYearMax=${year}`;
  for (const p of PLATFORMS.filter((x) => !ONLY || x.id === ONLY)) {
    const defs: ListDef[] = [
      { id: `${p.id}/top`, platform: p.id, group: "geral", label: `Melhores desde ${FIRST_YEAR}`, position: 0, path: `${p.mc}/all/all-time/metascore`, query: since, want: 100 },
      { id: `${p.id}/jogadores`, platform: p.id, group: "geral", label: `Jogadores desde ${FIRST_YEAR}`, position: 1, path: `${p.mc}/all/all-time/userscore`, query: since, want: 100 },
    ];
    for (let y = year; y >= FIRST_YEAR; y--) {
      defs.push({ id: `${p.id}/ano-${y}`, platform: p.id, group: "ano", label: String(y), position: 100 + (year - y), path: `${p.mc}/all/${y}/metascore`, query: "", want: 50 });
    }
    for (const d of defs) {
      // Página a página até ter `want` jogos achados no IGDB (DLCs e nomes sem par ficam de fora)
      const entries: MetacriticEntry[] = [];
      let searched = 0;
      dropped = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { rows, total } = await getMetacriticPage(d.path, d.query, page);
        await sleep(900);
        const todo = rows.filter((r) => !known.has(keyOf(p.id, r)));
        const ids = todo.length ? await matchIds(todo, p.igdb) : [];
        todo.forEach((r, i) => known.set(keyOf(p.id, r), ids[i]));
        searched += todo.length;
        const page_ = rows.map((r) => ({ ...r, igdbId: known.get(keyOf(p.id, r)) ?? null }));
        await loadOrigYears(page_.map((e) => e.igdbId));
        for (const e of page_) {
          if (isOld(e)) dropped.push(`${e.title} (${origYear.get(e.igdbId!)})`);
          else entries.push(e);
        }
        if (entries.filter((e) => e.igdbId != null).length >= d.want || page * 50 >= total || !rows.length) break;
      }
      const rows = entries;
      const hit = entries.filter((e) => e.igdbId != null).length;
      console.log(`${d.id}: ${rows.length} no Metacritic, ${hit} no IGDB (${searched} procurados agora); fora por serem antigos: ${dropped.length}`);
      if (dropped.length) console.log(`  antigos: ${dropped.slice(0, 12).join(", ")}${dropped.length > 12 ? "…" : ""}`);
      if (DRY || !rows.length) continue;
      const values = { platform: d.platform, group: d.group, label: d.label, position: d.position, url: metacriticUrl(d.path, d.query), entries, updatedAt: new Date() };
      await db.insert(metacriticLists).values({ id: d.id, ...values }).onConflictDoUpdate({ target: metacriticLists.id, set: values });
    }
    // Gêneros pelo IGDB: base dos melhores do Metacritic desde FIRST_YEAR, separada por gênero/tema/palavra-chave
    // O Metacritic não passa da página 20 (1000 jogos): a base vem ano a ano e depois é ordenada pela nota
    const pool: MetacriticEntry[] = [];
    for (let y = year; y >= FIRST_YEAR; y--) {
      const ofYear: MetacriticEntry[] = [];
      for (let page = 1; page <= POOL_PAGES; page++) {
        const { rows, total } = await getMetacriticPage(`${p.mc}/all/${y}/metascore`, "", page);
        await sleep(900);
        const todo = rows.filter((r) => !known.has(keyOf(p.id, r)));
        const ids = todo.length ? await matchIds(todo, p.igdb) : [];
        todo.forEach((r, i) => known.set(keyOf(p.id, r), ids[i]));
        ofYear.push(...rows.map((r) => ({ ...r, igdbId: known.get(keyOf(p.id, r)) ?? null })));
        if (page * 50 >= total || !rows.length) break;
      }
      // Sem nota ainda ("tbd") não entra
      await loadOrigYears(ofYear.map((e) => e.igdbId));
      pool.push(...ofYear.filter((e) => Number(e.score) > 0 && !isOld(e)));
    }
    pool.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    const inPool = [...new Set(pool.map((e) => e.igdbId).filter((x): x is number => x != null))];
    const tax = new Map<number, Tax>();
    for (let i = 0; i < inPool.length; i += 500) {
      const rows = await igdb<(Tax & { id: number })[]>("games", `fields genres,themes,keywords; where id = (${inPool.slice(i, i + 500).join(",")}); limit 500;`);
      for (const r of rows) tax.set(r.id, r);
    }
    console.log(`${p.id}: base de ${pool.length} jogos do Metacritic desde ${FIRST_YEAR}, ${inPool.length} no IGDB`);
    const poolUrl = metacriticUrl(`${p.mc}/all/all-time/metascore`, since);
    for (const [i, [slug, label, test]] of GENRES.entries()) {
      const seen = new Set<number>();
      const entries = pool.filter((e) => {
        if (e.igdbId == null || seen.has(e.igdbId) || !test(tax.get(e.igdbId) ?? {})) return false;
        seen.add(e.igdbId);
        return true;
      });
      if (entries.length < MIN_GENRE) {
        console.log(`  ${p.id} · ${label}: ${entries.length} jogos, fica de fora`);
        continue;
      }
      const d = { id: `${p.id}/genero-${slug}`, platform: p.id, group: "genero", label, position: 200 + i };
      defs.push({ ...d, path: "", query: "", want: 0 });
      console.log(`${d.id}: ${Math.min(entries.length, MAX_GENRE)} jogos (de ${entries.length})`);
      if (DRY) continue;
      const values = { platform: d.platform, group: d.group, label: d.label, position: d.position, url: poolUrl, entries: entries.slice(0, MAX_GENRE), updatedAt: new Date() };
      await db.insert(metacriticLists).values({ id: d.id, ...values }).onConflictDoUpdate({ target: metacriticLists.id, set: values });
    }

    // Listas que não existem mais nesta rodada (ex.: gênero que caiu abaixo do mínimo) saem
    if (!DRY) {
      const keep = new Set(defs.map((d) => d.id));
      for (const l of await db.select({ id: metacriticLists.id }).from(metacriticLists).where(and(eq(metacriticLists.platform, p.id), eq(metacriticLists.source, "mc")))) {
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
