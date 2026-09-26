/* eslint-disable @next/next/no-img-element -- ícone estático */
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CircleCheckBig, Dices, HeartHandshake, Hourglass } from "lucide-react";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";

// Quanto tempo leva pra consumir um item (estimativa grosseira, é só pra graça)
function hoursOf(i: LiteItem) {
  if (i.kind === "movie") return (i.minutes ?? 110) / 60;
  if (i.kind === "series") return (i.seasons ?? 1) * 8;
  if (i.kind === "game") return (i.minutes ?? 900) / 60;
  return ((i.pages ?? 300) * 1.3) / 60; // ~1,3 min por página
}

const Sep = () => <span className="text-white/20">·</span>;
const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-white/75">{children}</b>;

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

// Rodapé pessoal: números vivos do backlog e o "dado" desta visita
export function SiteFooter({ seed }: { seed: number }) {
  const { items, doneCount, shared } = useBacklog();

  const facts = useMemo(() => {
    const hours = items.reduce((s, i) => s + hoursOf(i), 0);
    const pick = items.length ? items[seed % items.length] : null;
    const common = shared.reduce((s, p) => s + p.count, 0);
    const partner = shared.find((p) => p.count)?.name?.split(" ")[0];
    return { hours, pick, common, partner };
  }, [items, shared, seed]);

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
            {facts.pick && (
              <>
                <Sep />
                <span className="inline-flex items-center gap-1.5">
                  <Dices size={12} className="text-white/35" />
                  o dado diz{" "}
                  <Link href={`/item/${facts.pick.id}`} className="font-semibold text-accent-2 hover:underline">
                    {facts.pick.title}
                  </Link>
                </span>
              </>
            )}
            <Sep />
            <Link href="/vistos" className="inline-flex items-center gap-1.5 hover:text-white">
              <CircleCheckBig size={12} className="text-white/35" />
              <B>{fmt(doneCount)}</B> {doneCount === 1 ? "visto" : "vistos"}
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
