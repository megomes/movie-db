"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Tv } from "lucide-react";
import { accessFor } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Billboard } from "./billboard";
import { GUTTER, Rail, TopTen } from "./rail";

const byScore = (a: LiteItem, b: LiteItem) => Number(b.pinned) - Number(a.pinned) || (b.score ?? 0) - (a.score ?? 0);

export function HomeView({ seed }: { seed: number }) {
  const { items, myProviders } = useBacklog();

  const data = useMemo(() => {
    // Destaques: "quero muito" primeiro, depois notas altas com arte bonita; embaralha pelo seed do dia
    const rnd = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0) + seed) % 9973, seed);
    const strong = items.filter((i) => i.coverUrl && (i.pinned || (i.score ?? 0) >= 7.8));
    const featured = [...strong]
      .sort((a, b) => Number(!!b.backdropUrl) - Number(!!a.backdropUrl) || rnd(a.id) - rnd(b.id))
      .slice(0, 6)
      .sort((a, b) => rnd(a.id) - rnd(b.id));

    const mine = items.filter((i) => (i.kind === "movie" || i.kind === "series") && accessFor(i, myProviders).tier === "mine").sort(byScore);
    const rails = [
      { title: "No seu streaming", subtitle: "Já liberado nos serviços que você assina", href: "/lista?f=mine", items: mine },
      { title: "Cabe numa noite", subtitle: "Filmes de até 2 horas", href: "/lista?k=movie&sort=short", items: items.filter((i) => i.kind === "movie" && i.minutes && i.minutes <= 120).sort(byScore) },
      { title: "Pra zerar num fim de semana", subtitle: "Jogos de até 12h", href: "/lista?k=game&sort=short", items: items.filter((i) => i.kind === "game" && i.minutes && i.minutes <= 720).sort(byScore) },
      { title: "No Switch", href: "/lista?k=game&f=switch", items: items.filter((i) => i.kind === "game" && i.myPlatforms.includes("Switch")).sort(byScore) },
      { title: "Em promoção na Steam", href: "/lista?k=game&f=sale", items: items.filter((i) => (i.steamPrice?.discountPercent ?? 0) > 0).sort((a, b) => (b.steamPrice?.discountPercent ?? 0) - (a.steamPrice?.discountPercent ?? 0)) },
      { title: "Séries", href: "/lista?k=series", items: items.filter((i) => i.kind === "series").sort(byScore) },
      { title: "Livros curtos", subtitle: "Até 250 páginas", href: "/lista?k=book&sort=short", items: items.filter((i) => i.kind === "book" && i.pages && i.pages <= 250).sort(byScore) },
      { title: "Chegaram por último", href: "/lista?sort=recent", items: items.slice(0, 20) },
    ];
    const top = [...items].filter((i) => i.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);

    // Morph só na primeira aparição de cada item (nomes de ViewTransition precisam ser únicos)
    const seen = new Set<string>();
    const claim = (list: LiteItem[], n: number) => {
      const s = new Set<string>();
      for (const i of list.slice(0, n)) {
        if (seen.has(i.id)) continue;
        seen.add(i.id);
        s.add(i.id);
      }
      return s;
    };
    const topMorph = claim(top, 10);
    const railMorph = rails.map((r) => claim(r.items, 24));
    return { featured, rails, top, topMorph, railMorph };
  }, [items, myProviders, seed]);

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

  const [streaming, ...rest] = data.rails;
  return (
    <div>
      <Billboard featured={data.featured} />
      <div className="relative z-10 mx-auto max-w-[1600px] space-y-9 pt-8 lg:-mt-24 lg:space-y-12">
        <Rail
          {...streaming}
          morphIds={data.railMorph[0]}
          empty={
            myProviders.length ? null : (
              <Link href="/ajustes" className="glass flex items-center gap-4 rounded-3xl p-4 transition-colors hover:bg-white/5">
                <span className="btn-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                  <Tv size={22} />
                </span>
                <span>
                  <span className="block font-semibold">Conecte seus streamings</span>
                  <span className="block text-[13px] text-text-2">Marque Netflix, Max, Prime… e veja o que já está liberado pra você.</span>
                </span>
              </Link>
            )
          }
        />
        <TopTen items={data.top} morphIds={data.topMorph} />
        {rest.map((r, i) => (
          <Rail key={r.title} {...r} morphIds={data.railMorph[i + 1]} />
        ))}
      </div>
    </div>
  );
}
