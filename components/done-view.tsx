"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CircleCheckBig } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { KIND_META, KINDS } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { DoneStats } from "./done-stats";
import { KIND_ICONS } from "./kind-icon";
import { Poster } from "./poster";
import { GUTTER } from "./rail";

const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

// Histórico do que já foi visto/jogado/lido, com estatísticas e filtro por tipo
export function DoneView({ items }: { items: LiteItem[] }) {
  const [kind, setKind] = useState<Kind | "all">("all");
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, items.filter((i) => i.kind === k).length])) as Record<Kind, number>, [items]);
  const list = useMemo(() => (kind === "all" ? items : items.filter((i) => i.kind === kind)), [items, kind]);
  const months = useMemo(() => {
    const m = new Map<string, LiteItem[]>();
    for (const i of list) {
      const label = month.format(new Date(i.doneAt!));
      const key = label[0].toUpperCase() + label.slice(1);
      m.set(key, [...(m.get(key) ?? []), i]);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <div className="mx-auto max-w-[1600px] pb-10 pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28">
      <header className={GUTTER}>
        <p className="text-[13px] font-medium text-text-2">Seu histórico</p>
        <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">Vistos</h1>
      </header>

      {/* Filtro por tipo */}
      {items.length > 0 && (
        <div className={`no-scrollbar mt-5 flex gap-2 overflow-x-auto ${GUTTER}`}>
          {(["all", ...KINDS] as const)
            .filter((k) => k === "all" || counts[k])
            .map((k) => {
              const on = kind === k;
              const Icon = k === "all" ? CircleCheckBig : KIND_ICONS[k];
              return (
                <button key={k} onClick={() => setKind(k)} className={`tap relative flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium ${on ? "text-white" : "glass text-white/75 hover:text-white"}`}>
                  {on && <motion.span layoutId="done-kind" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <Icon size={16} className="relative" />
                  <span className="relative">{k === "all" ? "Tudo" : KIND_META[k].plural}</span>
                  <span className="relative opacity-60">{k === "all" ? items.length : counts[k]}</span>
                </button>
              );
            })}
        </div>
      )}

      {/* Estatísticas (esqueleto explicativo quando ainda tem pouca coisa) */}
      <div className={`mt-5 ${GUTTER}`}>
        <DoneStats list={list} kind={kind} />
      </div>

      {!items.length && (
        <div className={`mt-6 flex justify-center ${GUTTER}`}>
          <Link href="/lista" className="btn-accent lift flex h-11 items-center rounded-full px-6 text-[15px] font-semibold">
            Ir pro backlog
          </Link>
        </div>
      )}

      {/* Linha do tempo por mês */}
      <div className="mt-10 space-y-10">
        {months.map(([m, group]) => (
          <section key={m}>
            <h2 className={`mb-3 text-[18px] font-bold tracking-tight lg:text-[22px] ${GUTTER}`}>
              {m} <span className="text-[13px] font-semibold text-text-3">{group.length}</span>
            </h2>
            <div className={`grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-5 2xl:grid-cols-8 ${GUTTER}`}>
              {group.map((i) => (
                <div key={i.id}>
                  <Poster item={i} kindIcon={kind === "all"} />
                  <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-text-2">
                    <CircleCheckBig size={12} className="text-success" /> {day.format(new Date(i.doneAt!))}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
