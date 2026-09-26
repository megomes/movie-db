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

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

// Rodapé pessoal: números vivos do backlog e o "dado" desta visita
export function SiteFooter({ seed }: { seed: number }) {
  const { items, me, doneCount, shared } = useBacklog();

  const facts = useMemo(() => {
    const hours = items.reduce((s, i) => s + hoursOf(i), 0);
    const pick = items.length ? items[seed % items.length] : null;
    const common = shared.reduce((s, p) => s + p.count, 0);
    const partner = shared.find((p) => p.count)?.name?.split(" ")[0];
    return { hours, pick, common, partner };
  }, [items, shared, seed]);

  const first = me.name?.split(" ")[0] ?? "você";

  return (
    <footer className="mx-auto mt-20 w-full max-w-[1600px] px-4 pb-6 sm:px-6 lg:px-10">
      <div className="border-t border-white/[0.07] pt-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Assinatura */}
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
            <div>
              <p className="text-[15px] font-semibold tracking-tight">Backlog</p>
              <p className="text-[12.5px] text-text-3">Feito em casa pra ver mais e rolar menos. 🍿</p>
            </div>
          </div>

          {/* Números vivos */}
          {items.length > 0 && (
            <ul className="grid gap-2.5 text-[13px] text-text-2 sm:grid-cols-2 lg:max-w-[760px] lg:gap-x-8">
              <li className="flex items-start gap-2">
                <Hourglass size={15} className="mt-0.5 shrink-0 text-white/40" />
                <span>
                  Zerar os <b className="font-semibold text-white/85">{fmt(items.length)}</b> itens levaria{" "}
                  <b className="font-semibold text-white/85">{fmt(facts.hours / 24)} dias</b> sem dormir, ou uns{" "}
                  <b className="font-semibold text-white/85">{(facts.hours / 2 / 365).toFixed(1).replace(".", ",")} anos</b> a 2h por dia.
                </span>
              </li>
              {facts.pick && (
                <li className="flex items-start gap-2">
                  <Dices size={15} className="mt-0.5 shrink-0 text-white/40" />
                  <span>
                    O dado desta visita diz:{" "}
                    <Link href={`/item/${facts.pick.id}`} className="font-semibold text-accent-2 hover:underline">
                      {facts.pick.title}
                    </Link>
                    . Vai encarar, {first}?
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <CircleCheckBig size={15} className="mt-0.5 shrink-0 text-white/40" />
                <span>
                  {doneCount ? (
                    <>
                      <Link href="/vistos" className="font-semibold text-white/85 hover:underline">
                        {fmt(doneCount)} {doneCount === 1 ? "visto" : "vistos"}
                      </Link>{" "}
                      até agora. Cada um tirado da pilha com orgulho.
                    </>
                  ) : (
                    <>Nenhum visto ainda. O primeiro “Já vi” é o mais gostoso.</>
                  )}
                </span>
              </li>
              {facts.common > 0 && (
                <li className="flex items-start gap-2">
                  <HeartHandshake size={15} className="mt-0.5 shrink-0 text-white/40" />
                  <span>
                    <Link href="/juntos" className="font-semibold text-white/85 hover:underline">
                      {fmt(facts.common)} em comum
                    </Link>{" "}
                    com {facts.partner ?? "a outra pessoa"}. Assunto pra sexta à noite não falta.
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
