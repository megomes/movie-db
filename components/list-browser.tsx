"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownAZ, Check, ChevronDown, ChevronRight, Clock, Search, Shuffle, Sparkles, Star, X } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { normalize } from "@/lib/sources/http";
import { ptGenre } from "@/lib/genres";
import { accessFor, KIND_META, KINDS } from "@/lib/kinds";
import type { LiteItem, TagLite } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Poster } from "./poster";
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
  const [filter, setFilter] = useState<{ tag: string | null; genre: string | null }>({ tag: null, genre: null });
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [onlyMine, setOnlyMine] = useState(sp.get("f") === "mine");
  const [onlySale, setOnlySale] = useState(sp.get("f") === "sale");
  const [q, setQ] = useState("");
  const [seed, setSeed] = useState(1);

  // Troca de divisão zera os filtros
  const [lastKind, setLastKind] = useState(kind);
  if (lastKind !== kind) {
    setLastKind(kind);
    setFilter({ tag: null, genre: null });
  }

  const tagMeta = useMemo(() => new Map(tagList.map((t) => [t.id, t])), [tagList]);
  const ofKind = useMemo(() => (kind === "all" ? items : items.filter((i) => i.kind === kind)), [items, kind]);

  const groups = useMemo((): TagGroup[] => {
    if (kind === "all") return [];
    const out: TagGroup[] = [];
    const tagOpts = countBy(ofKind, (i) => i.tagIds.filter((t) => tagMeta.has(t)), (v) => tagMeta.get(v)?.name ?? v, 20).sort(
      (a, b) => (tagMeta.get(a.value)?.position ?? 0) - (tagMeta.get(b.value)?.position ?? 0),
    );
    if (tagOpts.length) out.push({ id: "tag", label: "Tags", tags: tagOpts });
    if (kind !== "book") out.push({ id: "genre", label: "Gênero", tags: countBy(ofKind, genresOf, (v) => v, 12) });
    return out;
  }, [kind, ofKind, tagMeta]);

  const visible = useMemo(() => {
    const nq = normalize(q);
    let list = ofKind.filter((i) => {
      if (nq && !normalize([i.title, ...i.creators, ...i.genres, ...i.tagIds.map((t) => tagMeta.get(t)?.name ?? "")].join(" ")).includes(nq)) return false;
      if (onlyPinned && !i.pinned) return false;
      if (onlyMine && accessFor(i, ctx.myProviders).tier !== "mine") return false;
      if (onlySale && !(i.steamPrice?.discountPercent ?? 0)) return false;
      if (filter.tag && !i.tagIds.includes(filter.tag)) return false;
      if (filter.genre && !genresOf(i).includes(filter.genre)) return false;
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
  }, [ofKind, q, filter, onlyPinned, onlyMine, onlySale, sort, ctx.myProviders, seed, tagMeta]);

  // Agrupamento: Tudo → por divisão; divisão com tags → pela combinação de tags (sem repetir itens)
  const sections = useMemo(() => {
    const filtering = !!q || !!filter.tag || !!filter.genre || onlyPinned || onlyMine || onlySale;
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
  }, [visible, kind, q, filter, onlyPinned, onlyMine, onlySale, tagList, tagMeta, base]);

  const quick = [
    { on: onlyPinned, set: setOnlyPinned, label: "♥ Quero muito", show: true },
    { on: onlyMine, set: setOnlyMine, label: "No meu streaming", show: !readOnly && (kind === "all" || kind === "movie" || kind === "series") },
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
            {sort === "shuffle" && (
              <button onClick={() => setSeed((s) => s + 1)} className="glass tap flex h-11 w-11 items-center justify-center rounded-full" aria-label="Embaralhar de novo">
                <Shuffle size={17} />
              </button>
            )}
            <SortMenu value={sort} onChange={setSort} />
          </div>
        </div>
      </header>

      {!readOnly && !home && kind !== "all" && (
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
                <h3 className="text-[20px] font-bold tracking-tight lg:text-[22px]">
                  {s.title} <span className="text-[14px] font-semibold text-text-3">{s.items.length}</span>
                </h3>
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
                  <Poster item={i} morph={!noMorphIds?.has(i.id)} eager={idx < 12} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!visible.length && <p className="px-4 py-24 text-center text-text-2">Nada por aqui com esses filtros.</p>}
    </div>
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
