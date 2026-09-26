"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, Loader2, Plus } from "lucide-react";
import { copyToMine } from "@/app/actions";
import type { Ideas, LiteItem } from "@/lib/queries";
import { Avatar } from "./people-switch";
import { isMixed } from "./kind-icon";
import { Poster } from "./poster";
import { Arrows, GUTTER, useRailScroll } from "./rail";
import { useTagAsk } from "./tag-picker";

export const firstName = (name: string | null) => name?.split(" ")[0] ?? "alguém";

// Prateleira com o melhor do backlog das outras pessoas: um toque em "+" traz pro seu, sem sair da página
export function IdeasRail({ ideas, title, subtitle }: { ideas: Ideas; title?: string; subtitle?: string }) {
  const { ref, by } = useRailScroll();
  const { ask, picker } = useTagAsk();
  if (!ideas.items.length) return null;
  const solo = ideas.from.length === 1 ? ideas.from[0] : null;
  const mixed = isMixed(ideas.items);

  return (
    <section className="rise">
      {picker}
      <div className={`mb-3 flex items-end justify-between gap-4 ${GUTTER}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 -space-x-2.5">
            {ideas.from.slice(0, 3).map((p) => (
              <Avatar key={p.userId} src={p.image} name={p.name} size={36} ring="ring-bg" />
            ))}
          </span>
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold leading-tight tracking-tight lg:text-[24px]">{title ?? (solo ? `Do backlog de ${firstName(solo.name)}` : "Do backlog da galera")}</h2>
            <p className="mt-0.5 text-[13px] text-text-2">{subtitle ?? "Toque no + pra trazer pro seu"}</p>
          </div>
        </div>
        {solo && (
          <Link href={`/pessoa/${solo.userId}`} aria-label={`Espiar o backlog de ${firstName(solo.name)}`} className="group flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-text-2 hover:text-white">
            <span className="hidden lg:inline">Espiar tudo</span>
            <span className="glass flex h-10 w-10 items-center justify-center rounded-full lg:contents">
              <ChevronRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}
      </div>
      <div className="group/rail relative">
        <div ref={ref} className={`no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overflow-y-hidden py-3 lg:scroll-px-10 lg:gap-4 ${GUTTER}`}>
          <AnimatePresence initial={false} mode="popLayout">
            {ideas.items.map((i) => (
              <motion.div
                key={i.id}
                layout
                exit={{ opacity: 0, scale: 0.6, y: -40, transition: { duration: 0.35 } }}
                className="relative w-[128px] shrink-0 snap-start sm:w-[150px] lg:w-[172px] 2xl:w-[196px]"
              >
                <Poster item={i} kindIcon={mixed} />
                <AddIdea item={i} ask={ask} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <Arrows by={by} />
      </div>
    </section>
  );
}

function AddIdea({ item, ask }: { item: LiteItem; ask: ReturnType<typeof useTagAsk>["ask"] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      disabled={pending || done}
      onClick={() =>
        ask({
          kind: item.kind,
          title: item.title,
          cover: item.coverUrl,
          confirmLabel: "Trazer pro meu backlog",
          onConfirm: (tagIds) =>
            new Promise<void>((resolve) =>
              start(async () => {
                await copyToMine(item.id, tagIds);
                setDone(true);
                resolve();
              }),
            ),
        })
      }
      className={`absolute -bottom-2 -right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full shadow-[0_8px_20px_rgb(0_0_0/0.5)] ring-4 ring-bg transition-colors ${done ? "bg-success text-black" : "btn-accent"}`}
      aria-label={`Trazer ${item.title} pro meu backlog`}
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : done ? <Check size={19} strokeWidth={3} /> : <Plus size={20} strokeWidth={2.5} />}
    </motion.button>
  );
}
