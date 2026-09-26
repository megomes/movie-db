/**
 * Recalcula a nota normalizada (score) de todos os itens.
 * Para jogos, busca as contagens de avaliação no IGDB em lote antes.
 *   npx tsx --env-file=.env.local scripts/rescore.ts
 */
import { eq, isNotNull, and } from "drizzle-orm";
import { db, items } from "../lib/db";
import { computeScore } from "../lib/enrich";
import { fetchJson } from "../lib/sources/http";

async function igdbCounts(ids: number[]) {
  const tok = await fetchJson<{ access_token: string }>(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" },
  );
  const out = new Map<number, { total?: number; totalCount?: number; critic?: number; criticCount?: number }>();
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const rows = await fetchJson<{ id: number; total_rating?: number; total_rating_count?: number; aggregated_rating?: number; aggregated_rating_count?: number }[]>(
      "https://api.igdb.com/v4/games",
      {
        method: "POST",
        headers: { "Client-ID": process.env.IGDB_CLIENT_ID!, Authorization: `Bearer ${tok.access_token}` },
        body: `fields total_rating,total_rating_count,aggregated_rating,aggregated_rating_count; where id = (${chunk.join(",")}); limit 500;`,
      },
    );
    for (const r of rows) out.set(r.id, { total: r.total_rating, totalCount: r.total_rating_count, critic: r.aggregated_rating, criticCount: r.aggregated_rating_count });
  }
  return out;
}

async function main() {
  const games = await db.select({ id: items.id, igdbId: items.igdbId }).from(items).where(and(eq(items.kind, "game"), isNotNull(items.igdbId)));
  const counts = await igdbCounts(games.map((g) => g.igdbId!));

  const all = await db.select().from(items);
  for (const it of all) {
    const ratings = { ...it.ratings };
    if (it.kind === "game" && it.igdbId && counts.has(it.igdbId)) {
      const c = counts.get(it.igdbId)!;
      Object.assign(ratings, {
        igdb: c.total ? Math.round(c.total) : null,
        igdbCount: c.totalCount ?? null,
        igdbCritic: c.critic ? Math.round(c.critic) : null,
        igdbCriticCount: c.criticCount ?? null,
      });
    }
    const score = computeScore(it.kind, ratings);
    await db.update(items).set({ ratings, score }).where(eq(items.id, it.id));
  }
  console.log(`Recalculado: ${all.length} itens`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
