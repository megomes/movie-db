/**
 * Importa o backlog do Obsidian uma única vez.
 *   npm run import:obsidian -- --owner=email@x.com --dir="<vault>/Backlog"   -> importa tudo para o backlog dessa pessoa
 *   (a pasta também pode vir de OBSIDIAN_BACKLOG_DIR no .env.local)
 *   npm run import:obsidian -- --dry   -> só mostra o que faria
 * É idempotente: pula notas cujo source_path já está no banco.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { and, eq, inArray } from "drizzle-orm";
import { db, items, profiles, type Kind, type NewItem } from "../lib/db";
import { enrich, pickMatch, searchCandidates } from "../lib/enrich";
import { syncLegacyTags } from "../lib/tags-sync";
import { findByImdbId } from "../lib/sources/tmdb";
import { normalize } from "../lib/sources/http";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ROOT = arg("dir") ?? process.env.OBSIDIAN_BACKLOG_DIR ?? "";
if (!ROOT) throw new Error('Informe a pasta do backlog: --dir="<vault>/Backlog" ou OBSIDIAN_BACKLOG_DIR');
const MEDIA_DIR = path.join(ROOT, "Media/Itens");
const BOOKS_DIR = path.join(ROOT, "Biblioteca/Livros");
const DRY = process.argv.includes("--dry");
const OWNER_EMAIL = arg("owner") ?? process.env.OBSIDIAN_BACKLOG_OWNER ?? "";
if (!OWNER_EMAIL) throw new Error("Informe o dono: --owner=email@x.com ou OBSIDIAN_BACKLOG_OWNER");
let OWNER_ID = "";

type Entry = {
  kind: Kind;
  title: string;
  query: string;
  notes: string | null;
  imdbId: string | null;
  myPlatforms: string[];
  author: string | null;
  year: number | null;
  category: string | null;
  summary: string | null;
  priority: number | null;
  sourcePath: string;
};

const EDITION = /\s*[-–:]\s*(deluxe|complete|definitive|goty|game of the year|ultimate|gold|standard)( edition)?\s*$/i;

function cleanTitle(raw: string) {
  let title = raw.replace(/\s*\(\d+\)\s*$/, "").trim(); // "Art of Rally (2)"
  let note: string | null = null;
  const paren = title.match(/^(.*?)\s*\(([^)]*[a-zà-ú][^)]*)\)\s*$/i);
  if (paren) {
    title = paren[1].trim();
    note = paren[2].trim();
  }
  const query = title.replace(EDITION, "").replace(/[’]/g, "'").trim();
  return { title, query, note };
}

function readMedia(): Entry[] {
  const map: Record<string, { kind: Kind; platform?: string }> = {
    Movie: { kind: "movie" },
    "Série": { kind: "series" },
    Game: { kind: "game", platform: "PC" },
    "Nintendo Switch": { kind: "game", platform: "Switch" },
  };
  const out: Entry[] = [];
  for (const file of fs.readdirSync(MEDIA_DIR).filter((f) => f.endsWith(".md"))) {
    const { data, content } = matter(fs.readFileSync(path.join(MEDIA_DIR, file), "utf8"));
    if (data.done === true) continue;
    const t = map[data.tipo as string];
    if (!t) {
      console.warn(`tipo desconhecido em ${file}: ${data.tipo}`);
      continue;
    }
    const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const { title, query, note } = cleanTitle(h1 ?? file.replace(/\.md$/, ""));
    // "Fresh 2022" -> busca "Fresh" no ano 2022
    const ym = t.kind !== "game" ? query.match(/^(.*\S)\s+\(?((?:19|20)\d{2})\)?$/) : null;
    const imdbId = content.match(/imdb\.com\/title\/(tt\d+)/)?.[1] ?? null;
    const body = content
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.startsWith("#") && !/imdb\.com/.test(l))
      .join("\n")
      .trim();
    out.push({
      kind: t.kind,
      title,
      query: ym ? ym[1] : query,
      year: ym ? Number(ym[2]) : null,
      notes: [note, body].filter(Boolean).join("\n") || null,
      imdbId,
      myPlatforms: t.platform ? [t.platform] : [],
      author: null,
      category: null,
      summary: null,
      priority: null,
      sourcePath: `Media/Itens/${file}`,
    });
  }

  // Junta jogos duplicados (mesmo jogo no PC e no Switch)
  const merged = new Map<string, Entry>();
  for (const e of out) {
    const key = `${e.kind}:${normalize(e.query)}`;
    const prev = merged.get(key);
    if (prev) {
      prev.myPlatforms = [...new Set([...prev.myPlatforms, ...e.myPlatforms])];
      prev.notes = [prev.notes, e.notes].filter(Boolean).join("\n") || null;
    } else merged.set(key, e);
  }
  return [...merged.values()];
}

function readBooks(): Entry[] {
  const out: Entry[] = [];
  for (const file of fs.readdirSync(BOOKS_DIR).filter((f) => f.endsWith(".md"))) {
    const { data } = matter(fs.readFileSync(path.join(BOOKS_DIR, file), "utf8"));
    if (data.status === true) continue;
    const { title, query, note } = cleanTitle(file.replace(/\.md$/, ""));
    out.push({
      kind: "book",
      title,
      query,
      notes: note,
      imdbId: null,
      myPlatforms: [],
      author: typeof data.autor === "string" ? data.autor : null,
      year: null,
      category: typeof data.tipo === "string" ? data.tipo : null,
      summary: typeof data.resumo === "string" ? data.resumo : null,
      priority: typeof data.prioridade === "number" ? data.prioridade : null,
      sourcePath: `Biblioteca/Livros/${file}`,
    });
  }
  return out;
}

async function importEntry(e: Entry): Promise<{ status: string; row: NewItem }> {
  const base: NewItem = {
    ownerId: OWNER_ID,
    kind: e.kind,
    title: e.title,
    notes: e.notes,
    myPlatforms: e.myPlatforms,
    category: e.category,
    summary: e.summary,
    priority: e.priority,
    searchQuery: e.query,
    source: "obsidian",
    sourcePath: e.sourcePath,
    creators: e.author ? [e.author] : [],
  };

  // Link do IMDb na nota = correspondência exata
  if (e.imdbId) {
    const found = await findByImdbId(e.imdbId);
    if (found) {
      const data = await enrich(found.kind, String(found.id));
      return { status: "matched", row: { ...base, ...data, kind: found.kind, matchStatus: "matched" } };
    }
  }

  const hint = { author: e.author, myPlatforms: e.myPlatforms, year: e.year };
  const candidates = await searchCandidates(e.kind, e.query, hint);
  const { best, confident } = pickMatch(e.kind, e.query, candidates, hint);
  if (!best) return { status: "unmatched", row: { ...base, matchStatus: "unmatched" } };

  const data = await enrich(e.kind, best.externalId, hint);
  const status = confident ? "matched" : "needs_review";
  return {
    status,
    row: {
      ...base,
      ...data,
      // Mantém o autor do Obsidian se a fonte não trouxe
      creators: data.creators?.length ? data.creators : base.creators,
      matchStatus: status,
      candidates: confident ? [] : candidates.slice(0, 6).map(({ externalId, title, year, cover, subtitle }) => ({ externalId, title, year, cover, subtitle })),
    },
  };
}

async function pool<T>(list: T[], size: number, fn: (x: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < list.length) {
        const idx = i++;
        await fn(list[idx], idx);
      }
    }),
  );
}

// --recheck: refaz a correspondência dos itens importados que ainda estão em revisão/sem match
async function recheck(entries: Entry[]) {
  const rows = await db
    .select({ id: items.id, sourcePath: items.sourcePath, title: items.title })
    .from(items)
    .where(and(eq(items.ownerId, OWNER_ID), eq(items.source, "obsidian"), inArray(items.matchStatus, ["needs_review", "unmatched"])));
  const bySource = new Map(entries.map((e) => [e.sourcePath, e]));
  const summary: Record<string, number> = {};
  await pool(rows, 3, async (r, idx) => {
    const e = r.sourcePath ? bySource.get(r.sourcePath) : undefined;
    if (!e) return;
    try {
      const { status, row } = await importEntry(e);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { sourcePath: _s, source: _src, ...update } = row;
      await db.update(items).set({ candidates: [], ...update }).where(eq(items.id, r.id));
      summary[status] = (summary[status] ?? 0) + 1;
      console.log(`[${idx + 1}/${rows.length}] ${status.padEnd(12)} ${e.title} → ${row.title}${row.year ? ` (${row.year})` : ""}`);
    } catch (err) {
      summary.error = (summary.error ?? 0) + 1;
      console.error(`[${idx + 1}/${rows.length}] ERRO ${e.title}: ${err}`);
    }
  });
  console.log("Recheck:", summary);
}

async function main() {
  const [owner] = await db.select().from(profiles).where(eq(profiles.email, OWNER_EMAIL));
  if (!owner) throw new Error(`${OWNER_EMAIL} ainda não entrou no app (sem perfil)`);
  OWNER_ID = owner.userId;
  const entries = [...readMedia(), ...readBooks()];
  if (process.argv.includes("--recheck")) return recheck(entries);
  const existing = new Set(
    (await db.select({ p: items.sourcePath }).from(items).where(eq(items.ownerId, OWNER_ID))).map((r) => r.p).filter(Boolean) as string[],
  );
  const todo = entries.filter((e) => !existing.has(e.sourcePath));
  const byKind = todo.reduce<Record<string, number>>((a, e) => ((a[e.kind] = (a[e.kind] ?? 0) + 1), a), {});
  console.log(`${entries.length} entradas, ${todo.length} novas`, byKind);
  if (DRY) {
    for (const e of todo) console.log(e.kind.padEnd(6), e.query, e.myPlatforms.join(","), e.notes ? `| ${e.notes}` : "");
    return;
  }

  const report: { title: string; kind: string; status: string; matched?: string; error?: string }[] = [];
  await pool(todo, 4, async (e, idx) => {
    try {
      const { status, row } = await importEntry(e);
      await db.insert(items).values(row);
      report.push({ title: e.title, kind: e.kind, status, matched: row.title });
      console.log(`[${idx + 1}/${todo.length}] ${status.padEnd(12)} ${e.title} → ${row.title}${row.year ? ` (${row.year})` : ""}`);
    } catch (err) {
      report.push({ title: e.title, kind: e.kind, status: "error", error: String(err) });
      console.error(`[${idx + 1}/${todo.length}] ERRO ${e.title}: ${err}`);
    }
  });

  fs.mkdirSync("scripts/out", { recursive: true });
  fs.writeFileSync("scripts/out/import-report.json", JSON.stringify(report, null, 2));
  const summary = report.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
  console.log("Resumo:", summary);
  await syncLegacyTags(OWNER_ID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
