import { DiscoverView } from "@/components/discover-view";
import { getDiscoverGroups, getMetacriticGroups, isListId, isPlatformId, LISTS, listMetacriticLists, listsFor, PLATFORMS } from "@/lib/discover";
import { backlogByIgdb, listSwitchGames } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Descobrir jogos" };

export default async function DiscoverPage({ searchParams }: PageProps<"/descobrir">) {
  const user = await requireUser();
  const sp = await searchParams;
  const platform = isPlatformId(sp.plataforma) ? sp.plataforma : PLATFORMS[0].id;
  // Lista que não existe na plataforma (Metacritic no Android) cai na primeira
  const list = isListId(sp.lista) && listsFor(platform).some((l) => l.id === sp.lista) ? sp.lista : LISTS[0].id;

  // Metacritic: as listas guardadas no banco; a escolhida vem em ?mc= (ex.: "top", "ano-2025", "genero-roguelike")
  const mcLists = list === "mc" ? await listMetacriticLists(platform) : [];
  const mc = mcLists.find((l) => l.id === `${platform}/${sp.mc}`) ?? mcLists[0] ?? null;

  const [groups, installed] = await Promise.all([
    list === "mc" ? (mc ? getMetacriticGroups(mc.id) : []) : getDiscoverGroups(platform, list),
    platform === "switch" ? listSwitchGames(user.id) : [],
  ]);
  const backlog = await backlogByIgdb(user.id, groups.flatMap((g) => g.games.map((x) => x.igdbId)));
  const slug = (id: string) => id.slice(id.indexOf("/") + 1);

  return (
    <DiscoverView
      key={`${platform}-${list}-${mc?.id ?? ""}`}
      platform={platform}
      list={list}
      groups={groups}
      backlog={backlog}
      installed={installed.map((g) => g.igdbId).filter((x): x is number => x != null)}
      mc={
        list === "mc"
          ? { lists: mcLists.map((l) => ({ slug: slug(l.id), label: l.label, group: l.group })), selected: mc ? slug(mc.id) : null, url: mc?.url ?? null }
          : undefined
      }
    />
  );
}
