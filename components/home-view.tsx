"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Tv } from "lucide-react";
import { accessFor } from "@/lib/kinds";
import type { Ideas, LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Billboard } from "./billboard";
import { EmptyHome, STARTER_GOAL } from "./empty-home";
import { IdeasRail } from "./ideas-rail";
import { Rail, TopTen } from "./rail";
import { TimeCards, type TimeBucket } from "./time-cards";

// Intercala os tipos (filme, jogo, livro, série…) mantendo a ordem dentro de cada um
function mix(list: LiteItem[]) {
  const queues = new Map<string, LiteItem[]>();
  for (const i of list) queues.set(i.kind, [...(queues.get(i.kind) ?? []), i]);
  const qs = [...queues.values()];
  const out: LiteItem[] = [];
  while (qs.some((q) => q.length)) for (const q of qs) if (q.length) out.push(q.shift()!);
  return out;
}

// Início: sugestões e descoberta. A grade completa fica na Lista.
export function HomeView({ seed, ideas }: { seed: number; ideas: Ideas }) {
  const { items, myProviders, shared } = useBacklog();

  const data = useMemo(() => {
    // Nota relativa ao próprio tipo (0 a 1): jogos no IGDB têm notas bem mais altas que filmes no IMDb,
    // então comparar a nota crua enchia a home de jogos
    const rank = new Map<string, number>();
    for (const kind of new Set(items.map((i) => i.kind))) {
      const scored = items.filter((i) => i.kind === kind && i.score != null).sort((a, b) => a.score! - b.score!);
      scored.forEach((i, idx) => rank.set(i.id, scored.length > 1 ? idx / (scored.length - 1) : 0.5));
    }
    const rel = (i: LiteItem) => rank.get(i.id) ?? 0.4;
    const byScore = (a: LiteItem, b: LiteItem) => Number(b.pinned) - Number(a.pinned) || rel(b) - rel(a);
    const rnd = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0) + seed) % 9973, seed);
    const daily = (list: LiteItem[]) => [...list].sort((a, b) => rnd(a.id) - rnd(b.id));

    // Destaque do dia: "quero muito" e notas altas com arte bonita
    const strong = items.filter((i) => i.coverUrl && (i.pinned || rel(i) >= 0.75));
    const featured = mix(daily(strong)).slice(0, 6);

    // Cada item aparece uma vez só na home (fora o destaque)
    const seen = new Set<string>();
    const take = (list: LiteItem[], n: number) => {
      const out: LiteItem[] = [];
      for (const i of list) {
        if (out.length >= n) break;
        if (seen.has(i.id)) continue;
        seen.add(i.id);
        out.push(i);
      }
      return out;
    };

    const top = take(mix(items.filter((i) => i.score != null).sort((a, b) => rel(b) - rel(a))), 10);

    const good = (i: LiteItem) => (i.score ?? 6.5) >= 6.5;
    const buckets: TimeBucket[] = [
      { id: "session", label: "Uma sessão", hint: "Filme de até 1h40", icon: "film", items: take(daily(items.filter((i) => i.kind === "movie" && i.minutes && i.minutes <= 100 && good(i))), 8) },
      { id: "night", label: "Uma noite", hint: "Até 2h30 de filme", icon: "moon", items: take(daily(items.filter((i) => i.kind === "movie" && i.minutes && i.minutes > 100 && i.minutes <= 150 && good(i))), 8) },
      { id: "weekend", label: "Um fim de semana", hint: "Jogo de até 12h", icon: "game", items: take(daily(items.filter((i) => i.kind === "game" && i.minutes && i.minutes <= 720 && good(i))), 8) },
      { id: "bed", label: "Antes de dormir", hint: "Livro de até 250 páginas", icon: "book", items: take(daily(items.filter((i) => i.kind === "book" && i.pages && i.pages <= 250)), 8) },
    ];

    const available = take(mix(items.filter((i) => accessFor(i, myProviders).tier === "mine" || i.gamePass || (i.steamPrice?.discountPercent ?? 0) >= 30).sort(byScore)), 20);
    const together = shared
      .filter((p) => p.count)
      .map((p) => ({ person: p, items: take(mix(items.filter((i) => p.mineIds.includes(i.id)).sort(byScore)), 20) }));
    const pinned = take(mix(items.filter((i) => i.pinned).sort(byScore)), 20);

    return { featured, top, topIds: new Set(top.map((i) => i.id)), buckets, available, together, pinned };
  }, [items, myProviders, shared, seed]);

  // Poucos itens: a home normal ficaria vazia, então segue no modo "primeiros passos"
  if (items.length < STARTER_GOAL) return <EmptyHome ideas={ideas} />;

  return (
    <div>
      <Billboard featured={data.featured} />
      <div className="relative z-10 mx-auto max-w-[1600px] space-y-12 pt-8 lg:-mt-16 lg:space-y-16">
        <TimeCards buckets={data.buckets} />
        <Rail
          title="Liberado agora"
          subtitle="No seu streaming, no Game Pass ou em promoção"
          items={data.available}
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
        {data.together.map((t) => (
          <Rail key={t.person.userId} title={`Pra ver com ${t.person.name?.split(" ")[0]}`} subtitle="Está no backlog de vocês dois" href="/juntos" items={t.items} />
        ))}
        <Rail title="Quero muito" subtitle="Os que você marcou com ♥" href="/lista" items={data.pinned} />
        <IdeasRail ideas={ideas} subtitle="O que ainda não está no seu. Toque no + pra trazer" />
        <TopTen items={data.top} morphIds={data.topIds} />
      </div>
    </div>
  );
}
