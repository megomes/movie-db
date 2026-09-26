import Link from "next/link";
import type { Item } from "@/lib/db/schema";
import { accessFor, formatMinutes, KIND_META, scoreLabel, TIER_COLOR } from "@/lib/kinds";
import { Cover } from "./cover";

type CardItem = Pick<
  Item,
  "id" | "kind" | "title" | "year" | "coverUrl" | "ratings" | "score" | "availability" | "myPlatforms" | "gamePass" | "steamPrice" | "minutes" | "pages"
>;

export function ItemCard({ item, myProviders, showKind = false }: { item: CardItem; myProviders: number[]; showKind?: boolean }) {
  const score = scoreLabel(item);
  const access = accessFor(item, myProviders);
  const length = item.kind === "book" ? (item.pages ? `${item.pages} pág.` : null) : formatMinutes(item.minutes, item.kind);
  return (
    <Link href={`/item/${item.id}`} className="group block min-w-0 active:scale-[0.97] transition-transform">
      <div className="relative">
        <Cover src={item.coverUrl} title={item.title} kind={item.kind} />
        {score && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-accent backdrop-blur">
            ★ {score.value}
          </span>
        )}
        {showKind && (
          <span
            className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-black/60"
            style={{ background: KIND_META[item.kind].color }}
            title={KIND_META[item.kind].label}
          />
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="truncate text-[13px] font-medium leading-tight">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TIER_COLOR[access.tier] }} />
          <span className="truncate">{access.tier === "unknown" || item.kind === "book" ? [item.year, length].filter(Boolean).join(" · ") : access.label}</span>
        </p>
      </div>
    </Link>
  );
}
