"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Billboard } from "./billboard";
import { ListBrowser } from "./list-browser";
import { GUTTER, TopTen } from "./rail";

export function HomeView({ seed }: { seed: number }) {
  const { items } = useBacklog();

  const { featured, top, topIds } = useMemo(() => {
    // Destaques: "quero muito" e notas altas com arte bonita; muda uma vez por dia
    const rnd = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0) + seed) % 9973, seed);
    const strong = items.filter((i) => i.coverUrl && (i.pinned || (i.score ?? 0) >= 7.8));
    const featured = [...strong]
      .sort((a, b) => Number(!!b.backdropUrl) - Number(!!a.backdropUrl) || rnd(a.id) - rnd(b.id))
      .slice(0, 6)
      .sort((a, b) => rnd(a.id) - rnd(b.id));
    const top: LiteItem[] = [...items].filter((i) => i.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);
    return { featured, top, topIds: new Set(top.map((i) => i.id)) };
  }, [items, seed]);

  if (!items.length) {
    return (
      <div className={`flex min-h-[70vh] flex-col items-center justify-center text-center ${GUTTER}`}>
        <h1 className="text-[32px] font-bold tracking-tight">Seu backlog está vazio</h1>
        <p className="mt-2 max-w-sm text-text-2">Adicione filmes, séries, jogos e livros que você quer ver, e o app organiza e sorteia pra você.</p>
        <Link href="/adicionar" className="btn-accent mt-6 flex h-12 items-center rounded-full px-7 font-semibold">
          Adicionar o primeiro
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Billboard featured={featured} />
      <div className="relative z-10 mx-auto max-w-[1600px] space-y-10 pt-8 lg:-mt-20 lg:space-y-14">
        <TopTen items={top} morphIds={topIds} />
        {/* Tudo embaixo, agrupado por divisão, sem repetir o que já está no Top 10 como morph */}
        <ListBrowser mode="home" noMorphIds={topIds} />
      </div>
    </div>
  );
}
