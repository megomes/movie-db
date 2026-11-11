/* eslint-disable @next/next/no-img-element -- logos dos streamings (TMDB) */
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownAZ, Baby, Check, ChevronDown, ChevronRight, Clock, Compass, HardDrive, Plus, Search, Shuffle, Sparkles, Star, X } from "lucide-react";
import { COLLECTIONS, FAMILY_LIST } from "@/lib/collections";
import type { Kind } from "@/lib/db/schema";
import { normalize } from "@/lib/sources/http";
import { ptGenre } from "@/lib/genres";
import { accessFor, formatSize, KIND_META, KINDS } from "@/lib/kinds";
import type { InstalledLite, LiteItem, TagLite } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { useGameMenu } from "./game-menu";
import { Poster } from "./poster";
import { ShotCover } from "./shot-cover";
import { GUTTER } from "./rail";
import { TagNudge } from "./tag-nudge";

const SORTS = [
  { id: "score", label: "Maior nota", hint: "Os mais bem avaliados primeiro", icon: Star },
  { id: "short", label: "Mais curtos", hint: "Menos horas ou páginas", icon: Clock },
  { id: "recent", label: "Mais recentes", hint: "Adicionados por último", icon: Sparkles },
  { id: "az", label: "A–Z", hint: "Ordem alfabética", icon: ArrowDownAZ },
  { id: "shuffle", label: "Aleatório", hint: "Pra descobrir algo esquecido", icon: Shuffle },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const TITLES: Record<Kind | "all", string> = { all: "Tudo", movie: "Filmes", series: "Séries", game: "Jogos", book: "Livros" };

// Filtros de cada divisão: suas tags (gerenciadas no Perfil) + gêneros das APIs
type TagOption = { value: string; label: string; count: number };
type TagGroup = { id: "tag" | "genre"; label: string; tags: TagOption[] };
const genresOf = (i: LiteItem) => [...new Set(i.genres.map(ptGenre))];
const streamsOn = (i: LiteItem) => (i.availability ? [...(i.availability.flatrate ?? []), ...(i.availability.free ?? []), ...(i.availability.ads ?? [])] : []);
// "Amazon Prime Video" → "Prime Video", "Netflix Standard with Ads" → "Netflix"
const shortName = (n: string) => n.replace(/^Amazon /, "").replace(/ (Standard|Basic) with Ads$/, "").replace(/ Amazon Channel$/, "");

// Plataformas que viram filtro na aba Jogos (vêm do IGDB)
const PLATFORM_FILTERS = ["PC", "Switch"] as const;

function countBy(items: LiteItem[], pick: (i: LiteItem) => string[], label: (v: string) => string, limit = 14): TagOption[] {
  const m = new Map<string, number>();
  for (const i of items) for (const t of pick(i)) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, label: label(value), count }));
}

