/**
 * Preenche galeria, trailer, logotipo e corrige a arte de fundo de jogos, filmes e séries.
 *   npx tsx --env-file=.env.local scripts/backfill-media.ts
 */
import { and, eq, isNotNull, inArray } from "drizzle-orm";
import { db, items } from "../lib/db";
import { getIgdbDetails } from "../lib/sources/igdb";
import { getTmdbDetails } from "../lib/sources/tmdb";

async function main() {
  const games = await db.selectDistinct({ id: items.igdbId }).from(items).where(and(eq(items.kind, "game"), isNotNull(items.igdbId)));
  const av = await db
    .selectDistinct({ id: items.tmdbId, kind: items.kind })
    .from(items)
    .where(and(inArray(items.kind, ["movie", "series"]), isNotNull(items.tmdbId)));

  let ok = 0;
  for (const g of games) {
    try {
      const d = await getIgdbDetails(g.id!);
      await db
        .update(items)
        .set({ backdropUrl: d.backdropUrl, gallery: d.gallery ?? [], trailer: d.trailer ?? null, logoUrl: d.logoUrl ?? null })
        .where(and(eq(items.kind, "game"), eq(items.igdbId, g.id!)));
      ok++;
    } catch (e) {
      console.error("jogo", g.id, String(e));
    }
  }
  for (const m of av) {
    try {
      const d = await getTmdbDetails(m.kind as "movie" | "series", m.id!);
      await db
        .update(items)
        .set({ gallery: d.gallery ?? [], trailer: d.trailer ?? null, logoUrl: d.logoUrl ?? null, cast: d.cast ?? [] })
        .where(and(eq(items.kind, m.kind), eq(items.tmdbId, m.id!)));
      ok++;
    } catch (e) {
      console.error("tmdb", m.id, String(e));
    }
  }
  console.log(`Atualizados: ${ok} de ${games.length + av.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
