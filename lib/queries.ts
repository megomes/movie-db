import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { asc } from "drizzle-orm";
import { db, items, profiles, switchGames, tags, type Item } from "@/lib/db";
import { hoursOf } from "@/lib/kinds";

export type Person = { userId: string; name: string | null; image: string | null; email: string };

export async function listItems(ownerId: string) {
  return db
    .select()
    .from(items)
    .where(and(eq(items.ownerId, ownerId), isNull(items.doneAt)))
    .orderBy(desc(items.createdAt));
}

// Lista compartilhada (ex.: Livros da família): igual para todo mundo
export async function listCollection(ownerId: string) {
  const rows = await db
    .select()
    .from(items)
    .where(and(eq(items.ownerId, ownerId), isNull(items.doneAt)))
    .orderBy(desc(items.createdAt));
  return rows.map(toLite);
}

export async function countDone(ownerId: string) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(items).where(and(eq(items.ownerId, ownerId), isNotNull(items.doneAt)));
  return row?.n ?? 0;
}

// Horas somadas de tudo que já foi visto (rodapé)
export async function doneHours(ownerId: string) {
  const rows = await db
    .select({ kind: items.kind, minutes: items.minutes, seasons: items.seasons, pages: items.pages })
    .from(items)
    .where(and(eq(items.ownerId, ownerId), isNotNull(items.doneAt)));
  return rows.reduce((s, i) => s + hoursOf(i), 0);
}

// Histórico: o que a pessoa já viu/jogou/leu, mais recente primeiro
export async function listDone(ownerId: string) {
  const rows = await db
    .select()
    .from(items)
    .where(and(eq(items.ownerId, ownerId), isNotNull(items.doneAt)))
    .orderBy(desc(items.doneAt));
  return rows.map(toLite);
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

export async function listTags(ownerId: string) {
  return db
    .select({ id: tags.id, kind: tags.kind, name: tags.name, position: tags.position })
    .from(tags)
    .where(eq(tags.ownerId, ownerId))
    .orderBy(tags.kind, asc(tags.position), tags.name);
}
export type TagLite = Awaited<ReturnType<typeof listTags>>[number];

export async function listPeople(): Promise<Person[]> {
  return db.select({ userId: profiles.userId, name: profiles.name, image: profiles.image, email: profiles.email }).from(profiles);
}

// Ideias: o melhor do backlog das outras pessoas que ainda não está no seu, intercalando os tipos
export type Ideas = { items: LiteItem[]; from: Pick<Person, "userId" | "name" | "image">[] };
export async function listIdeas(meId: string, limit = 20): Promise<Ideas> {
  const [mine, rows] = await Promise.all([
    db.select({ kind: items.kind, tmdbId: items.tmdbId, igdbId: items.igdbId, googleBooksId: items.googleBooksId, title: items.title }).from(items).where(and(eq(items.ownerId, meId), isNull(items.doneAt))),
    db
      .select({ item: items, person: { userId: profiles.userId, name: profiles.name, image: profiles.image, email: profiles.email } })
      .from(items)
      .innerJoin(profiles, eq(profiles.userId, items.ownerId))
      .where(and(ne(items.ownerId, meId), isNull(items.doneAt), isNotNull(items.coverUrl), eq(items.matchStatus, "matched")))
      .orderBy(desc(items.pinned), sql`${items.score} desc nulls last`)
      .limit(400),
  ]);
  const seen = new Set(mine.map(workKey));
  const byKind = new Map<string, typeof rows>();
  for (const row of rows) {
    if (row.person.email.endsWith(".test") || seen.has(workKey(row.item))) continue;
    seen.add(workKey(row.item));
    byKind.set(row.item.kind, [...(byKind.get(row.item.kind) ?? []), row]);
  }
  const queues = [...byKind.values()];
  const out: typeof rows = [];
  while (out.length < limit && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < limit) out.push(q.shift()!);
  const from = new Map(out.map(({ person: { userId, name, image } }) => [userId, { userId, name, image }]));
  return { items: out.map((r) => toLite(r.item)), from: [...from.values()] };
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
    logoUrl: i.logoUrl,
    category: i.category,
    overview: (i.summary ?? i.overview)?.slice(0, 240) ?? null,
    genres: i.genres,
    creators: i.creators,
    ratings: i.ratings,
    score: i.score,
    availability: i.availability,
    platforms: i.platforms,
    myPlatforms: i.myPlatforms,
    gamePass: i.gamePass,
    steamPrice: i.steamPrice,
    minutes: i.minutes,
    pages: i.pages,
    seasons: i.seasons,
    priority: i.priority,
    pinned: i.pinned,
    tagIds: i.tagIds,
    matchStatus: i.matchStatus,
    createdAt: i.createdAt.toISOString(),
    doneAt: i.doneAt?.toISOString() ?? null,
  };
}

