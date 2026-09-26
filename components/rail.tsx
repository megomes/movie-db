import Link from "next/link";
import type { LiteItem } from "@/lib/queries";
import { Poster } from "./item-card";

// Trilho horizontal: título à esquerda, "Ver tudo" discreto à direita, pôsteres 120x180
export function Rail({
  title,
  href,
  items,
  myProviders,
  empty,
}: {
  title: string;
  href?: string;
  items: LiteItem[];
  myProviders: number[];
  empty?: React.ReactNode;
}) {
  if (!items.length && !empty) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between px-4">
        <h2 className="text-[20px] font-semibold leading-tight">{title}</h2>
        {href && items.length > 0 && (
          <Link href={href} className="text-sm text-text-2">
            Ver tudo
          </Link>
        )}
      </div>
      {items.length ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
          {items.slice(0, 20).map((i) => (
            <div key={i.id} className="w-[120px] shrink-0">
              <Poster item={i} myProviders={myProviders} />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 text-sm text-text-2">{empty}</div>
      )}
    </section>
  );
}
