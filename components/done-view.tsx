"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CalendarCheck, CircleCheckBig, Clock, FileText, Gamepad2, Sparkles, Trophy, Zap } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { ptGenre } from "@/lib/genres";
import { KIND_META, KINDS } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { KIND_ICONS } from "./kind-icon";
import { Poster } from "./poster";
import { GUTTER } from "./rail";

const DONE_WORD: Record<Kind | "all", string> = { all: "concluídos", movie: "filmes vistos", series: "séries vistas", game: "jogos zerados", book: "livros lidos" };
const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const DAY = 86_400_000;

type Stat = { icon: typeof Clock; value: string; label: string; tone?: string };

function statsFor(list: LiteItem[], kind: Kind | "all"): Stat[] {
  if (!list.length) return [];
  const now = new Date();
  const dates = list.map((i) => new Date(i.doneAt!));
  const thisMonth = dates.filter((d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()).length;
  const out: Stat[] = [{ icon: CircleCheckBig, value: String(list.length), label: DONE_WORD[kind], tone: "#67d87a" }];
  out.push({ icon: CalendarCheck, value: String(thisMonth), label: "este mês" });

  const movieMin = list.filter((i) => i.kind === "movie").reduce((s, i) => s + (i.minutes ?? 0), 0);
  const gameMin = list.filter((i) => i.kind === "game").reduce((s, i) => s + (i.minutes ?? 0), 0);
  const pages = list.filter((i) => i.kind === "book").reduce((s, i) => s + (i.pages ?? 0), 0);
  if (movieMin) out.push({ icon: Clock, value: `${Math.round(movieMin / 60)}h`, label: "de filme" });
  if (gameMin) out.push({ icon: Gamepad2, value: `${Math.round(gameMin / 60)}h`, label: "de jogo" });
  if (pages) out.push({ icon: FileText, value: pages.toLocaleString("pt-BR"), label: "páginas lidas" });

  const genres = new Map<string, number>();
  // "General"/"Geral" (Google Books) não diz nada
  for (const i of list) for (const g of new Set(i.genres.map(ptGenre))) if (!/^(general|geral)$/i.test(g)) genres.set(g, (genres.get(g) ?? 0) + 1);
  const fav = [...genres.entries()].sort((a, b) => b[1] - a[1])[0];
  if (fav && fav[1] > 1) out.push({ icon: Sparkles, value: fav[0], label: "gênero favorito" });

  const best = [...list].filter((i) => i.score != null).sort((a, b) => b.score! - a.score!)[0];
  if (best) out.push({ icon: Trophy, value: best.title, label: "o mais bem avaliado", tone: "#ffd166" });

  const first = Math.min(...dates.map((d) => d.getTime()));
  const days = Math.max(1, Math.round((now.getTime() - first) / DAY));
  if (list.length > 1 && days > 1) out.push({ icon: Zap, value: `1 a cada ${Math.max(1, Math.round(days / list.length))} dia${Math.round(days / list.length) > 1 ? "s" : ""}`, label: "seu ritmo" });
  return out;
}

// Histórico do que já foi visto/jogado/lido, com estatísticas e filtro por tipo
export function DoneView({ items }: { items: LiteItem[] }) {
  const [kind, setKind] = useState<Kind | "all">("all");
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, items.filter((i) => i.kind === k).length])) as Record<Kind, number>, [items]);
  const list = useMemo(() => (kind === "all" ? items : items.filter((i) => i.kind === kind)), [items, kind]);
  const stats = useMemo(() => statsFor(list, kind), [list, kind]);
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

      {!items.length ? (
        <div className={`flex min-h-[50vh] flex-col items-center justify-center text-center ${GUTTER}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-success/15 text-success">
            <CircleCheckBig size={30} />
          </span>
          <h2 className="mt-5 text-[22px] font-bold">Nada por aqui ainda</h2>
          <p className="mt-1.5 max-w-sm text-[14px] text-text-2">Quando você tocar em “Já vi” (ou já joguei, já li) num item, ele sai do backlog e vem pra cá, com as suas estatísticas.</p>
          <Link href="/lista" className="btn-accent lift mt-6 flex h-11 items-center rounded-full px-6 text-[15px] font-semibold">
            Ir pro backlog
          </Link>
        </div>
      ) : (
        <>
          {/* Filtro por tipo */}
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

          {/* Estatísticas */}
          <div className={`mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] ${GUTTER}`}>
            {stats.map((s, i) => (
              <motion.div
                key={`${kind}-${s.label}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                className={`glass min-w-0 rounded-2xl p-3.5 ${s.label === "o mais bem avaliado" ? "col-span-2 sm:col-span-1" : ""}`}
              >
                <s.icon size={17} style={{ color: s.tone ?? "rgb(255 255 255 / 0.6)" }} />
                <p className="mt-2 truncate text-[20px] font-bold leading-tight tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-[12px] text-text-2">{s.label}</p>
              </motion.div>
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}