// Mesma obra em backlogs diferentes: compara pelos IDs das APIs
const workKey = (i: Pick<Item, "kind" | "tmdbId" | "igdbId" | "googleBooksId" | "title">) =>
  `${i.kind}:${i.tmdbId ?? i.igdbId ?? i.googleBooksId ?? i.title.toLowerCase()}`;

export type Shared = { userId: string; name: string | null; image: string | null; total: number; count: number; mineIds: string[]; theirIds: string[] };

// Para cada outra pessoa: quais itens meus também estão no backlog dela
export async function listShared(meId: string): Promise<Shared[]> {
  const cols = { id: items.id, ownerId: items.ownerId, kind: items.kind, tmdbId: items.tmdbId, igdbId: items.igdbId, googleBooksId: items.googleBooksId, title: items.title };
  const [mine, others, people] = await Promise.all([
    db.select(cols).from(items).where(and(eq(items.ownerId, meId), isNull(items.doneAt))),
    db.select(cols).from(items).where(and(ne(items.ownerId, meId), isNull(items.doneAt))),
    listPeople(),
  ]);
  return people
    .filter((p) => p.userId !== meId && !p.email.endsWith(".test"))
    .map((p) => {
      const theirs = others.filter((o) => o.ownerId === p.userId);
      const byKey = new Map(theirs.map((t) => [workKey(t), t.id]));
      const pairs = mine.filter((m) => byKey.has(workKey(m)));
      return { userId: p.userId, name: p.name, image: p.image, total: theirs.length, count: pairs.length, mineIds: pairs.map((m) => m.id), theirIds: pairs.map((m) => byKey.get(workKey(m))!) };
    });
}

// Jogos do backlog (inclusive zerados) por ID do IGDB: marca quais já estão lá
export async function backlogByIgdb(ownerId: string, igdbIds: number[]) {
  if (!igdbIds.length) return {};
  const rows = await db
    .select({ id: items.id, igdbId: items.igdbId, doneAt: items.doneAt })
    .from(items)
    .where(and(eq(items.ownerId, ownerId), eq(items.kind, "game"), inArray(items.igdbId, igdbIds)));
  return Object.fromEntries(rows.map((r) => [r.igdbId!, { id: r.id, done: !!r.doneAt }])) as Record<number, { id: string; done: boolean }>;
}

// Tag de jogo da pessoa pelo nome ("Switch", "PC"…): jogos adicionados pelo Descobrir/Meu Switch entram com ela
export async function gameTagId(ownerId: string, name: string) {
  const [t] = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.ownerId, ownerId), eq(tags.kind, "game"), eq(tags.name, name)));
  return t?.id ?? null;
}

export const switchTagId = (ownerId: string) => gameTagId(ownerId, "Switch");

export async function getSwitchGame(ownerId: string, igdbId: number) {
  const [row] = await db
    .select({ id: switchGames.id, sizeMb: switchGames.sizeMb })
    .from(switchGames)
    .where(and(eq(switchGames.ownerId, ownerId), eq(switchGames.igdbId, igdbId)));
  return row ?? null;
}

export async function listSwitchGames(ownerId: string) {
  return db.select().from(switchGames).where(eq(switchGames.ownerId, ownerId)).orderBy(desc(switchGames.sizeMb));
}

// Jogos de Switch no backlog (tag Switch, ainda não zerados) que não estão instalados
export async function switchBacklogNotInstalled(ownerId: string, tagId: string, installedIgdb: number[]) {
  return db
    .select({ id: items.id, title: items.title, igdbId: items.igdbId, coverUrl: items.coverUrl, gallery: items.gallery, minutes: items.minutes })
    .from(items)
    .where(
      and(
        eq(items.ownerId, ownerId),
        eq(items.kind, "game"),
        isNull(items.doneAt),
        sql`${tagId}::uuid = any(${items.tagIds})`,
        installedIgdb.length ? sql`(${items.igdbId} is null or ${items.igdbId} <> all(${sql.raw(`array[${installedIgdb.map(Number).join(",")}]::int[]`)}))` : undefined,
      ),
    )
    .orderBy(desc(items.pinned), desc(items.score));
}
