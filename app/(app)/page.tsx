import { HomeView } from "@/components/home-view";
import { daySeed } from "@/lib/kinds";
import { listIdeas } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Início" };

export default async function Home() {
  const user = await requireUser();
  // Ideias do backlog das outras pessoas: guiam o primeiro acesso e viram uma prateleira depois
  const ideas = await listIdeas(user.id);
  return <HomeView seed={daySeed()} ideas={ideas} />;
}
