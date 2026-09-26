/* eslint-disable @next/next/no-img-element -- capas externas */
"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BookOpen, Check, ChevronRight, Clapperboard, Gamepad2, Plus, Search, Tag, Tv } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { coverSrc } from "@/lib/img";
import { KIND_META, KINDS } from "@/lib/kinds";
import type { Ideas } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { firstName, IdeasRail } from "./ideas-rail";
import { GUTTER, Rail } from "./rail";

// Até aqui a home fica no modo "primeiros passos"; depois vira a home normal
export const STARTER_GOAL = 5;

const KIND_CARD: Record<Kind, { icon: typeof Clapperboard; hint: string }> = {
  movie: { icon: Clapperboard, hint: "Aquele que te indicaram e você nunca lembra o nome" },
  series: { icon: Tv, hint: "A que todo mundo comenta e você ainda não começou" },
  game: { icon: Gamepad2, hint: "Os da lista de desejos, com aviso de promoção" },
  book: { icon: BookOpen, hint: "Os da cabeceira e os que você quer comprar" },
};

// Primeiro acesso: busca em destaque, ideias de quem já usa e um checklist curto
export function EmptyHome({ ideas }: { ideas: Ideas }) {
  const { items, me, myProviders, tags } = useBacklog();
  const count = items.length;
  const steps = [
    { done: count >= STARTER_GOAL, label: `Adicione ${STARTER_GOAL} coisas`, hint: `${Math.min(count, STARTER_GOAL)} de ${STARTER_GOAL}`, href: "/adicionar", icon: Plus },
    { done: myProviders.length > 0, label: "Marque seus streamings", hint: "Pra saber o que já está liberado", href: "/ajustes", icon: Tv },
    { done: tags.length > 0, label: "Crie suas tags", hint: "Ex.: PC e Switch, Ficção e Trabalho", href: "/ajustes#tags", icon: Tag },
  ];
  const doneSteps = steps.filter((s) => s.done).length;
  // Os itens contam aos poucos na barra (3 de 5 já aparece)
  const progress = (Math.min(count, STARTER_GOAL) / STARTER_GOAL + steps.slice(1).filter((s) => s.done).length) / steps.length;

  return (
    <div className="mx-auto max-w-[1600px] space-y-10 pb-10 pt-[calc(env(safe-area-inset-top)+18px)] lg:space-y-14 lg:pt-32">
      <header className={`rise relative ${GUTTER}`}>
        <div className="pointer-events-none absolute -top-24 left-0 -z-10 h-[340px] w-[340px] rounded-full bg-accent/25 blur-[110px] lg:left-[10%] lg:h-[480px] lg:w-[480px]" />
        <p className="text-[14px] font-medium text-text-2">Oi, {firstName(me.name)} 👋</p>
        <h1 className="mt-1 max-w-3xl text-[34px] lg:max-w-[640px] font-bold leading-[1.05] tracking-tight lg:text-[60px]">
          {count ? "Seu backlog está ganhando forma" : "Vamos montar seu backlog"}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-2 lg:text-[17px]">
          Tudo o que você quer ver, jogar ou ler num lugar só. O app mostra onde assistir, sugere pelo tempo que você tem e sorteia quando bater a indecisão.
        </p>
        <HeroPosters ideas={ideas} />
        <Link
          href="/adicionar"
          className="glass group mt-6 flex h-14 max-w-xl items-center gap-3 rounded-full pl-5 pr-1.5 transition-colors hover:bg-white/[0.08] lg:h-16"
        >
          <Search size={20} className="text-text-2" />
          <span className="flex-1 truncate text-[16px] text-text-3 lg:text-[17px]">Filme, série, jogo ou livro…</span>
          <span className="btn-accent flex h-11 items-center gap-1.5 rounded-full px-5 text-[15px] font-semibold lg:h-[52px] lg:px-6">
            <Plus size={18} /> Adicionar
          </span>
        </Link>
      </header>

      {/* Primeiros passos */}
      <section className={`rise ${GUTTER}`}>
        <div className="glass rounded-[28px] p-4 lg:p-5">
          <div className="flex items-center justify-between px-1">
            <p className="text-[15px] font-semibold">Primeiros passos</p>
            <p className="text-[13px] tabular-nums text-text-2">
              {doneSteps} de {steps.length}
            </p>
          </div>
          <div className="mx-1 mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className="btn-accent h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.max(6, progress * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
          <div className="mt-3 grid gap-1 lg:grid-cols-3 lg:gap-3">
            {steps.map((s) => (
              <Link key={s.label} href={s.href} className={`flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-white/[0.06] ${s.done ? "opacity-60" : ""}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.done ? "bg-success text-black" : "bg-white/[0.07]"}`}>
                  {s.done ? <Check size={18} strokeWidth={3} /> : <s.icon size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] font-medium ${s.done ? "line-through decoration-white/40" : ""}`}>{s.label}</span>
                  <span className="block truncate text-[12px] text-text-2">{s.hint}</span>
                </span>
                {!s.done && <ChevronRight size={17} className="shrink-0 text-text-3" />}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {count > 0 && <Rail title="No seu backlog" subtitle={`Faltam ${Math.max(0, STARTER_GOAL - count)} pra sua home ganhar vida`} items={items} />}

      <IdeasRail
        ideas={ideas}
        subtitle={count ? "Toque no + pra trazer mais pro seu" : "Comece por aqui: toque no + pra trazer pro seu"}
      />

      <section className="rise">
        <div className={`mb-3 ${GUTTER}`}>
          <h2 className="text-[20px] font-bold tracking-tight lg:text-[24px]">Ou comece por um tipo</h2>
          <p className="mt-0.5 text-[13px] text-text-2">Cada tipo tem sua aba, só aparece quando tiver algo nela</p>
        </div>
        <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 ${GUTTER}`}>
          {KINDS.map((k, idx) => {
            const { icon: Icon, hint } = KIND_CARD[k];
            const covers = ideas.items.filter((i) => i.kind === k && i.coverUrl).slice(0, 3);
            const mine = items.filter((i) => i.kind === k).length;
            return (
              <Link key={k} href={`/adicionar?k=${k}`} className="group relative flex h-[170px] flex-col overflow-hidden rounded-[26px] bg-bg-3 p-4 lg:h-[210px] lg:p-5">
                {/* Capas em leque, das ideias daquele tipo */}
                <div className="pointer-events-none absolute -right-2 -top-3 h-[100px] w-[110px] lg:right-0 lg:top-4 lg:h-[150px] lg:w-[170px]">
                  {covers.map((c, i) => (
                    <img
                      key={c.id}
                      src={coverSrc(c.coverUrl, "sm")!}
                      alt=""
                      className="absolute top-0 h-[78px] w-[52px] rounded-lg object-cover opacity-75 shadow-[0_10px_24px_rgb(0_0_0/0.5)] transition-transform duration-500 lg:h-[120px] lg:w-[80px]"
                      style={{ right: i * 22, transform: `rotate(${(i - 1) * 9}deg) translateY(${Math.abs(i - 1) * 8}px)`, zIndex: 3 - i }}
                    />
                  ))}
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-3 from-40% via-bg-3/80 to-transparent" />
                <span className={`relative flex h-11 w-11 items-center justify-center rounded-2xl ${idx % 2 ? "bg-white/[0.08]" : "btn-accent"} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}>
                  <Icon size={21} />
                </span>
                <span className="relative mt-auto">
                  <span className="flex items-center gap-2 text-[17px] font-bold lg:text-[19px]">
                    {KIND_META[k].plural}
                    {mine > 0 && <span className="rounded-full bg-white/10 px-2 text-[12px] font-semibold leading-5">{mine}</span>}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-text-2 line-clamp-2 lg:text-[13px]">{hint}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// Desktop: pôsteres das ideias em leque ao lado do título
function HeroPosters({ ideas }: { ideas: Ideas }) {
  const covers = ideas.items.filter((i) => i.coverUrl).slice(0, 5);
  if (covers.length < 3) return null;
  return (
    <div className="pointer-events-none absolute right-10 top-0 hidden h-[360px] w-[520px] xl:block 2xl:right-[6%]">
      {covers.map((c, i) => {
        const mid = (covers.length - 1) / 2;
        return (
          <motion.img
            key={c.id}
            src={coverSrc(c.coverUrl, "md")!}
            alt=""
            initial={{ opacity: 0, y: 40, rotate: 0 }}
            animate={{ opacity: 1, y: Math.abs(i - mid) * 22, rotate: (i - mid) * 7 }}
            transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 140, damping: 18 }}
            className="absolute top-0 h-[270px] w-[180px] rounded-2xl object-cover shadow-[0_30px_70px_rgb(0_0_0/0.65)]"
            style={{ left: i * 85, zIndex: 10 - Math.round(Math.abs(i - mid) * 2) }}
          />
        );
      })}
    </div>
  );
}
