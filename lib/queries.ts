import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, interests, items, profiles, type Item } from "@/lib/db";

export type ItemView = Item & { interestedIds: string[] };

export type Person = { userId: string; name: string | null; image: string | null };

async function withInterests(rows: Item[]): Promise<ItemView[]> {
  if (!rows.length) return [];
  const ints = await db
    .select()
    .from(interests)
    .where(inArray(interests.itemId, rows.map((r) => r.id)));
  const map = new Map<string, string[]>();
  for (const i of ints) map.set(i.itemId, [...(map.get(i.itemId) ?? []), i.userId]);
  return rows.map((r) => ({ ...r, interestedIds: map.get(r.id) ?? [] }));
}

export async function listActiveItems() {
  const rows = await db.select().from(items).where(isNull(items.doneAt)).orderBy(desc(items.createdAt));
  return withInterests(rows);
}

// Versão enxuta para mandar ao cliente (listas e roleta), sem textos longos
export type LiteItem = ReturnType<typeof toLite>;
export function toLite(i: ItemView) {
  return {
    id: i.id,
    kind: i.kind,
    title: i.title,
    year: i.year,
    coverUrl: i.coverUrl,
    backdropUrl: i.backdropUrl,
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
    priority: i.priority,
    category: i.category,
    createdAt: i.createdAt.toISOString(),
    interestedIds: i.interestedIds,
  };
}

export async function getItem(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(items).where(eq(items.id, id));
  if (!row) return null;
  const [view] = await withInterests([row]);
  return view;
}

export async function listReviewItems() {
  return db
    .select()
    .from(items)
    .where(and(isNull(items.doneAt), inArray(items.matchStatus, ["needs_review", "unmatched"])))
    .orderBy(items.kind, items.title);
}

export async function countReview() {
  const rows = await db
    .select({ id: items.id })
    .from(items)
    .where(and(isNull(items.doneAt), inArray(items.matchStatus, ["needs_review", "unmatched"])));
  return rows.length;
}

export async function listPeople(): Promise<Person[]> {
  return db.select({ userId: profiles.userId, name: profiles.name, image: profiles.image }).from(profiles);
}
