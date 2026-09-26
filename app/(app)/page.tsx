import { HomeView } from "@/components/home-view";
import { daySeed } from "@/lib/kinds";

export const metadata = { title: "Início" };

export default function Home() {
  return <HomeView seed={daySeed()} />;
}
