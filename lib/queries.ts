import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, items, profiles, type Item } from "@/lib/db";

export type Person = { userId: string; name: string | null; image: string | null; email: string };

export async function listItems(ownerId: string) {
  return db
    .select()
    .from(items)
    .where(and(eq(items.ownerId, ownerId), isNull(items.doneAt)))
    .orderBy(desc(items.createdAt));
}

export async function getItem(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(items).where(eq(items.id, id));
  return row ?? null;
}

export async function listReviewItems(ownerId: string) {
  return db
    .select()
    .from(items)
    .where(and(eq(items.ownerId, ownerId), isNull(items.doneAt), inArray(items.matchStatus, ["needs_review", "unmatched"])))
    .orderBy(items.kind, items.title);
}

export async function listPeople(): Promise<Person[]> {
  return db.select({ userId: profiles.userId, name: profiles.name, image: profiles.image, email: profiles.email }).from(profiles);
}

// Versão enxuta para o cliente (listas, sorteio, busca), sem textos longos
export type LiteItem = ReturnType<typeof toLite>;
export function toLite(i: Item) {
  return {
    id: i.id,
    kind: i.kind,
    title: i.title,
    year: i.year,
    coverUrl: i.coverUrl,
    coverColor: i.coverColor,
    coverBlur: i.coverBlur,
    backdropUrl: i.backdropUrl,
    overview: (i.summary ?? i.overview)?.slice(0, 240) ?? null,
    genres: i.genres,
    creators: i.creators,
    ratings: i.ratings,
    score: i.score,
    availability: i.availability,
    myPlatforms: i.myPlatforms,
    gamePass: i.gamePass,
    steamPrice: i.steamPrice,
    minutes: i.minutes,
    pages: i.pages,
    seasons: i.seasons,
    priority: i.priority,
    pinned: i.pinned,
    matchStatus: i.matchStatus,
    createdAt: i.createdAt.toISOString(),
  };
}
