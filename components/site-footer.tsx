/* eslint-disable @next/next/no-img-element -- ícone estático */
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CircleCheckBig, HeartHandshake, Hourglass } from "lucide-react";
import { hoursOf } from "@/lib/kinds";
import { useBacklog } from "./backlog-context";

const Sep = () => <span className="text-white/20">·</span>;
const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-white/75">{children}</b>;

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

// Rodapé pessoal: números vivos do backlog (quanto falta e quanto já foi)
export function SiteFooter({ doneHours }: { doneHours: number }) {
  const { items, doneCount, shared } = useBacklog();

  const facts = useMemo(() => {
    const hours = items.reduce((s, i) => s + hoursOf(i), 0);
    const common = shared.reduce((s, p) => s + p.count, 0);
    const partner = shared.find((p) => p.count)?.name?.split(" ")[0];
    return { hours, common, partner };
  }, [items, shared]);

  return (
    // Faixa de ponta a ponta, mais escura, com o conteúdo na coluna central
    <footer className="mt-20 border-t border-white/[0.06] bg-black/35 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-5 text-[12px] leading-relaxed text-text-3 sm:px-6 lg:flex-row lg:items-center lg:gap-6 lg:px-10">
        <p className="flex shrink-0 items-center gap-2">
          <img src="/icons/icon-192.png" alt="" className="h-5 w-5 rounded-md opacity-80" />
          <span className="font-semibold text-white/60">Backlog</span>
          <Sep />
          <span>feito em casa pra ver mais e rolar menos 🍿</span>
        </p>
        {items.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:ml-auto lg:justify-end lg:text-right">
            <span className="inline-flex items-center gap-1.5">
              <Hourglass size={12} className="text-white/35" />
              zerar tudo: <B>{fmt(facts.hours / 24)} dias</B> sem dormir, ou <B>{(facts.hours / 2 / 365).toFixed(1).replace(".", ",")} anos</B> a 2h/dia
            </span>
            <Sep />
            <Link href="/vistos" className="inline-flex items-center gap-1.5 hover:text-white">
              <CircleCheckBig size={12} className="text-white/35" />
              <B>{fmt(doneCount)}</B> {doneCount === 1 ? "visto" : "vistos"}
              {doneHours > 0 && (
                <>
                  : <B>{doneHours >= 48 ? `${fmt(doneHours / 24)} dias` : `${fmt(doneHours)}h`}</B> sem dormir
                </>
              )}
            </Link>
            {facts.common > 0 && (
              <>
                <Sep />
                <Link href="/juntos" className="inline-flex items-center gap-1.5 hover:text-white">
                  <HeartHandshake size={12} className="text-white/35" />
                  <B>{fmt(facts.common)}</B> em comum com {facts.partner ?? "a outra pessoa"}
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </footer>
  );
}
