/**
 * Preenche o elenco/autor (coluna cast) dos itens que ainda não têm.
 *   npx tsx --env-file=.env.local scripts/backfill-cast.ts
 */
import { eq, sql } from "drizzle-orm";
import { db, items, type CastMember } from "../lib/db";
import { getBookDetails } from "../lib/sources/books";
import { getTmdbDetails } from "../lib/sources/tmdb";

async function main() {
  const rows = await db.select().from(items).where(sql`jsonb_array_length(${items.cast}) = 0`);
  let done = 0;
  for (const it of rows) {
    try {
      let cast: CastMember[] | undefined;
      if ((it.kind === "movie" || it.kind === "series") && it.tmdbId) cast = (await getTmdbDetails(it.kind, it.tmdbId)).cast;
      if (it.kind === "book" && it.googleBooksId) cast = (await getBookDetails(it.googleBooksId, { author: it.creators[0] })).cast;
      if (cast?.length) {
        await db.update(items).set({ cast }).where(eq(items.id, it.id));
        done++;
      }
    } catch (err) {
      console.error(it.title, String(err));
    }
  }
  console.log(`Elenco preenchido em ${done}/${rows.length} itens`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
