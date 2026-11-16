"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { EXCLUSIVE_LABEL, listOf, listsFor, platformOf, PLATFORMS, sourcesFor, type DiscoverGroup, type ListId, type PlatformId } from "@/lib/discover-lists";
import { ptGenre } from "@/lib/genres";
import { DiscoverGridSkeleton } from "./discover-skeleton";
import { GUTTER } from "./rail";
import { CardMenuButton, HOLD_CLASS, useMenuTrigger } from "./game-menu";
import { BacklogButton, ShotCover, useBacklogToggle, type BacklogRef } from "./shot-cover";

const viewsFmt = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// Listas de jogos (PC, Switch, Android) para descobrir o que jogar: passa o mouse para ver screenshots
export function DiscoverView({
  platform,
  list,
  groups,
  backlog,
  installed: installedIds,
  mc,
}: {
  platform: PlatformId;
  list: ListId;
  groups: DiscoverGroup[];
  backlog: Record<number, BacklogRef>;
  installed: number[];
  /** Sublistas guardadas (GameTrailers, IGN, Metacritic) e a escolhida */
  mc?: { lists: { slug: string; label: string; group: string }[]; selected: string | null; url: string | null };
}) {
  const { owned, busy, toggle } = useBacklogToggle(backlog);
  const menuProps = useMenuTrigger();
  const installed = useMemo(() => new Set(installedIds), [installedIds]);
  const sp = useSearchParams();
  // Fica na URL (e passa entre listas/plataformas): voltar de um jogo reabre do mesmo jeito
  const [hideMine, setHideMine] = useState(sp.get("esconder") === "1");
  // Switch: só os exclusivos da Nintendo; PC: só os que não saem em console (vale em qualquer lista)
  const [onlyExclusive, setOnlyExclusive] = useState(sp.get("exclusivos") === "1");
  const href = (p: PlatformId, l: ListId, m?: string | null) =>
    `/descobrir?plataforma=${p}&lista=${l}${listOf(l).stored && m ? `&mc=${encodeURIComponent(m)}` : ""}${hideMine ? "&esconder=1" : ""}${onlyExclusive ? "&exclusivos=1" : ""}`;
  const mcSelected = mc?.lists.find((l) => l.slug === mc.selected);

  // Troca de plataforma/lista: o botão muda na hora e a grade vira esqueleto até a nova lista chegar do servidor
  const router = useRouter();
  const [loading, startNav] = useTransition();
  const [target, setTarget] = useState<{ p: PlatformId; l: ListId; m: string | null } | null>(null);
  const shownPlatform = target?.p ?? platform;
  const shownList = target?.l ?? list;
  const shownMc = target ? target.m : (mc?.selected ?? null);
  function go(e: React.MouseEvent, p: PlatformId, l: ListId, m: string | null = null) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // nova aba etc.: deixa o link
    e.preventDefault();
    if (p === shownPlatform && l === shownList && (!listOf(l).stored || m === shownMc)) return;
    setTarget({ p, l, m });
    startNav(() => router.push(href(p, l, m), { scroll: false }));
  }
  function toggleParam(name: string, next: boolean) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set(name, "1");
    else url.searchParams.delete(name);
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  function toggleHide() {
    setHideMine(!hideMine);
    toggleParam("esconder", !hideMine);
  }
  function toggleExclusive() {
    setOnlyExclusive(!onlyExclusive);
    toggleParam("exclusivos", !onlyExclusive);
  }
  const exclusiveOn = onlyExclusive && !!EXCLUSIVE_LABEL[platform];
  const meta = listOf(list);
  const shownMeta = listOf(shownList);
  // Sublistas guardadas só aparecem para a lista já carregada (trocando de fonte, somem até a nova chegar)
  const subs = mc && mc.lists.length > 0 && shownList === list && shownPlatform === platform ? mc.lists : [];
  const subLink = (l: { slug: string; label: string }) => (
    <Link
      key={l.slug}
      href={href(platform, list, l.slug)}
      onClick={(e) => go(e, platform, list, l.slug)}
      scroll={false}
      aria-current={shownMc === l.slug ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${shownMc === l.slug ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
    >
      {l.label}
    </Link>
  );
  const subRow = (label: string, items: { slug: string; label: string }[], aria: string) =>
    items.length > 0 && (
      <nav aria-label={aria} className="glass no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1">
        <span className="shrink-0 pl-2 pr-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">{label}</span>
        {items.map(subLink)}
      </nav>
    );
  const total = groups.reduce((n, g) => n + g.games.length, 0);
  const sections = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          visible: g.games.filter((x) => (!hideMine || (!installed.has(x.igdbId) && !owned[x.igdbId])) && (!exclusiveOn || x.exclusive === platform)),
        }))
        .filter((g) => g.visible.length),
    [groups, hideMine, installed, owned, exclusiveOn, platform],
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
            {PLATFORMS.map((p) => {
              // Sem a lista no Metacritic (Android): cai em "Melhores"
              const l = listsFor(p.id).some((x) => x.id === shownList) ? shownList : "top";
              return (
                <Link
                  key={p.id}
                  href={href(p.id, l, shownMc)}
                  onClick={(e) => go(e, p.id, l, shownMc)}
                  scroll={false}
                  aria-current={shownPlatform === p.id ? "page" : undefined}
                  className={`tap rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${shownPlatform === p.id ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <p className="mt-2 text-[15px] text-text-2">
          {meta.label} no {platformOf(platform).label}
          {mcSelected ? (
            <>
              {" "}·{" "}
              <span className="text-white/85">
                {mcSelected.group === "ano" ? `${list === "mc" ? "Melhores" : "Mais vistos"} de ${mcSelected.label}` : mcSelected.label}
              </span>
              {mc?.url && mcSelected.group !== "genero" && (
                <>
                  {" "}·{" "}
                  <a href={mc.url} target="_blank" rel="noopener noreferrer" className="text-text-3 underline-offset-2 hover:text-white hover:underline">
                    {list === "mc" ? "ver no Metacritic" : "ver o canal"}
                  </a>
                </>
              )}
            </>
          ) : (
            <>
              {" "}· <span className="text-text-3">{meta.hint}</span>
            </>
          )}
        </p>
      </header>

      <div className={`sticky top-0 z-30 mt-4 space-y-2.5 py-3 lg:top-20 ${GUTTER}`}>
        {/* Fontes: IGDB, GameTrailers, IGN, Metacritic */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <nav aria-label="Fonte" className="glass no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
            {sourcesFor(shownPlatform).map((src) => {
              const target: ListId = src.id === "igdb" ? (shownMeta.source === "igdb" ? shownList : "top") : src.id;
              const on = shownMeta.source === src.id;
              return (
                <Link
                  key={src.id}
                  href={href(shownPlatform, target)}
                  onClick={(e) => go(e, shownPlatform, target)}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className="relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold"
                >
                  {on && <motion.span layoutId="discover-source" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className={`relative ${on ? "text-white" : "text-white/70"}`}>{src.label}</span>
                </Link>
              );
            })}
          </nav>
          <button
            onClick={toggleHide}
            aria-pressed={hideMine}
            className={`tap h-9 shrink-0 self-start rounded-full px-3.5 text-[13px] font-medium transition-colors sm:self-auto ${hideMine ? "btn-accent" : "glass text-white/75 hover:text-white"}`}
          >
            Esconder o que já tenho
          </button>
          {EXCLUSIVE_LABEL[shownPlatform] && (
            <button
              onClick={toggleExclusive}
              aria-pressed={onlyExclusive}
              className={`tap h-9 shrink-0 self-start rounded-full px-3.5 text-[13px] font-medium transition-colors sm:self-auto ${onlyExclusive ? "btn-accent" : "glass text-white/75 hover:text-white"}`}
            >
              {EXCLUSIVE_LABEL[shownPlatform]}
            </button>
          )}
        </div>

        {/* IGDB: as listas dele */}
        {shownMeta.source === "igdb" && (
          <nav aria-label="Listas do IGDB" className="glass no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1 sm:inline-flex">
            {listsFor(shownPlatform)
              .filter((l) => l.source === "igdb")
              .map((l) => (
                <Link
                  key={l.id}
                  href={href(shownPlatform, l.id)}
                  onClick={(e) => go(e, shownPlatform, l.id)}
                  scroll={false}
                  aria-current={shownList === l.id ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${shownList === l.id ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
                >
                  {l.short}
                </Link>
              ))}
          </nav>
        )}

        {/* Guardadas: geral e por ano numa linha, gêneros na de baixo */}
        {subs.some((l) => l.group !== "genero") && (
          <nav aria-label="Listas" className="glass no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1">
            {subs.filter((l) => l.group === "geral").map(subLink)}
            {subs.some((l) => l.group === "ano") && <span className="shrink-0 pl-2 pr-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">Ano</span>}
            {subs.filter((l) => l.group === "ano").map(subLink)}
          </nav>
        )}
        {subRow(
          "Gênero",
          subs.filter((l) => l.group === "genero"),
          "Gêneros",
        )}
      </div>

      {loading && <DiscoverGridSkeleton className="pt-3" />}
      <div className={`space-y-12 pt-3 ${loading ? "hidden" : ""}`}>
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
                const mg = { igdbId: g.igdbId, title: g.title, coverUrl: g.coverUrl, itemId: item?.id, done: item?.done };
                const rank = s.games.indexOf(g) + 1;
                const when = list === "soon" ? (g.releaseDate ? dateFmt.format(new Date(g.releaseDate)) : "Sem data") : g.year;
                const cover = (
                  <ShotCover
                    id={String(g.igdbId)}
                    title={g.title}
                    coverUrl={g.coverUrl}
                    screenshots={g.screenshots}
                    eager={idx < 12}
                    overlay={(scrubbing) => (
                      // No celular os botões (...) e (+) ocupam o topo: os selos vão para o pé da capa
                      <div
                        className={`pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1 [@media(hover:none)]:bottom-2 [@media(hover:none)]:top-auto ${scrubbing ? "[@media(hover:none)]:opacity-0" : ""}`}
                      >
                        <span className="rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-white/10">
                          #{rank}
                          {g.views ? (
                            <span className="text-white/70"> · ▶ {viewsFmt.format(g.views)}</span>
                          ) : g.score ? (
                            <span className="text-white/70"> · MC {g.score}</span>
                          ) : (
                            g.rating != null && list !== "soon" && <span className="text-white/70"> · ★ {g.rating}</span>
                          )}
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
                      {...menuProps(mg)}
                    >
                      <Link href={item ? `/item/${item.id}` : `/jogo/${g.igdbId}`} aria-label={g.title} className="block">
                        {cover}
                      </Link>
                      {!item?.done && <BacklogButton on={!!item} busy={busy.has(g.igdbId)} onClick={() => toggle(g.igdbId)} />}
                      <CardMenuButton game={mg} className={item?.done ? "right-2" : "right-11"} />
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
      {!loading && !sections.length && <p className="px-4 py-24 text-center text-text-2">{!total ? "Não deu pra carregar esta lista agora." : exclusiveOn && !groups.some((g) => g.games.some((x) => x.exclusive === platform)) ? `Nenhum exclusivo ${platform === "pc" ? "do PC" : "do Switch"} nesta lista.` : "Você já tem todos desta lista!"}</p>}
    </div>
  );
}
