/**
 * Calcula cor dominante + miniatura borrada das capas e conserta capas inválidas de livros.
 *   npx tsx --env-file=.env.local scripts/backfill-palette.ts [--all]
 */
import { eq, isNull, or } from "drizzle-orm";
import { db, items } from "../lib/db";
import { enrich } from "../lib/enrich";
import { analyzeCover } from "../lib/palette";

async function main() {
  const all = process.argv.includes("--all");
  const rows = await db
    .select()
    .from(items)
    .where(all ? undefined : or(isNull(items.coverColor), isNull(items.coverUrl)));
  const stats = { ok: 0, fixed: 0, missing: 0 };
  let i = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (i < rows.length) {
        const it = rows[i++];
        const info = await analyzeCover(it.coverUrl);
        if (info) {
          await db.update(items).set({ coverColor: info.color, coverBlur: info.blur }).where(eq(items.id, it.id));
          stats.ok++;
          continue;
        }
        // Capa inválida: refaz o enriquecimento do livro (tenta Open Library/Hardcover)
        if (it.kind === "book" && it.googleBooksId) {
          const data = await enrich("book", it.googleBooksId, { author: it.creators[0] });
          await db
            .update(items)
            .set({ coverUrl: data.coverUrl ?? null, coverColor: data.coverColor ?? null, coverBlur: data.coverBlur ?? null })
            .where(eq(items.id, it.id));
          if (data.coverColor) {
            stats.fixed++;
            console.log("capa consertada:", it.title, "→", data.coverUrl);
            continue;
          }
        }
        stats.missing++;
        console.log("sem capa:", it.kind, it.title);
      }
    }),
  );
  console.log(stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
