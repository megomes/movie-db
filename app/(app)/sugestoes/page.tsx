import { AiPicksView } from "@/components/ai-picks-view";
import { backlogByIgdb, listAiSuggestions } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Sugestões das IAs" };

export default async function AiPicksPage() {
  const user = await requireUser();
  const games = await listAiSuggestions(user.id);
  const backlog = await backlogByIgdb(
    user.id,
    games.map((g) => g.igdbId),
  );
  return <AiPicksView games={games} backlog={backlog} />;
}
