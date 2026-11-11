import { DiscoverView } from "@/components/discover-view";
import { getDiscoverGroups, isListId, isPlatformId, LISTS, PLATFORMS } from "@/lib/discover";
import { backlogByIgdb, listSwitchGames } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Descobrir jogos" };

export default async function DiscoverPage({ searchParams }: PageProps<"/descobrir">) {
  const user = await requireUser();
  const sp = await searchParams;
  const list = isListId(sp.lista) ? sp.lista : LISTS[0].id;
  const platform = isPlatformId(sp.plataforma) ? sp.plataforma : PLATFORMS[0].id;

  const [groups, installed] = await Promise.all([getDiscoverGroups(platform, list), platform === "switch" ? listSwitchGames(user.id) : []]);
  const backlog = await backlogByIgdb(user.id, groups.flatMap((g) => g.games.map((x) => x.igdbId)));

  return (
    <DiscoverView
      key={`${platform}-${list}`}
      platform={platform}
      list={list}
      groups={groups}
      backlog={backlog}
      installed={installed.map((g) => g.igdbId).filter((x): x is number => x != null)}
    />
  );
}
