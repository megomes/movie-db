import Link from "next/link";
import type { Item } from "@/lib/db/schema";
import { accessFor } from "@/lib/kinds";
import { Cover } from "./cover";

type CardItem = Pick<Item, "id" | "kind" | "title" | "coverUrl" | "availability" | "myPlatforms" | "gamePass" | "steamPrice">;

// Pôster clicável, só arte. Um ponto verde discreto indica "já está no seu streaming".
export function Poster({ item, myProviders, eager }: { item: CardItem; myProviders: number[]; eager?: boolean }) {
  const mine = accessFor(item, myProviders).tier === "mine";
  return (
    <Link href={`/item/${item.id}`} className="press relative block min-w-0" aria-label={item.title}>
      <Cover src={item.coverUrl} title={item.title} eager={eager} />
      {mine && <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-success ring-2 ring-black/60" />}
    </Link>
  );
}
