"use client";

import { useMemo, useState } from "react";
import { Search, Shuffle } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { normalize } from "@/lib/sources/http";
import { accessFor, KIND_META, KINDS } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { Chip } from "./chip";
import { ItemCard } from "./item-card";

const SORTS = [
  { id: "score", label: "Nota" },
  { id: "recent", label: "Recentes" },
  { id: "short", label: "Mais curtos" },
  { id: "az", label: "A–Z" },
  { id: "shuffle", label: "Aleatório" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

type Filter = "mine" | "want" | "switch" | "pc" | "sale";


export function ListBrowser({ items, myProviders, userId }: { items: LiteItem[]; myProviders: number[]; userId: string }) {
  const [kind, setKind] = useState<Kind | "all">("all");
  const [sort, setSort] = useState<SortId>("score");
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
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
        // Embaralha de forma estável para o mesmo seed
        const h = (s: string) => [...s].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0) + seed) | 0, seed);
        list = [...list].sort((a, b) => h(a.id) - h(b.id));
        break;
      }
    }
    return list;
  }, [items, kind, q, filters, sort, myProviders, userId, seed]);

  const showGameFilters = kind === "game" || kind === "all";
  const showAvFilters = kind === "movie" || kind === "series" || kind === "all";

  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-line bg-bg/85 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar na lista, autor, gênero…"
              className="w-full rounded-xl bg-surface py-2.5 pl-9 pr-3 text-sm outline-none ring-1 ring-line placeholder:text-muted focus:ring-accent/60"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortId)}
            className="rounded-xl bg-surface px-3 py-2.5 text-sm outline-none ring-1 ring-line"
            aria-label="Ordenar"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {sort === "shuffle" && (
            <button onClick={() => setSeed((s) => s + 1)} className="rounded-xl bg-surface p-2.5 ring-1 ring-line" aria-label="Embaralhar de novo">
              <Shuffle size={18} />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <Chip active={kind === "all"} onClick={() => setKind("all")}>
            Tudo <span className="opacity-60">{counts.all}</span>
          </Chip>
          {KINDS.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)} color={KIND_META[k].color}>
              {KIND_META[k].plural} <span className="opacity-60">{counts[k] ?? 0}</span>
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          <Chip active={filters.has("want")} onClick={() => toggle("want")}>
            ♥ Eu quero
          </Chip>
          {showAvFilters && (
            <Chip active={filters.has("mine")} onClick={() => toggle("mine")} color="var(--ok)">
              No meu streaming
            </Chip>
          )}
          {showGameFilters && (
            <>
              <Chip active={filters.has("switch")} onClick={() => toggle("switch")}>
                Switch
              </Chip>
              <Chip active={filters.has("pc")} onClick={() => toggle("pc")}>
                PC
              </Chip>
              <Chip active={filters.has("sale")} onClick={() => toggle("sale")} color="var(--warn)">
                Em promoção
              </Chip>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-4 pt-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {visible.map((i) => (
          <ItemCard key={i.id} item={i} myProviders={myProviders} showKind={kind === "all"} />
        ))}
      </div>
      {!visible.length && <p className="px-4 py-16 text-center text-sm text-muted">Nada por aqui com esses filtros.</p>}
    </div>
  );
}
