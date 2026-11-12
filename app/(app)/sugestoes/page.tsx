import { AiPicksView } from "@/components/ai-picks-view";
import type { AiKind } from "@/lib/ai-picks";
import { backlogByIgdb, backlogByTmdb, listAiSuggestions } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Sugestões das IAs" };

export default async function AiPicksPage({ searchParams }: PageProps<"/sugestoes">) {
  const user = await requireUser();
  const k = (await searchParams).k;
  const kind: AiKind = k === "movie" || k === "series" ? k : "game";
  const games = await listAiSuggestions(user.id, kind);
  const refs = games.map((g) => g.ref);
  const backlog = kind === "game" ? await backlogByIgdb(user.id, refs) : await backlogByTmdb(user.id, kind, refs);
  return <AiPicksView key={kind} kind={kind} games={games} backlog={backlog} />;
}
