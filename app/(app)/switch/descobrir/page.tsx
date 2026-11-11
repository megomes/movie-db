import { DiscoverView } from "@/components/discover-view";
import { getDiscoverList, isListId, isPeriodId, LISTS } from "@/lib/discover";
import { backlogByIgdb, listSwitchGames, switchTagId } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Descobrir jogos de Switch" };

export default async function DiscoverPage({ searchParams }: PageProps<"/switch/descobrir">) {
  const user = await requireUser();
  const sp = await searchParams;
  const list = isListId(sp.lista) ? sp.lista : LISTS[0].id;
  const period = list === "top" && isPeriodId(sp.periodo) ? sp.periodo : "todos";

  const [games, installed, tagId] = await Promise.all([getDiscoverList(list, period), listSwitchGames(user.id), switchTagId(user.id)]);
  const backlog = await backlogByIgdb(user.id, games.map((g) => g.igdbId));

  return (
    <DiscoverView
      key={`${list}-${period}`}
      list={list}
      period={period}
      games={games}
      backlog={backlog}
      installed={installed.map((g) => g.igdbId).filter((x): x is number => x != null)}
      switchTagId={tagId}
    />
  );
}
