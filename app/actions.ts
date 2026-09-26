"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, items, profiles, pushSubscriptions, type Kind } from "@/lib/db";
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

export async function addItem(kind: string, externalId: string, myPlatforms: string[] = []) {
  const user = await requireUser();
  const k = assertKind(kind);
  const data = await enrich(k, externalId);
  const [row] = await db
    .insert(items)
    .values({ title: "", ...data, kind: k, myPlatforms, ownerId: user.id, source: "manual", matchStatus: "matched" })
    .returning({ id: items.id });
  refresh();
  return row.id;
}

export async function addFromImdb(imdbId: string) {
  await requireUser();
  const found = await findByImdbId(imdbId);
  if (!found) return null;
  return addItem(found.kind, String(found.id));
}

// Traz um item do backlog de outra pessoa para o seu (copia os dados, sem notas)
export async function copyToMine(itemId: string) {
  const user = await requireUser();
  const [src] = await db.select().from(items).where(eq(items.id, itemId));
  if (!src) throw new Error("Item não encontrado");
  const { id: _id, notes: _n, ownerId: _o, pinned: _p, createdAt: _c, doneAt: _d, source: _s, sourcePath: _sp, ...rest } = src;
  void [_id, _n, _o, _p, _c, _d, _s, _sp];
  const [row] = await db
    .insert(items)
    .values({ ...rest, ownerId: user.id, source: "copy" })
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

export async function setMyPlatforms(itemId: string, platforms: string[]) {
  await own(itemId);
  await db.update(items).set({ myPlatforms: platforms }).where(eq(items.id, itemId));
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
