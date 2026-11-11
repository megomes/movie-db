import { SwitchView } from "@/components/switch-view";
import { artSrc } from "@/lib/img";
import { backlogByIgdb, listSwitchGames, switchBacklogNotInstalled } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Meu Switch" };

export default async function SwitchPage() {
  const user = await requireUser();
  const games = await listSwitchGames(user.id);
  const igdbIds = games.map((g) => g.igdbId).filter((x): x is number => x != null);
  const [backlog, missing] = await Promise.all([backlogByIgdb(user.id, igdbIds), switchBacklogNotInstalled(user.id, igdbIds)]);

  return (
    <SwitchView
      backlog={backlog}
      games={games.map((g) => ({ id: g.id, title: g.title, sizeMb: g.sizeMb, igdbId: g.igdbId, coverUrl: g.coverUrl, screenshots: g.screenshots }))}
      missing={missing.map((m) => ({
        id: m.id,
        title: m.title,
        igdbId: m.igdbId,
        coverUrl: m.coverUrl,
        screenshots: m.gallery.slice(0, 8).map((u) => artSrc(u, "md")!),
      }))}
    />
  );
}