export function ListBrowser({
  items: external,
  tags: externalTags,
  owner,
  mode = "page",
  noMorphIds,
}: {
  items?: LiteItem[];
  tags?: TagLite[];
  owner?: { name: string | null };
  mode?: "page" | "home";
  noMorphIds?: Set<string>;
}) {
  const ctx = useBacklog();
  const items = external ?? ctx.items;
  const tagList = externalTags ?? ctx.tags;
  const readOnly = !!external;
  const sp = useSearchParams();
  const pathname = usePathname();
  // Na página de outra pessoa os links ficam nela; no resto, vão para a Lista
  const base = readOnly ? pathname : "/lista";
  const goKind = (k: Kind | "all") => {
    window.history.pushState(null, "", k === "all" ? base : `${base}?k=${k}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const kindParam = mode === "home" ? null : sp.get("k");
  const kind: Kind | "all" = KINDS.includes(kindParam as Kind) ? (kindParam as Kind) : "all";
  const [sort, setSort] = useState<SortId>(SORTS.some((s) => s.id === sp.get("sort")) ? (sp.get("sort") as SortId) : "score");
  // Filtros ficam na URL: voltar de um item reabre a lista do jeito que estava
  const [filter, setFilter] = useState<{ tag: string | null; genre: string | null }>({ tag: sp.get("tag"), genre: sp.get("genero") });
  const [onlyPinned, setOnlyPinned] = useState(sp.get("fav") === "1");
  const [onlyMine, setOnlyMine] = useState(sp.get("f") === "mine" || sp.get("meu") === "1");
  const [provider, setProvider] = useState<number | null>(Number(sp.get("streaming")) || null);
  const [onlySale, setOnlySale] = useState(sp.get("f") === "sale" || sp.get("promo") === "1");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [seed, setSeed] = useState(1);

  // Troca de divisão zera os filtros
  const [lastKind, setLastKind] = useState(kind);
  if (lastKind !== kind) {
    setLastKind(kind);
    setFilter({ tag: null, genre: null });
    setProvider(null);
  }

  useEffect(() => {
    if (mode === "home") return;
    const p = new URLSearchParams(window.location.search);
    const put = (k: string, v: string | null | false) => (v ? p.set(k, v) : p.delete(k));
    p.delete("f");
    put("sort", sort !== "score" && sort);
    put("tag", filter.tag);
    put("genero", filter.genre);
    put("fav", onlyPinned && "1");
    put("meu", onlyMine && "1");
    put("promo", onlySale && "1");
    put("streaming", provider != null && String(provider));
    put("q", q.trim() && q);
    const next = p.toString();
    if (next !== window.location.search.slice(1)) window.history.replaceState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
  }, [mode, sort, filter, onlyPinned, onlyMine, onlySale, provider, q]);

  const tagMeta = useMemo(() => new Map(tagList.map((t) => [t.id, t])), [tagList]);
  const ofKind = useMemo(() => (kind === "all" ? items : items.filter((i) => i.kind === kind)), [items, kind]);
  // Filtro por tag. Em jogos, PC e Switch vêm das plataformas do IGDB (não de tag): um jogo que sai nos dois
  // aparece nos dois filtros. O valor do filtro é "plat:PC" / "plat:Switch".
  const filterTagsOf = useMemo(
    () => (i: LiteItem) => {
      const own = i.tagIds.filter((t) => tagMeta.has(t));
      if (i.kind !== "game") return own;
      const plats = PLATFORM_FILTERS.filter((p) => i.platforms?.includes(p)).map((p) => `plat:${p}`);
      return plats.length ? [...plats, ...own] : own;
    },
    [tagMeta],
  );

  const groups = useMemo((): TagGroup[] => {
    if (kind === "all") return [];
    const out: TagGroup[] = [];
    const rank = (v: string) => (v.startsWith("plat:") ? PLATFORM_FILTERS.indexOf(v.slice(5) as (typeof PLATFORM_FILTERS)[number]) - 100 : (tagMeta.get(v)?.position ?? 0));
    const tagOpts = countBy(ofKind, filterTagsOf, (v) => (v.startsWith("plat:") ? v.slice(5) : (tagMeta.get(v)?.name ?? v)), 20).sort((a, b) => rank(a.value) - rank(b.value));
    const onlyPlatforms = tagOpts.every((t) => t.value.startsWith("plat:"));
    if (tagOpts.length) out.push({ id: "tag", label: onlyPlatforms ? "Plataforma" : "Tags", tags: tagOpts });
    if (kind !== "book") out.push({ id: "genre", label: "Gênero", tags: countBy(ofKind, genresOf, (v) => v, 12) });
    return out;
  }, [kind, ofKind, tagMeta, filterTagsOf]);

  const visible = useMemo(() => {
    const nq = normalize(q);
    let list = ofKind.filter((i) => {
      if (nq && !normalize([i.title, ...i.creators, ...i.genres, ...i.tagIds.map((t) => tagMeta.get(t)?.name ?? "")].join(" ")).includes(nq)) return false;
      if (onlyPinned && !i.pinned) return false;
      if (onlyMine && accessFor(i, ctx.myProviders).tier !== "mine") return false;
      if (onlySale && !(i.steamPrice?.discountPercent ?? 0)) return false;
      if (filter.tag && !filterTagsOf(i).includes(filter.tag)) return false;
      if (filter.genre && !genresOf(i).includes(filter.genre)) return false;
      if (provider != null && !streamsOn(i).some((p) => p.id === provider)) return false;
      return true;
    });
    const len = (i: LiteItem) => (i.kind === "book" ? (i.pages ?? 9999) * 1.2 : (i.minutes ?? 99999));
    const pin = (a: LiteItem, b: LiteItem) => Number(b.pinned) - Number(a.pinned);
    const h = (s: string) => [...s].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0) + seed) | 0, seed);
    const cmp: Record<SortId, (a: LiteItem, b: LiteItem) => number> = {
      score: (a, b) => pin(a, b) || (b.score ?? -1) - (a.score ?? -1),
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      short: (a, b) => len(a) - len(b),
      az: (a, b) => a.title.localeCompare(b.title, "pt-BR"),
      shuffle: (a, b) => h(a.id) - h(b.id),
    };
    list = [...list].sort(cmp[sort]);
    return list;
  }, [ofKind, q, filter, onlyPinned, onlyMine, onlySale, provider, sort, ctx.myProviders, seed, tagMeta, filterTagsOf]);

  // Seus streamings que têm algo nesta divisão (filtro com o logo)
  const streamKinds = kind === "all" || kind === "movie" || kind === "series";
  const providers = useMemo(() => {
    if (readOnly || !streamKinds) return [];
    const mine = new Set(ctx.myProviders);
    const m = new Map<number, { id: number; name: string; logo: string | null; count: number }>();
    for (const i of ofKind)
      for (const p of streamsOn(i)) if (mine.has(p.id)) m.set(p.id, { ...p, count: (m.get(p.id)?.count ?? 0) + 1 });
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [ofKind, ctx.myProviders, readOnly, streamKinds]);

  // Jogos instalados (Switch/PC) por igdbId, para o grupo "Instalados" e o selo com o tamanho
  const gameGroups = kind === "game" && !readOnly && mode !== "home";
  const installedBy = useMemo(() => {
    const m = new Map<number, InstalledLite[]>();
    for (const r of ctx.installed) m.set(r.igdbId, [...(m.get(r.igdbId) ?? []), r]);
    return m;
  }, [ctx.installed]);
  const installedLabel = (i: LiteItem) => {
    const rows = i.igdbId != null ? installedBy.get(i.igdbId) : undefined;
    return rows?.map((r) => `${r.platform === "pc" ? "PC" : "Switch"} ${formatSize(r.sizeMb)}`).join(" · ");
  };

  // Agrupamento: Tudo → por divisão; Jogos → Instalados, Quero muito, Backlog; divisão com tags → pela combinação de tags
  const sections = useMemo((): Section[] => {
    const filtering = !!q || !!filter.tag || !!filter.genre || onlyPinned || onlyMine || onlySale || provider != null;
    if (gameGroups) {
      const isInst = (i: LiteItem) => i.igdbId != null && installedBy.has(i.igdbId);
      // Instalados que não estão no backlog também entram (só a busca e o filtro de plataforma valem para eles)
      const mine = new Set(items.filter((i) => i.kind === "game").map((i) => i.igdbId));
      const plat = filter.tag?.startsWith("plat:") ? (filter.tag.slice(5) === "PC" ? "pc" : "switch") : null;
      const otherFilters = !!filter.genre || (!!filter.tag && !plat) || onlyPinned || onlyMine || onlySale || provider != null;
      const nq = normalize(q);
      const seen = new Set<number>();
      const extra = otherFilters
        ? []
        : ctx.installed.filter((r) => {
            if (mine.has(r.igdbId) || seen.has(r.igdbId)) return false;
            if (plat && !(installedBy.get(r.igdbId) ?? []).some((x) => x.platform === plat)) return false;
            if (nq && !normalize(r.title).includes(nq)) return false;
            seen.add(r.igdbId);
            return true;
          });
      return [
        { key: "installed", title: "Instalados", hint: "No Switch ou no PC", href: undefined, items: visible.filter(isInst), extra },
        { key: "liked", title: "♥ Quero muito", hint: "Priorizados que ainda não estão instalados", href: undefined, items: visible.filter((i) => !isInst(i) && i.pinned) },
        { key: "backlog", title: "Backlog", hint: undefined, href: undefined, items: visible.filter((i) => !isInst(i) && !i.pinned) },
      ].filter((s) => s.items.length || s.extra?.length);
    }
    if (filtering) return [{ key: "all", title: "", href: undefined as string | undefined, items: visible }];
    if (kind === "all")
      return KINDS.map((k) => ({ key: k, title: KIND_META[k].plural, href: `${base}?k=${k}` as string | undefined, items: visible.filter((i) => i.kind === k) })).filter(
        (g) => g.items.length,
      );
    if (!tagList.some((t) => t.kind === kind)) return [{ key: "all", title: "", href: undefined, items: visible }];
    const keyOf = (i: LiteItem) => {
      const names = i.tagIds.map((t) => tagMeta.get(t)).filter(Boolean).sort((a, b) => a!.position - b!.position).map((t) => t!.name);
      return names.length ? names.join(" + ") : "Sem tag";
    };
    const m = new Map<string, LiteItem[]>();
    for (const i of visible) m.set(keyOf(i), [...(m.get(keyOf(i)) ?? []), i]);
    return [...m.entries()]
      .sort((a, b) => (a[0] === "Sem tag" ? 1 : b[0] === "Sem tag" ? -1 : b[1].length - a[1].length))
      .map(([k, items]) => ({ key: k, title: k, href: undefined, items }));
  }, [visible, kind, q, filter, onlyPinned, onlyMine, onlySale, provider, tagList, tagMeta, base, gameGroups, installedBy, items, ctx.installed]);

  // Livros da família: lista compartilhada, sempre no fim da divisão Livros
  const family = useMemo(() => {
    if (readOnly || mode === "home" || kind !== "book") return null;
    const nq = normalize(q);
    return nq ? ctx.family.filter((i) => normalize([i.title, ...i.creators].join(" ")).includes(nq)) : ctx.family;
  }, [readOnly, mode, kind, q, ctx.family]);

  const quick = [
    { on: onlyPinned, set: setOnlyPinned, label: "♥ Quero muito", show: true },
    // Com a linha de streamings, o "Todos os meus" fica lá
    { on: onlyMine, set: setOnlyMine, label: "No meu streaming", show: !readOnly && streamKinds && !providers.length && ctx.myProviders.length > 0 },
    { on: onlySale, set: setOnlySale, label: "Em promoção", show: kind === "game" },
  ].filter((x) => x.show);

  const home = mode === "home";
  return (
    <div className={home ? "" : "mx-auto max-w-[1600px] pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28"}>
      <header className={GUTTER}>
        {owner && <p className="mb-1 text-[13px] font-medium text-accent-2">Backlog de {owner.name?.split(" ")[0]} · só leitura</p>}
        <div className="flex items-end justify-between gap-4">
          {home ? (
            <h2 className="text-[24px] font-bold tracking-tight lg:text-[30px]">Seu backlog</h2>
          ) : (
            <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">
              {TITLES[kind]} <span className="text-[0.55em] font-semibold text-text-3">{visible.length}</span>
            </h1>
          )}
          <div className="flex items-center gap-2">
            {!readOnly && !home && kind === "game" && (
              <Link href="/descobrir" className="glass tap flex h-11 items-center gap-2 rounded-full pl-3 pr-4 text-[14px] font-medium text-white/85 hover:text-white" aria-label="Descobrir">
                <Compass size={17} /> <span className="hidden sm:inline">Descobrir</span>
              </Link>
            )}
            {sort === "shuffle" && (
              <button onClick={() => setSeed((s) => s + 1)} className="glass tap flex h-11 w-11 items-center justify-center rounded-full" aria-label="Embaralhar de novo">
                <Shuffle size={17} />
              </button>
            )}
            <SortMenu value={sort} onChange={setSort} />
          </div>
        </div>
      </header>

      {/* Jogos não usam tag: PC e Switch vêm da plataforma do IGDB */}
      {!readOnly && !home && kind !== "all" && kind !== "game" && (
        <div className={GUTTER}>
          <TagNudge key={kind} kind={kind} count={ofKind.length} />
        </div>
      )}

      {readOnly && (
        <div className={`mt-4 ${GUTTER}`}>
          <div className="glass no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
            {(["all", ...KINDS] as const).map((k) => (
              <button key={k} onClick={() => goKind(k)} className="relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium">
                {kind === k && <motion.span layoutId="ro-kind" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className={`relative ${kind === k ? "text-white" : "text-white/70"}`}>{k === "all" ? "Tudo" : KIND_META[k].plural}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Busca, filtros rápidos e tags da divisão */}
      <div className={`sticky z-30 mt-4 space-y-2.5 py-3 ${home ? "top-0 lg:top-20" : "top-0 lg:top-20"}`}>
        <div className={`flex flex-col gap-2.5 sm:flex-row sm:items-center ${GUTTER}`}>
          <div className="glass relative flex h-11 items-center rounded-full sm:w-80">
            <Search size={16} className="pointer-events-none absolute left-4 text-text-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, autor, gênero…" className="h-full w-full bg-transparent pl-10 pr-9 text-[14px] outline-none placeholder:text-text-3" />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3.5 text-text-2" aria-label="Limpar">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {quick.map((x) => (
              <TagChip key={x.label} on={x.on} onClick={() => x.set(!x.on)}>
                {x.label}
              </TagChip>
            ))}
          </div>
        </div>
        {!readOnly && streamKinds && (providers.length > 0 || !ctx.myProviders.length) && (
          <div className={`no-scrollbar flex items-center gap-2 overflow-x-auto ${GUTTER}`}>
            <span className="shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Streaming</span>
            {providers.length > 0 ? (
              <>
                <TagChip
                  on={onlyMine && provider == null}
                  onClick={() => {
                    setProvider(null);
                    setOnlyMine(!(onlyMine && provider == null));
                  }}
                >
                  Todos os meus
                </TagChip>
                {providers.map((p) => {
                  const on = provider === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setOnlyMine(false);
                        setProvider(on ? null : p.id);
                      }}
                      aria-pressed={on}
                      title={p.name}
                      className={`tap flex h-9 shrink-0 items-center gap-2 rounded-full pl-1 pr-3.5 text-[13px] font-medium transition-colors ${on ? "btn-accent" : "glass text-white/75 hover:text-white"}`}
                    >
                      <span className="h-7 w-7 overflow-hidden rounded-full bg-white/10">{p.logo && <img src={p.logo} alt="" className="h-full w-full object-cover" loading="lazy" />}</span>
                      {shortName(p.name)} <span className="opacity-55">{p.count}</span>
                    </button>
                  );
                })}
              </>
            ) : (
              <Link href="/ajustes" className="glass tap flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium text-white/75 hover:text-white">
                + Marcar meus streamings
              </Link>
            )}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.id} className={`no-scrollbar flex items-center gap-2 overflow-x-auto ${GUTTER}`}>
            <span className="shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.label}</span>
            {g.tags.map((t) => {
              const on = filter[g.id] === t.value;
              return (
                <TagChip key={t.value} on={on} onClick={() => setFilter((s) => ({ ...s, [g.id]: on ? null : t.value }))}>
                  {t.label} <span className="opacity-55">{t.count}</span>
                </TagChip>
              );
            })}
          </div>
        ))}
      </div>

      <div className="space-y-10 pt-3">
        {sections.map((s) => (
          <section key={s.key}>
            {s.title && (
              <div className={`mb-3 flex items-baseline justify-between ${GUTTER}`}>
                <div className="min-w-0">
                  <h3 className="text-[20px] font-bold tracking-tight lg:text-[22px]">
                    {s.title} <span className="text-[14px] font-semibold text-text-3">{s.items.length + (s.extra?.length ?? 0)}</span>
                  </h3>
                  {s.hint && <p className="mt-0.5 text-[13px] text-text-3">{s.hint}</p>}
                </div>
                {s.href && kind === "all" && (
                  <Link
                    href={s.href}
                    onClick={(e) => {
                      if (home) return;
                      e.preventDefault();
                      goKind(s.key as Kind);
                    }}
                    className="group flex items-center gap-0.5 text-[13px] font-medium text-text-2 hover:text-white"
                  >
                    Abrir <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            )}
            <div className={`grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-5 2xl:grid-cols-8 ${GUTTER}`}>
              {s.items.map((i, idx) => (
                <div key={i.id} className="rise" style={{ animationDelay: `${Math.min(idx, 18) * 20}ms` }}>
                  <Poster item={i} morph={!noMorphIds?.has(i.id)} eager={idx < 12} installed={gameGroups ? installedLabel(i) : undefined} />
                </div>
              ))}
              {s.extra?.map((r, idx) => (
                <div key={r.id} className="rise" style={{ animationDelay: `${Math.min(s.items.length + idx, 18) * 20}ms` }}>
                  <InstalledCard row={r} label={(installedBy.get(r.igdbId) ?? [r]).map((x) => `${x.platform === "pc" ? "PC" : "Switch"} ${formatSize(x.sizeMb)}`).join(" · ")} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!sections.length && <p className="px-4 py-24 text-center text-text-2">Nada por aqui com esses filtros.</p>}

      {family && (!q || family.length > 0) && (
        <section className="mt-16">
          <div className={`mb-3 flex items-end justify-between gap-4 ${GUTTER}`}>
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-[20px] font-bold tracking-tight lg:text-[22px]">
                <Baby size={20} className="text-accent-2" /> {COLLECTIONS[FAMILY_LIST].title} <span className="text-[14px] font-semibold text-text-3">{family.length}</span>
              </h3>
              <p className="mt-0.5 text-[13px] text-text-2">{COLLECTIONS[FAMILY_LIST].subtitle}</p>
            </div>
            <Link href="/adicionar?k=book&para=familia" className="glass tap flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-white/80 hover:text-white">
              <Plus size={15} /> Adicionar
            </Link>
          </div>
          {family.length ? (
            <div className={`grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-5 2xl:grid-cols-8 ${GUTTER}`}>
              {family.map((i, idx) => (
                <div key={i.id} className="rise" style={{ animationDelay: `${Math.min(idx, 18) * 20}ms` }}>
                  <Poster item={i} morph={!noMorphIds?.has(i.id)} />
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-[14px] text-text-3 ${GUTTER}`}>Nenhum livro ainda.</p>
          )}
        </section>
      )}
    </div>
  );
}

