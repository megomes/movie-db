"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AI_CATEGORIES, AI_SOURCES, aiSource } from "@/lib/ai-picks";
import { ptGenre } from "@/lib/genres";
import type { AiSuggestion } from "@/lib/queries";
import { GUTTER } from "./rail";
import { useGameMenu } from "./game-menu";
import { BacklogButton, ShotCover, useBacklogToggle, type BacklogRef } from "./shot-cover";

// Jogos que outras IAs sugeriram a partir do backlog exportado, agrupados por categoria, com a tag de quem sugeriu
export function AiPicksView({ games, backlog }: { games: AiSuggestion[]; backlog: Record<number, BacklogRef> }) {
  const { owned, busy, toggle } = useBacklogToggle(backlog);
  const openMenu = useGameMenu();
  const sp = useSearchParams();
  // Filtros ficam na URL: voltar de um jogo reabre do mesmo jeito
  const [ai, setAi] = useState<string | null>(AI_SOURCES.some((s) => s.id === sp.get("ia")) ? sp.get("ia") : null);
  const [hideMine, setHideMine] = useState(sp.get("esconder") === "1");
  function sync(nextAi: string | null, nextHide: boolean) {
    const url = new URL(window.location.href);
    if (nextAi) url.searchParams.set("ia", nextAi);
    else url.searchParams.delete("ia");
    if (nextHide) url.searchParams.set("esconder", "1");
    else url.searchParams.delete("esconder");
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  const counts = useMemo(() => Object.fromEntries(AI_SOURCES.map((s) => [s.id, games.filter((g) => g.sources.includes(s.id)).length])), [games]);
  const sections = useMemo(() => {
    const visible = games
      .filter((g) => !ai || g.sources.includes(ai))
      .filter((g) => !hideMine || !owned[g.igdbId])
      // Primeiro o que mais IAs sugeriram, depois a nota
      .sort((a, b) => b.sources.length - a.sources.length || (b.rating ?? 0) - (a.rating ?? 0));
    const known = new Set<string>(AI_CATEGORIES.map((c) => c.id));
    return [
      ...AI_CATEGORIES.map((c) => ({ ...c, games: visible.filter((g) => g.category === c.id) })),
      { id: "outros", label: "Outros", emoji: "✨", games: visible.filter((g) => !g.category || !known.has(g.category)) },
    ].filter((s) => s.games.length);
  }, [games, ai, hideMine, owned]);

  const chip = (on: boolean) =>
    `relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${on ? "text-white" : "text-white/70 hover:text-white"}`;

  return (
    <div className="mx-auto max-w-[1600px] pb-10 pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28">
      <header className={GUTTER}>
        <Link href="/lista?k=game" className="group mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-text-2 hover:text-white">
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> Jogos
        </Link>
        <h1 className="flex items-center gap-3 text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">
          <Sparkles className="h-8 w-8 text-accent lg:h-11 lg:w-11" /> Sugestões das IAs
        </h1>
        <p className="mt-2 text-[15px] text-text-2">
          {games.length} jogos que outras IAs indicaram a partir do seu backlog · <span className="text-text-3">os que mais IAs indicaram vêm primeiro</span>
        </p>
      </header>

      <div className={`sticky top-0 z-30 mt-4 py-3 lg:top-20 ${GUTTER}`}>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <nav aria-label="Filtrar por IA" className="glass no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
            {[{ id: null as string | null, label: "Todas", count: games.length }, ...AI_SOURCES.map((s) => ({ id: s.id as string | null, label: s.id, count: counts[s.id] }))]
              .filter((o) => o.count)
              .map((o) => (
                <button
                  key={o.label}
                  aria-pressed={ai === o.id}
                  onClick={() => {
                    setAi(o.id);
                    sync(o.id, hideMine);
                  }}
                  className={chip(ai === o.id)}
                >
                  {ai === o.id && <motion.span layoutId="ai-filter" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative flex items-center gap-1.5">
                    {o.id && <span className="h-2 w-2 rounded-full" style={{ background: aiSource(o.id).color }} />}
                    {o.label} <span className="text-[11px] opacity-60">{o.count}</span>
                  </span>
                </button>
              ))}
          </nav>
          <button
            onClick={() => {
              setHideMine(!hideMine);
              sync(ai, !hideMine);
            }}
            aria-pressed={hideMine}
            className={`tap h-9 shrink-0 self-start rounded-full px-3.5 text-[13px] font-medium transition-colors sm:self-auto ${hideMine ? "btn-accent" : "glass text-white/75 hover:text-white"}`}
          >
            Esconder o que já tenho
          </button>
        </div>
      </div>

      <div className="space-y-12 pt-3">
        {sections.map((s) => (
          <section key={s.id}>
            <h2 className={`mb-4 text-[20px] font-bold tracking-tight lg:text-[24px] ${GUTTER}`}>
              <span className="mr-1.5">{s.emoji}</span>
              {s.label} <span className="text-[14px] font-semibold text-text-3">{s.games.length}</span>
            </h2>
            <div className={`grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-7 2xl:grid-cols-8 ${GUTTER}`}>
              {s.games.map((g, idx) => {
                const item = owned[g.igdbId] ?? null;
                return (
                  <div key={g.igdbId} className="rise" style={{ animationDelay: `${Math.min(idx, 18) * 20}ms` }}>
                    <div
                      className="group relative"
                      onContextMenu={(e) => openMenu(e, { igdbId: g.igdbId, title: g.title, coverUrl: g.coverUrl, itemId: item?.id, done: item?.done })}
                    >
                      <Link href={item ? `/item/${item.id}` : `/jogo/${g.igdbId}`} aria-label={g.title} className="block">
                        <ShotCover
                          id={String(g.igdbId)}
                          title={g.title}
                          coverUrl={g.coverUrl}
                          screenshots={g.screenshots}
                          eager={idx < 12}
                          overlay={() => (
                            <div className="pointer-events-none absolute left-2 right-11 top-2 flex flex-wrap items-start gap-1">
                              {AI_SOURCES.filter((src) => g.sources.includes(src.id)).map((src) => (
                                <span
                                  key={src.id}
                                  className="rounded-full px-1.5 py-[1px] text-[10px] font-bold leading-4 shadow-[0_1px_6px_rgb(0_0_0/0.5)]"
                                  style={{ background: src.color, color: src.ink }}
                                >
                                  {src.short}
                                </span>
                              ))}
                            </div>
                          )}
                        />
                      </Link>
                      {!item?.done && <BacklogButton on={!!item} busy={busy.has(g.igdbId)} onClick={() => toggle(g.igdbId)} />}
                    </div>
                    <p className="mt-2 truncate text-[13px] font-medium leading-tight" title={g.title}>
                      {g.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-text-3">
                      {[g.year, g.genres[0] && ptGenre(g.genres[0]), g.rating != null && `★ ${g.rating}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {!sections.length && (
        <p className="px-4 py-24 text-center text-text-2">{games.length ? "Você já tem todos desta lista!" : "Nenhuma sugestão de IA guardada ainda."}</p>
      )}
    </div>
  );
}
