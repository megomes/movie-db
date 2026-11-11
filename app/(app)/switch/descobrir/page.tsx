import { DiscoverView } from "@/components/discover-view";
import { getDiscoverGroups, isListId, LISTS } from "@/lib/discover";
import { backlogByIgdb, listSwitchGames, switchTagId } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Descobrir jogos de Switch" };

export default async function DiscoverPage({ searchParams }: PageProps<"/switch/descobrir">) {
  const user = await requireUser();
  const sp = await searchParams;
  const list = isListId(sp.lista) ? sp.lista : LISTS[0].id;

  const [groups, installed, tagId] = await Promise.all([getDiscoverGroups(list), listSwitchGames(user.id), switchTagId(user.id)]);
  const backlog = await backlogByIgdb(user.id, groups.flatMap((g) => g.games.map((x) => x.igdbId)));

  return (
    <DiscoverView
      key={list}
      list={list}
      groups={groups}
      backlog={backlog}
      installed={installed.map((g) => g.igdbId).filter((x): x is number => x != null)}
      switchTagId={tagId}
    />
  );
}
