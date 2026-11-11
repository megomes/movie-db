import { and, desc, eq, inArray } from "drizzle-orm";
import { SwitchView } from "@/components/switch-view";
import { db, items, switchGames, tags } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Meu Switch" };

export default async function SwitchPage() {
  const user = await requireUser();
  const games = await db.select().from(switchGames).where(eq(switchGames.ownerId, user.id)).orderBy(desc(switchGames.sizeMb));
  const ids = games.map((g) => g.igdbId).filter((x): x is number => x != null);
  const [owned, [switchTag]] = await Promise.all([
    ids.length
      ? db
          .select({ id: items.id, igdbId: items.igdbId, doneAt: items.doneAt })
          .from(items)
          .where(and(eq(items.ownerId, user.id), eq(items.kind, "game"), inArray(items.igdbId, ids)))
      : [],
    db.select({ id: tags.id }).from(tags).where(and(eq(tags.ownerId, user.id), eq(tags.kind, "game"), eq(tags.name, "Switch"))),
  ]);
  const byIgdb = new Map(owned.map((o) => [o.igdbId, { id: o.id, done: !!o.doneAt }]));

  return (
    <SwitchView
      switchTagId={switchTag?.id ?? null}
      games={games.map((g) => ({
        id: g.id,
        title: g.title,
        sizeMb: g.sizeMb,
        igdbId: g.igdbId,
        coverUrl: g.coverUrl,
        screenshots: g.screenshots,
        item: (g.igdbId != null && byIgdb.get(g.igdbId)) || null,
      }))}
    />
  );
}
