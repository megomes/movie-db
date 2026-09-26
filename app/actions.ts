"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, items, profiles, pushSubscriptions, tags, type Kind } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enrich, searchCandidates } from "@/lib/enrich";
import { findByImdbId, searchTmdbMulti } from "@/lib/sources/tmdb";

const KINDS = new Set<Kind>(["movie", "series", "game", "book"]);
const assertKind = (k: string): Kind => {
  if (!KINDS.has(k as Kind)) throw new Error("Tipo inválido");
  return k as Kind;
};

function refresh(id?: string) {
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/item/${id}`);
}

// Só o dono mexe no próprio backlog
async function own(itemId: string) {
  const user = await requireUser();
  const [row] = await db.select().from(items).where(and(eq(items.id, itemId), eq(items.ownerId, user.id)));
  if (!row) throw new Error("Item não encontrado no seu backlog");
  return { user, item: row };
}

export async function togglePin(itemId: string) {
  const { item } = await own(itemId);
  await db.update(items).set({ pinned: !item.pinned }).where(eq(items.id, itemId));
  refresh(itemId);
  return !item.pinned;
}

// "Visto" = some da lista. Guarda done_at por 1 dia para permitir desfazer; o cron apaga depois.
export async function markDone(itemId: string) {
  await own(itemId);
  await db.update(items).set({ doneAt: new Date() }).where(eq(items.id, itemId));
  refresh(itemId);
}

export async function undoDone(itemId: string) {
  await own(itemId);
  await db.update(items).set({ doneAt: null }).where(eq(items.id, itemId));
  refresh(itemId);
}

export async function deleteItem(itemId: string) {
  await own(itemId);
  await db.delete(items).where(eq(items.id, itemId));
  refresh();
}

export async function updateNotes(itemId: string, notes: string) {
  await own(itemId);
  await db.update(items).set({ notes: notes.trim() || null }).where(eq(items.id, itemId));
  refresh(itemId);
}

export async function searchAction(kind: string, query: string) {
  await requireUser();
  const q = query.trim();
  if (!q) return [];
  if (kind === "any") {
    const [av, games, books] = await Promise.allSettled([searchTmdbMulti(q), searchCandidates("game", q), searchCandidates("book", q)]);
    const ok = <T,>(r: PromiseSettledResult<T[]>) => (r.status === "fulfilled" ? r.value : []);
    return [
      ...ok(av),
      ...ok(games).slice(0, 6).map((c) => ({ ...c, kind: "game" as const })),
      ...ok(books).slice(0, 6).map((c) => ({ ...c, kind: "book" as const })),
    ].map(({ externalId, title, year, cover, subtitle, kind }) => ({ externalId, title, year, cover, subtitle, kind }));
  }
  const k = assertKind(kind);
  const results = await searchCandidates(k, q);
  return results.map(({ externalId, title, year, cover, subtitle }) => ({ externalId, title, year, cover, subtitle, kind: k }));
}

// Só aceita tags do próprio usuário e da mesma divisão; devolve também os campos legados sincronizados
async function validTags(ownerId: string, kind: Kind, tagIds: string[]) {
  if (!tagIds.length) return { tagIds: [] as string[], names: [] as string[] };
  const rows = await db
    .select()
    .from(tags)
    .where(and(eq(tags.ownerId, ownerId), eq(tags.kind, kind), inArray(tags.id, tagIds)))
    .orderBy(tags.position);
  return { tagIds: rows.map((r) => r.id), names: rows.map((r) => r.name) };
}
const legacyFields = (kind: Kind, names: string[]) =>
  kind === "game" ? { myPlatforms: names } : kind === "book" ? { category: names[0] ?? null } : {};

export async function addItem(kind: string, externalId: string, tagIds: string[] = []) {
  const user = await requireUser();
  const k = assertKind(kind);
  const [data, t] = await Promise.all([enrich(k, externalId), validTags(user.id, k, tagIds)]);
  const [row] = await db
    .insert(items)
    .values({ title: "", ...data, kind: k, ownerId: user.id, source: "manual", matchStatus: "matched", tagIds: t.tagIds, ...legacyFields(k, t.names) })
    .returning({ id: items.id });
  refresh();
  return row.id;
}

// Link do IMDb compartilhado: descobre o tipo antes de perguntar as tags
export async function resolveImdb(imdbId: string) {
  await requireUser();
  const found = await findByImdbId(imdbId);
  return found ? { kind: found.kind, externalId: String(found.id) } : null;
}

export async function setItemTags(itemId: string, tagIds: string[]) {
  const { user, item } = await own(itemId);
  const t = await validTags(user.id, item.kind, tagIds);
  await db.update(items).set({ tagIds: t.tagIds, ...legacyFields(item.kind, t.names) }).where(eq(items.id, itemId));
  refresh(itemId);
}

export async function createTag(kind: string, name: string) {
  const user = await requireUser();
  const k = assertKind(kind);
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error("Nome vazio");
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${tags.position}), 0)` })
    .from(tags)
    .where(and(eq(tags.ownerId, user.id), eq(tags.kind, k)));
  const [row] = await db
    .insert(tags)
    .values({ ownerId: user.id, kind: k, name: clean, position: Number(max) + 1 })
    .onConflictDoUpdate({ target: [tags.ownerId, tags.kind, tags.name], set: { name: clean } })
    .returning({ id: tags.id, kind: tags.kind, name: tags.name, position: tags.position });
  refresh();
  return row;
}

