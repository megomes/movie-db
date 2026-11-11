import { SwitchView } from "@/components/switch-view";
import { backlogByIgdb, listSwitchGames, switchTagId } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Meu Switch" };

export default async function SwitchPage() {
  const user = await requireUser();
  const games = await listSwitchGames(user.id);
  const [backlog, tagId] = await Promise.all([
    backlogByIgdb(user.id, games.map((g) => g.igdbId).filter((x): x is number => x != null)),
    switchTagId(user.id),
  ]);

  return (
    <SwitchView
      switchTagId={tagId}
      backlog={backlog}
      games={games.map((g) => ({ id: g.id, title: g.title, sizeMb: g.sizeMb, igdbId: g.igdbId, coverUrl: g.coverUrl, screenshots: g.screenshots }))}
    />
  );
}
