"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronRight as Arrow } from "lucide-react";
import { KIND_META, scoreLabel } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { Cover } from "./cover";
import { attachDragScroll } from "./drag-scroll";
import { isMixed, KIND_ICONS } from "./kind-icon";
import { Poster } from "./poster";

export const GUTTER = "px-4 sm:px-6 lg:px-10";

export function useRailScroll() {
  const el = useRef<HTMLDivElement | null>(null);
  // Onde a rolagem está: as setas só aparecem quando há pra onde ir
  const [edges, setEdges] = useState({ start: true, end: false });
  const ref = useCallback((node: HTMLDivElement | null) => {
    el.current = node;
    if (!node) return;
    const update = () => {
      const start = node.scrollLeft < 8;
      const end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 8;
      setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(node);
    const detachDrag = attachDragScroll(node);
    return () => {
      node.removeEventListener("scroll", update);
      ro.disconnect();
      detachDrag();
    };
  }, []);
  const by = (dir: 1 | -1) => el.current?.scrollBy({ left: dir * el.current.clientWidth * 0.85, behavior: "smooth" });
  return { ref, by, edges };
}

function RailHeader({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-4 ${GUTTER}`}>
      <div>
        <h2 className="text-[20px] font-bold tracking-tight lg:text-[24px]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-text-2">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="group flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-text-2 hover:text-white">
          Ver tudo <Arrow size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

// Sem vidro (backdrop-filter pisca no Firefox sobre os pôsteres animados) e só quando dá pra rolar:
// uma seta invisível por cima do primeiro pôster roubava o hover e fazia ele piscar
export function Arrows({ by, edges }: { by: (d: 1 | -1) => void; edges: { start: boolean; end: boolean } }) {
  const cls =
    "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#0b0f17]/90 shadow-[0_8px_24px_rgb(0_0_0/0.5)] ring-1 ring-white/15 opacity-0 transition-opacity duration-200 hover:bg-[#161c28] group-hover/rail:opacity-100 lg:flex";
  return (
    <>
      {!edges.start && (
        <button onClick={() => by(-1)} className={`${cls} left-3`} aria-label="Anterior">
          <ChevronLeft size={22} />
        </button>
      )}
      {!edges.end && (
        <button onClick={() => by(1)} className={`${cls} right-3`} aria-label="Próximo">
          <ChevronRight size={22} />
        </button>
      )}
    </>
  );
}

// Trilho horizontal com snap, setas no desktop e bordas esfumaçadas
export function Rail({
  title,
  subtitle,
  href,
  items,
  morphIds,
  empty,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  items: LiteItem[];
  morphIds?: Set<string>;
  empty?: React.ReactNode;
}) {
  const { ref, by, edges } = useRailScroll();
  if (!items.length && !empty) return null;
  const mixed = isMixed(items);
  return (
    <section className="rise">
      <RailHeader title={title} subtitle={subtitle} href={items.length ? href : undefined} />
      {items.length ? (
        <div className="group/rail relative">
          <div ref={ref} className={`no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overflow-y-hidden py-3 lg:scroll-px-10 lg:gap-4 ${GUTTER}`}>
            {items.slice(0, 24).map((i) => (
              <div key={i.id} className="w-[128px] shrink-0 snap-start sm:w-[150px] lg:w-[172px] 2xl:w-[196px]">
                <Poster item={i} morph={morphIds?.has(i.id)} kindIcon={mixed} />
              </div>
            ))}
          </div>
          <Arrows by={by} edges={edges} />
        </div>
      ) : (
        <div className={GUTTER}>{empty}</div>
      )}
    </section>
  );
}

// Top 10 com números gigantes vazados atrás dos pôsteres
export function TopTen({ items, morphIds }: { items: LiteItem[]; morphIds?: Set<string> }) {
  const { ref, by, edges } = useRailScroll();
  if (items.length < 3) return null;
  const mixed = isMixed(items);
  return (
    <section className="rise">
      <RailHeader title="Top 10 do seu backlog" subtitle="Os mais bem avaliados de cada tipo" />
      <div className="group/rail relative">
        <div ref={ref} className={`no-scrollbar flex snap-x snap-mandatory gap-1 overflow-x-auto overflow-y-hidden pb-3 pt-4 ${GUTTER}`}>
          {items.slice(0, 10).map((i, idx) => (
            <Link key={i.id} href={`/item/${i.id}`} className="group flex shrink-0 snap-start items-end">
              <span
                className="-mr-5 select-none text-[118px] font-black leading-none tracking-[-0.08em] text-transparent transition-colors duration-300 group-hover:text-white/10 lg:-mr-7 lg:text-[168px]"
                style={{ WebkitTextStroke: "2px rgb(148 163 184 / 0.45)" }}
              >
                {idx + 1}
              </span>
              <div className="relative w-[104px] transition-transform duration-300 group-hover:-translate-y-1.5 lg:w-[140px]">
                <Cover item={i} morph={morphIds?.has(i.id)} rounded="rounded-xl" />
                <TopBadge item={i} showKind={mixed} />
              </div>
            </Link>
          ))}
        </div>
        <Arrows by={by} edges={edges} />
      </div>
    </section>
  );
}

// Selo do Top 10: tipo (quando mistura) + nota com a fonte, como no destaque da home
function TopBadge({ item, showKind }: { item: LiteItem; showKind: boolean }) {
  const Icon = KIND_ICONS[item.kind];
  const score = scoreLabel(item);
  if (!score && !showKind) return null;
  return (
    <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-lg bg-black/65 p-0.5 pr-1 text-[11px] font-bold ring-1 ring-white/10">
      {showKind && (
        <span className="flex h-5 w-5 items-center justify-center">
          <Icon size={12} strokeWidth={2.4} aria-label={KIND_META[item.kind].label} />
        </span>
      )}
      {score && (
        <span className={`rounded-md px-1.5 py-px ${score.source === "IMDb" ? "bg-[#f5c518] text-black" : "bg-white/90 text-black"}`}>
          {score.source} {score.value}
        </span>
      )}
    </span>
  );
}