export async function renameTag(tagId: string, name: string) {
  const user = await requireUser();
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error("Nome vazio");
  const [tag] = await db.select().from(tags).where(and(eq(tags.id, tagId), eq(tags.ownerId, user.id)));
  if (!tag) throw new Error("Tag não encontrada");
  await db.update(tags).set({ name: clean }).where(eq(tags.id, tagId));
  // Mantém os campos legados coerentes
  if (tag.kind === "book") await db.update(items).set({ category: clean }).where(and(eq(items.ownerId, user.id), eq(items.category, tag.name)));
  if (tag.kind === "game")
    await db.execute(sql`UPDATE items SET my_platforms = array_replace(my_platforms, ${tag.name}, ${clean}) WHERE owner_id = ${user.id} AND kind = game`);
  refresh();
}

export async function deleteTag(tagId: string) {
  const user = await requireUser();
  const [tag] = await db.select().from(tags).where(and(eq(tags.id, tagId), eq(tags.ownerId, user.id)));
  if (!tag) return;
  await db.execute(sql`UPDATE items SET tag_ids = array_remove(tag_ids, ${tagId}::uuid) WHERE owner_id = ${user.id}`);
  if (tag.kind === "book") await db.update(items).set({ category: null }).where(and(eq(items.ownerId, user.id), eq(items.category, tag.name)));
  if (tag.kind === "game") await db.execute(sql`UPDATE items SET my_platforms = array_remove(my_platforms, ${tag.name}) WHERE owner_id = ${user.id} AND kind = game`);
  await db.delete(tags).where(eq(tags.id, tagId));
  refresh();
}

// Traz um item do backlog de outra pessoa para o seu (copia os dados, sem notas)
export async function copyToMine(itemId: string, tagIds: string[] = []) {
  const user = await requireUser();
  const [src] = await db.select().from(items).where(eq(items.id, itemId));
  if (!src) throw new Error("Item não encontrado");
  const { id: _id, notes: _n, ownerId: _o, pinned: _p, createdAt: _c, doneAt: _d, source: _s, sourcePath: _sp, tagIds: _t, ...rest } = src;
  void [_id, _n, _o, _p, _c, _d, _s, _sp, _t];
  const t = await validTags(user.id, src.kind, tagIds);
  const [row] = await db
    .insert(items)
    .values({ ...rest, ownerId: user.id, source: "copy", tagIds: t.tagIds, ...legacyFields(src.kind, t.names) })
    .returning({ id: items.id });
  refresh();
  return row.id;
}

// Troca a correspondência de um item (tela Revisar ou detalhe), mantendo notas/prioridade/plataformas
export async function rematch(itemId: string, kind: string, externalId: string) {
  const { item: current } = await own(itemId);
  const k = assertKind(kind);
  const data = await enrich(k, externalId, { author: current.creators[0] });
  await db
    .update(items)
    .set({ ...data, kind: k, creators: data.creators?.length ? data.creators : current.creators, matchStatus: "matched", candidates: [] })
    .where(eq(items.id, itemId));
  refresh(itemId);
}

export async function confirmMatch(itemId: string) {
  await own(itemId);
  await db.update(items).set({ matchStatus: "matched", candidates: [] }).where(eq(items.id, itemId));
  refresh(itemId);
}

export async function reenrich(itemId: string) {
  const { item: current } = await own(itemId);
  const ext = current.kind === "game" ? current.igdbId : current.kind === "book" ? current.googleBooksId : current.tmdbId;
  if (!ext) return;
  const data = await enrich(current.kind, String(ext), { author: current.creators[0] });
  await db
    .update(items)
    .set({ ...data, creators: data.creators?.length ? data.creators : current.creators })
    .where(eq(items.id, itemId));
  refresh(itemId);
}

export async function saveProviders(ids: number[]) {
  const user = await requireUser();
  await db
    .update(profiles)
    .set({ providerIds: ids.filter((n) => Number.isInteger(n)), updatedAt: new Date() })
    .where(eq(profiles.userId, user.id));
  refresh();
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const user = await requireUser();
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, keys: sub.keys, userId: user.id })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { keys: sub.keys, userId: user.id } });
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
}

export async function sendTestPush() {
  const user = await requireUser();
  const { notifyUser } = await import("@/lib/push");
  return notifyUser(user.id, { title: "Tudo certo!", body: "As notificações do Backlog estão funcionando.", url: "/" });
}
