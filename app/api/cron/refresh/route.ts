import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { db, items, profiles, type Availability, type Item } from "@/lib/db";
import { computeScore } from "@/lib/enrich";
import { notifyUser, type PushPayload } from "@/lib/push";
import { getSteamPrice } from "@/lib/sources/igdb";
import { getOmdbRatings } from "@/lib/sources/omdb";
import { getTmdbProviders } from "@/lib/sources/tmdb";

export const maxDuration = 300;

const WEEK = 7 * 86_400_000;
const streamIds = (a: Availability) => new Set([...(a.flatrate ?? []), ...(a.free ?? []), ...(a.ads ?? [])].map((p) => p.id));

// Roda 1x por dia (vercel.json). Atualiza onde assistir, notas e preços; avisa por push o que mudou.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // "Visto" há mais de 1 dia some de vez
  const purged = await db.delete(items).where(lt(items.doneAt, new Date(Date.now() - 86_400_000))).returning({ id: items.id });

  const people = await db.select().from(profiles);
  const news = new Map<string, { item: Item; text: string }[]>();
  const push = (userId: string, item: Item, text: string) => news.set(userId, [...(news.get(userId) ?? []), { item, text }]);

  // Filmes e séries: provedores no BR (diário) e notas do OMDb (semanal)
  const av = await db
    .select()
    .from(items)
    .where(and(isNull(items.doneAt), inArray(items.kind, ["movie", "series"]), isNotNull(items.tmdbId)));
  let avUpdated = 0;
  for (const it of av) {
    try {
      const availability = await getTmdbProviders(it.kind as "movie" | "series", it.tmdbId!);
      const before = streamIds(it.availability);
      const after = streamIds(availability);
      // Só avisa o dono do item, e só sobre serviços que ele assina
      for (const p of people.filter((x) => x.userId === it.ownerId)) {
        const arrived = [...after].find((id) => !before.has(id) && p.providerIds.includes(id));
        if (arrived) {
          const name = [...(availability.flatrate ?? []), ...(availability.free ?? []), ...(availability.ads ?? [])].find((x) => x.id === arrived)?.name;
          push(p.userId, it, `${it.title} chegou no ${name}`);
        }
      }
      const update: Partial<Item> = { availability };
      if (it.imdbId && (!it.enrichedAt || Date.now() - it.enrichedAt.getTime() > WEEK)) {
        const ratings = { ...it.ratings, ...(await getOmdbRatings(it.imdbId)) };
        Object.assign(update, { ratings, score: computeScore(it.kind, ratings), enrichedAt: new Date() });
      }
      await db.update(items).set(update).where(eq(items.id, it.id));
      avUpdated++;
    } catch (err) {
      console.error("refresh av", it.title, err);
    }
  }

  // Jogos: preço na Steam; avisa quando entra em promoção forte
  const games = await db
    .select()
    .from(items)
    .where(and(isNull(items.doneAt), eq(items.kind, "game"), isNotNull(items.steamAppId)));
  let gamesUpdated = 0;
  for (const it of games) {
    try {
      const price = await getSteamPrice(it.steamAppId!);
      const was = it.steamPrice?.discountPercent ?? 0;
      if (price && price.discountPercent >= 50 && was < 50) {
        push(it.ownerId, it, `${it.title} está -${price.discountPercent}% na Steam (${price.formatted})`);
      }
      await db.update(items).set({ steamPrice: price }).where(eq(items.id, it.id));
      gamesUpdated++;
    } catch (err) {
      console.error("refresh steam", it.title, err);
    }
  }

  let sent = 0;
  for (const [userId, list] of news) {
    const payload: PushPayload =
      list.length === 1
        ? { title: "Novidade na sua lista", body: list[0].text, url: `/item/${list[0].item.id}`, image: list[0].item.backdropUrl }
        : { title: `${list.length} novidades na sua lista`, body: list.slice(0, 3).map((n) => n.text).join(" · "), url: "/" };
    sent += (await notifyUser(userId, payload)).sent;
  }

  return Response.json({ purged: purged.length, avUpdated, gamesUpdated, notifications: sent });
}
