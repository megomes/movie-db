"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { LISTS, platformOf, PLATFORMS, type DiscoverGroup, type ListId, type PlatformId } from "@/lib/discover-lists";
import { ptGenre } from "@/lib/genres";
import { GUTTER } from "./rail";
import { HOLD_CLASS, useMenuTrigger } from "./game-menu";
import { BacklogButton, ShotCover, useBacklogToggle, type BacklogRef } from "./shot-cover";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Listas de jogos (PC, Switch, Android) para descobrir o que jogar: passa o mouse para ver screenshots
export function DiscoverView({
  platform,
  list,
  groups,
  backlog,
  installed: installedIds,
}: {
  platform: PlatformId;
  list: ListId;
  groups: DiscoverGroup[];
  backlog: Record<number, BacklogRef>;
  installed: number[];
}) {
  const { owned, busy, toggle } = useBacklogToggle(backlog);
  const menuProps = useMenuTrigger();
  const installed = useMemo(() => new Set(installedIds), [installedIds]);
  const sp = useSearchParams();
  // Fica na URL (e passa entre listas/plataformas): voltar de um jogo reabre do mesmo jeito
  const [hideMine, setHideMine] = useState(sp.get("esconder") === "1");
  const href = (p: PlatformId, l: ListId) => `/descobrir?plataforma=${p}&lista=${l}${hideMine ? "&esconder=1" : ""}`;
  function toggleHide() {
    const next = !hideMine;
    setHideMine(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("esconder", "1");
    else url.searchParams.delete("esconder");
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  const meta = LISTS.find((l) => l.id === list)!;
  const total = groups.reduce((n, g) => n + g.games.length, 0);
  const sections = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, visible: hideMine ? g.games.filter((x) => !installed.has(x.igdbId) && !owned[x.igdbId]) : g.games }))
        .filter((g) => g.visible.length),
    [groups, hideMine, installed, owned],
  );

  return (
    <div className="mx-auto max-w-[1600px] pb-10 pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28">
      <header className={GUTTER}>
        <Link href="/lista?k=game" className="group mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-text-2 hover:text-white">
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> Jogos
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">Descobrir</h1>
          <nav aria-label="Plataforma" className="glass inline-flex gap-1 rounded-full p-1">
            {PLATFORMS.map((p) => (
              <Link
                key={p.id}
                href={href(p.id, list)}
                scroll={false}
                aria-current={platform === p.id ? "page" : undefined}
                className={`tap rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${platform === p.id ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-2 text-[15px] text-text-2">
          {meta.label} no {platformOf(platform).label} · <span className="text-text-3">{meta.hint}</span>
        </p>
      </header>

      <div className={`sticky top-0 z-30 mt-4 space-y-2.5 py-3 lg:top-20 ${GUTTER}`}>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <nav className="glass no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
            {LISTS.map((l) => (
              <Link key={l.id} href={href(platform, l.id)} scroll={false} className="relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium">
                {list === l.id && <motion.span layoutId="discover-list" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className={`relative ${list === l.id ? "text-white" : "text-white/70"}`}>{l.short}</span>
              </Link>
            ))}
          </nav>
          <button
            onClick={toggleHide}
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
            {s.title && (
              <div className={`mb-4 ${GUTTER}`}>
                <h2 className="text-[20px] font-bold tracking-tight lg:text-[24px]">
                  {s.title} <span className="text-[14px] font-semibold text-text-3">{s.visible.length}</span>
                </h2>
                {s.hint && <p className="mt-0.5 text-[13px] text-text-3">{s.hint}</p>}
              </div>
            )}
            <div className={`grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-7 2xl:grid-cols-8 ${GUTTER}`}>
              {s.visible.map((g, idx) => {
                const item = owned[g.igdbId] ?? null;
                const rank = s.games.indexOf(g) + 1;
                const when = list === "soon" ? (g.releaseDate ? dateFmt.format(new Date(g.releaseDate)) : "Sem data") : g.year;
                const cover = (
                  <ShotCover
                    id={String(g.igdbId)}
                    title={g.title}
                    coverUrl={g.coverUrl}
                    screenshots={g.screenshots}
                    eager={idx < 12}
                    overlay={() => (
                      <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
                        <span className="rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-white/10">
                          #{rank}
                          {g.rating != null && list !== "soon" && <span className="text-white/70"> · ★ {g.rating}</span>}
                        </span>
                        {installed.has(g.igdbId) && (
                          <span className="flex items-center gap-1 rounded-full bg-success/90 px-2 py-0.5 text-[11px] font-semibold text-black">
                            <Gamepad2 size={11} /> Instalado
                          </span>
                        )}
                      </div>
                    )}
                  />
                );
                return (
                  <div key={g.igdbId} className="rise" style={{ animationDelay: `${Math.min(idx, 18) * 20}ms` }}>
                    <div
                      className={`group relative ${HOLD_CLASS}`}
                      {...menuProps({ igdbId: g.igdbId, title: g.title, coverUrl: g.coverUrl, itemId: item?.id, done: item?.done })}
                    >
                      <Link href={item ? `/item/${item.id}` : `/jogo/${g.igdbId}`} aria-label={g.title} className="block">
                        {cover}
                      </Link>
                      {!item?.done && <BacklogButton on={!!item} busy={busy.has(g.igdbId)} onClick={() => toggle(g.igdbId)} />}
                    </div>
                    <p className="mt-2 truncate text-[13px] font-medium leading-tight" title={g.title}>
                      {g.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-text-3">{[when, g.genres[0] && ptGenre(g.genres[0])].filter(Boolean).join(" · ")}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {!sections.length && <p className="px-4 py-24 text-center text-text-2">{total ? "Você já tem todos desta lista!" : "Não deu pra carregar esta lista agora."}</p>}
    </div>
  );
}