type Section = { key: string; title: string; hint?: string; href: string | undefined; items: LiteItem[]; extra?: InstalledLite[] };

// Jogo instalado que não está no backlog: capa com screenshots, um pouco apagada; o botão direito põe no backlog
function InstalledCard({ row, label }: { row: InstalledLite; label: string }) {
  const openMenu = useGameMenu();
  return (
    <Link
      href={`/jogo/${row.igdbId}`}
      aria-label={row.title}
      className="group relative block"
      onContextMenu={(e) => openMenu(e, { igdbId: row.igdbId, title: row.title, coverUrl: row.coverUrl })}
    >
      <ShotCover
        id={row.id}
        title={row.title}
        coverUrl={row.coverUrl}
        screenshots={row.screenshots}
        dim
        overlay={(scrubbing) =>
          !scrubbing && (
            <>
              <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/10">Fora do backlog</span>
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-success/90 px-2 py-0.5 text-[10.5px] font-semibold text-black">
                <HardDrive size={10} /> {label}
              </span>
            </>
          )
        }
      />
    </Link>
  );
}

function TagChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`tap h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors ${on ? "btn-accent" : "glass text-white/75 hover:text-white"}`}>
      {children}
    </button>
  );
}

// Seletor de ordenação em vidro, com ícone e descrição
function SortMenu({ value, onChange }: { value: SortId; onChange: (v: SortId) => void }) {
  const [open, setOpen] = useState(false);
  const current = SORTS.find((s) => s.id === value)!;
  const Icon = current.icon;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="glass tap flex h-11 items-center gap-2 rounded-full pl-3 pr-3.5 text-[14px] font-medium">
        <span className="btn-accent flex h-7 w-7 items-center justify-center rounded-full">
          <Icon size={14} />
        </span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={16} className={`text-text-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Fechar" />
            <motion.ul
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 460, damping: 34 }}
              className="glass-strong absolute right-0 top-14 z-50 w-72 origin-top-right rounded-3xl p-2"
            >
              <li className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Ordenar por</li>
              {SORTS.map((s) => {
                const I = s.icon;
                const on = s.id === value;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        onChange(s.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${on ? "bg-white/10" : "hover:bg-white/5"}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${on ? "btn-accent" : "bg-white/8 text-white/70"}`}>
                        <I size={17} />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[14px] font-semibold">{s.label}</span>
                        <span className="block text-[12px] text-white/50">{s.hint}</span>
                      </span>
                      {on && <Check size={17} className="text-accent-2" />}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
