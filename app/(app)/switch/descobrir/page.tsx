import { DiscoverView } from "@/components/discover-view";
import { getDiscoverList, isListId, LISTS } from "@/lib/discover";
import { backlogByIgdb, listSwitchGames, switchTagId } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Descobrir jogos de Switch" };

export default async function DiscoverPage({ searchParams }: PageProps<"/switch/descobrir">) {
  const user = await requireUser();
  const param = (await searchParams).lista;
  const list = isListId(param) ? param : LISTS[0].id;

  const [games, installed, tagId] = await Promise.all([getDiscoverList(list), listSwitchGames(user.id), switchTagId(user.id)]);
  const backlog = await backlogByIgdb(user.id, games.map((g) => g.igdbId));

  return (
    <DiscoverView
      key={list}
      list={list}
      games={games}
      backlog={backlog}
      installed={Object.fromEntries(installed.filter((g) => g.igdbId != null).map((g) => [g.igdbId!, { id: g.id, sizeMb: g.sizeMb }]))}
      switchTagId={tagId}
    />
  );
}
