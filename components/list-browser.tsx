"use client";

import { useMemo, useState } from "react";
import { Search, Shuffle, X } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { normalize } from "@/lib/sources/http";
import { accessFor, KIND_META, KINDS } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { Chip } from "./chip";
import { Poster } from "./item-card";

const SORTS = [
  { id: "score", label: "Nota" },
  { id: "recent", label: "Recentes" },
  { id: "short", label: "Mais curtos" },
  { id: "az", label: "A–Z" },
  { id: "shuffle", label: "Aleatório" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const FILTERS = ["mine", "want", "switch", "pc", "sale"] as const;
type Filter = (typeof FILTERS)[number];

export function ListBrowser({
  items,
  myProviders,
  userId,
  initial,
}: {
  items: LiteItem[];
  myProviders: number[];
  userId: string;
  initial: { kind?: string; filter?: string; sort?: string };
}) {
  const [kind, setKind] = useState<Kind | "all">(KINDS.includes(initial.kind as Kind) ? (initial.kind as Kind) : "all");
  const [sort, setSort] = useState<SortId>(SORTS.some((s) => s.id === initial.sort) ? (initial.sort as SortId) : "score");
  const [filters, setFilters] = useState<Set<Filter>>(new Set(FILTERS.includes(initial.filter as Filter) ? [initial.filter as Filter] : []));
  const [q, setQ] = useState("");
  const [seed, setSeed] = useState(1);

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
      if (filters.has("mine") && accessFor(i, myProviders).tier !== "mine") return false;
      if (filters.has("want") && !i.interestedIds.includes(userId)) return false;
      if (filters.has("switch") && !i.myPlatforms.includes("Switch")) return false;
      if (filters.has("pc") && !i.myPlatforms.includes("PC")) return false;
      if (filters.has("sale") && !(i.steamPrice?.discountPercent ?? 0)) return false;
      return true;
    });
    const len = (i: LiteItem) => (i.kind === "book" ? (i.pages ?? 9999) * 1.2 : (i.minutes ?? 99999));
    switch (sort) {
      case "score":
        list = [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
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
  }, [items, kind, q, filters, sort, myProviders, userId, seed]);

  const showGame = kind === "game" || kind === "all";
  const showAv = kind === "movie" || kind === "series" || kind === "all";

  return (
    <div>
      <div className="sticky top-0 z-30 bg-bg/90 pb-3 pt-[calc(env(safe-area-inset-top)+16px)] backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Título, autor, gênero"
              className="h-10 w-full rounded-full bg-bg-3 pl-9 pr-9 text-[15px] outline-none placeholder:text-text-3"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3" aria-label="Limpar">
                <X size={16} />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortId)}
            className="h-10 rounded-full bg-bg-3 px-3.5 text-sm text-text-2 outline-none"
            aria-label="Ordenar"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {sort === "shuffle" && (
            <button onClick={() => setSeed((s) => s + 1)} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-bg-3" aria-label="Embaralhar de novo">
              <Shuffle size={17} />
            </button>
          )}
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
          <Chip active={kind === "all"} onClick={() => setKind("all")}>
            Tudo <span className="opacity-50">{counts.all}</span>
          </Chip>
          {KINDS.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {KIND_META[k].plural} <span className="opacity-50">{counts[k] ?? 0}</span>
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          <Chip active={filters.has("want")} onClick={() => toggle("want")}>
            Eu quero
          </Chip>
          {showAv && (
            <Chip active={filters.has("mine")} onClick={() => toggle("mine")}>
              No meu streaming
            </Chip>
          )}
          {showGame && (
            <>
              <Chip active={filters.has("switch")} onClick={() => toggle("switch")}>
                Switch
              </Chip>
              <Chip active={filters.has("pc")} onClick={() => toggle("pc")}>
                PC
              </Chip>
              <Chip active={filters.has("sale")} onClick={() => toggle("sale")}>
                Em promoção
              </Chip>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 pt-1 sm:grid-cols-4 md:grid-cols-6">
        {visible.map((i, idx) => (
          <Poster key={i.id} item={i} myProviders={myProviders} eager={idx < 9} />
        ))}
      </div>
      {!visible.length && <p className="px-4 py-16 text-center text-sm text-text-2">Nada por aqui com esses filtros.</p>}
    </div>
  );
}
