"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownUp, Check, Search, Shuffle, X } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { normalize } from "@/lib/sources/http";
import { accessFor, KIND_META, KINDS } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Poster } from "./poster";
import { GUTTER } from "./rail";

const SORTS = [
  { id: "score", label: "Maior nota" },
  { id: "recent", label: "Mais recentes" },
  { id: "short", label: "Mais curtos" },
  { id: "az", label: "A–Z" },
  { id: "shuffle", label: "Aleatório" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const FILTERS = [
  { id: "pinned", label: "♥ Quero muito", kinds: null },
  { id: "mine", label: "No meu streaming", kinds: ["movie", "series"] },
  { id: "switch", label: "Switch", kinds: ["game"] },
  { id: "pc", label: "PC", kinds: ["game"] },
  { id: "sale", label: "Em promoção", kinds: ["game"] },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const TITLES: Record<Kind | "all", string> = { all: "Tudo", movie: "Filmes", series: "Séries", game: "Jogos", book: "Livros" };

export function ListBrowser({ items: external, owner }: { items?: LiteItem[]; owner?: { name: string | null } }) {
  const ctx = useBacklog();
  const items = external ?? ctx.items;
  const readOnly = !!external;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const kindParam = sp.get("k");
  const kind: Kind | "all" = KINDS.includes(kindParam as Kind) ? (kindParam as Kind) : "all";
  const [sort, setSort] = useState<SortId>(SORTS.some((s) => s.id === sp.get("sort")) ? (sp.get("sort") as SortId) : "score");
  const initialFilter = sp.get("f");
  const [filters, setFilters] = useState<Set<Filter>>(new Set(FILTERS.some((f) => f.id === initialFilter) ? [initialFilter as Filter] : []));
  const [q, setQ] = useState("");
  const [seed, setSeed] = useState(1);
  const [sortOpen, setSortOpen] = useState(false);

  const setKind = (k: Kind | "all") => {
    const params = new URLSearchParams(sp.toString());
    if (k === "all") params.delete("k");
    else params.set("k", k);
    params.delete("f");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  const toggle = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const nq = normalize(q);
    let list = items.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (nq && !normalize([i.title, ...i.creators, ...i.genres].join(" ")).includes(nq)) return false;
      if (filters.has("pinned") && !i.pinned) return false;
      if (filters.has("mine") && accessFor(i, ctx.myProviders).tier !== "mine") return false;
      if (filters.has("switch") && !i.myPlatforms.includes("Switch")) return false;
      if (filters.has("pc") && !i.myPlatforms.includes("PC")) return false;
      if (filters.has("sale") && !(i.steamPrice?.discountPercent ?? 0)) return false;
      return true;
    });
    const len = (i: LiteItem) => (i.kind === "book" ? (i.pages ?? 9999) * 1.2 : (i.minutes ?? 99999));
    const pin = (a: LiteItem, b: LiteItem) => Number(b.pinned) - Number(a.pinned);
    switch (sort) {
      case "score":
        list = [...list].sort((a, b) => pin(a, b) || (b.score ?? -1) - (a.score ?? -1));
        break;
      case "recent":
        list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "short":
        list = [...list].sort((a, b) => len(a) - len(b));
        break;
      case "az":
        list = [...list].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
        break;
      case "shuffle": {
        const h = (s: string) => [...s].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0) + seed) | 0, seed);
        list = [...list].sort((a, b) => h(a.id) - h(b.id));
        break;
      }
    }
    return list;
  }, [items, kind, q, filters, sort, ctx.myProviders, seed]);

  const availableFilters = FILTERS.filter((f) => !f.kinds || kind === "all" || (f.kinds as readonly string[]).includes(kind)).filter(
    (f) => !readOnly || f.id !== "mine",
  );

  return (
    <div className="mx-auto max-w-[1600px] pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28">
      <header className={GUTTER}>
        {owner && <p className="mb-1 text-[13px] font-medium text-accent-2">Backlog de {owner.name?.split(" ")[0]} · só leitura</p>}
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">
            {TITLES[kind]} <span className="text-[0.55em] font-semibold text-text-3">{visible.length}</span>
          </h1>
          <div className="relative flex items-center gap-2">
            {sort === "shuffle" && (
              <button onClick={() => setSeed((s) => s + 1)} className="glass tap flex h-10 w-10 items-center justify-center rounded-full" aria-label="Embaralhar">
                <Shuffle size={17} />
              </button>
            )}
            <button onClick={() => setSortOpen((v) => !v)} className="glass tap flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium">
              <ArrowDownUp size={15} /> <span className="hidden sm:inline">{SORTS.find((s) => s.id === sort)?.label}</span>
            </button>
            <AnimatePresence>
              {sortOpen && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" onClick={() => setSortOpen(false)} aria-label="Fechar" />
                  <motion.ul
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="glass-strong absolute right-0 top-12 z-50 w-48 origin-top-right rounded-2xl p-1.5"
                  >
                    {SORTS.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => {
                            setSort(s.id);
                            setSortOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] hover:bg-white/10"
                        >
                          {s.label} {sort === s.id && <Check size={16} className="text-accent-2" />}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Barra de ferramentas fixa em vidro */}
      <div className="sticky top-0 z-30 mt-5 pb-3 pt-3 lg:top-20">
        <div className={`flex flex-col gap-3 lg:flex-row lg:items-center ${GUTTER}`}>
          <div className="glass no-scrollbar flex shrink-0 gap-1 overflow-x-auto rounded-full p-1">
            {(["all", ...KINDS] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className="relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium">
                {kind === k && <motion.span layoutId="kind-pill" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className={`relative ${kind === k ? "text-white" : "text-white/70"}`}>
                  {k === "all" ? "Tudo" : KIND_META[k].plural} <span className="opacity-55">{counts[k] ?? 0}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="glass relative flex h-10 flex-1 items-center rounded-full lg:max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3.5 text-text-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, autor, gênero…" className="h-full w-full bg-transparent pl-10 pr-9 text-[14px] outline-none placeholder:text-text-3" />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 text-text-2" aria-label="Limpar">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {availableFilters.map((f) => {
              const on = filters.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  className={`tap h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors ${on ? "bg-white text-black" : "glass text-white/75"}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <motion.div layout className={`grid grid-cols-3 gap-3 pt-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-5 2xl:grid-cols-8 ${GUTTER}`}>
        {visible.map((i, idx) => (
          <div key={i.id} className="rise" style={{ animationDelay: `${Math.min(idx, 24) * 22}ms` }}>
            <Poster item={i} morph eager={idx < 12} href={readOnly ? `/item/${i.id}` : undefined} />
          </div>
        ))}
      </motion.div>
      {!visible.length && <p className="px-4 py-24 text-center text-text-2">Nada por aqui com esses filtros.</p>}
    </div>
  );
}
