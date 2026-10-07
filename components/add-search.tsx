/* eslint-disable @next/next/no-img-element -- capas externas */
"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { addItem, resolveImdb } from "@/app/actions";
import type { Kind } from "@/lib/db/schema";
import { KIND_META, KINDS } from "@/lib/kinds";
import type { SearchResult as Result } from "@/lib/search";
import { normalize } from "@/lib/sources/http";
import { useBacklog } from "./backlog-context";
import { useTagAsk } from "./tag-picker";

export function useSearch(kind: Kind | "any", query: string) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = query.trim().length >= 2;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?${new URLSearchParams({ kind, q })}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        setResults(await res.json());
        setLoading(false);
      } catch {
        if (ctrl.signal.aborted) return;
        setError("A busca falhou. Tenta de novo.");
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [kind, query]);

  return { results: active ? results : [], loading: active && loading, error: active ? error : null };
}

export function AddSearch({
  initialQuery,
  initialKind,
  imdbId,
  collection,
}: {
  initialQuery: string;
  initialKind: Kind | "any";
  imdbId: string | null;
  /** Lista compartilhada de destino (ex.: Livros da família): sem tags, só livros */
  collection?: string;
}) {
  const { items: mine, family } = useBacklog();
  const items = collection ? family : mine;
  const [kind, setKind] = useState<Kind | "any">(initialKind);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<Record<string, "adding" | string>>({});
  const { results, loading, error } = useSearch(kind, query);
  const { ask, picker } = useTagAsk();

  // Marca o que já está no backlog (pelo título + ano)
  const owned = useMemo(() => new Set(items.map((i) => `${normalize(i.title)}|${i.year ?? ""}`)), [items]);

  // Sempre pergunta a tag quando a divisão tem tags (lista compartilhada não tem tags)
  const add = useCallback(
    (r: Result) => {
      const key = `${r.kind}:${r.externalId}`;
      if (collection) {
        setStatus((s) => ({ ...s, [key]: "adding" }));
        addItem(r.kind, r.externalId, [], collection).then(
          (id) => setStatus((s) => ({ ...s, [key]: id })),
          () =>
            setStatus((s) => {
              const next = { ...s };
              delete next[key];
              return next;
            }),
        );
        return;
      }
      ask({
        kind: r.kind,
        title: r.title,
        cover: r.cover,
        confirmLabel: "Adicionar ao backlog",
        onConfirm: async (tagIds) => {
          setStatus((s) => ({ ...s, [key]: "adding" }));
          try {
            const id = await addItem(r.kind, r.externalId, tagIds);
            setStatus((s) => ({ ...s, [key]: id }));
            navigator.vibrate?.(12);
          } catch {
            setStatus((s) => {
              const next = { ...s };
              delete next[key];
              return next;
            });
          }
        },
      });
    },
    [ask, collection],
  );

  return (
    <div>
      {picker}
      {imdbId && (
        <button
          onClick={async () => {
            setStatus((s) => ({ ...s, imdb: "adding" }));
            const found = await resolveImdb(imdbId);
            if (!found) return setStatus((s) => ({ ...s, imdb: "" }));
            setStatus((s) => ({ ...s, imdb: "" }));
            ask({
              kind: found.kind,
              title: initialQuery || "Link do IMDb",
              confirmLabel: "Adicionar ao backlog",
              onConfirm: async (tagIds) => {
                setStatus((s) => ({ ...s, imdb: "adding" }));
                const id = await addItem(found.kind, found.externalId, tagIds);
                setStatus((s) => ({ ...s, imdb: id }));
              },
            });
          }}
          className="btn-accent mb-5 flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold"
        >
          {status.imdb === "adding" ? <Loader2 size={18} className="animate-spin" /> : status.imdb ? <Check size={18} /> : <Plus size={18} />}
          {status.imdb && status.imdb !== "adding" ? "Adicionado do IMDb" : "Adicionar o link do IMDb compartilhado"}
        </button>
      )}

      <div className="glass flex h-14 items-center rounded-full px-5 focus-within:border-accent/60">
        <Search size={20} className="text-text-2" />
        <input
          autoFocus={!imdbId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={collection ? "Título ou autor do livro…" : "Filme, série, jogo ou livro…"}
          className="h-full flex-1 bg-transparent pl-3 text-[17px] outline-none placeholder:text-text-3"
        />
        {loading ? (
          <Loader2 size={18} className="animate-spin text-text-2" />
        ) : (
          query && (
            <button onClick={() => setQuery("")} aria-label="Limpar">
              <X size={18} className="text-text-2" />
            </button>
          )
        )}
      </div>

      {!collection && (
      <div className="glass no-scrollbar mt-3 inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
        {(["any", ...KINDS] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className="relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium">
            {kind === k && <motion.span layoutId="add-kind" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className={`relative ${kind === k ? "text-white" : "text-white/70"}`}>{k === "any" ? "Tudo" : KIND_META[k].plural}</span>
          </button>
        ))}
      </div>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-5">
        {results.map((r, idx) => {
          const key = `${r.kind}:${r.externalId}`;
          return <ResultCard key={key} r={r} idx={idx} st={status[key]} already={owned.has(`${normalize(r.title)}|${r.year ?? ""}`)} onAdd={add} />;
        })}
      </div>
      {!loading && query.trim().length >= 2 && !results.length && !error && <p className="mt-10 text-center text-text-2">Nada encontrado.</p>}
      {query.trim().length < 2 && !collection && <p className="mt-10 text-center text-[14px] text-text-3">Dica: no Android, compartilhe um link do IMDb ou da Steam direto para o app.</p>}
    </div>
  );
}

// Cartão memoizado: digitar na busca não re-renderiza a grade inteira
const ResultCard = memo(function ResultCard({ r, idx, st, already, onAdd }: { r: Result; idx: number; st?: string; already: boolean; onAdd: (r: Result) => void }) {
  const done = (st && st !== "adding") || already;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(idx, 8) * 0.02 }} className="min-w-0">
      <div className="group relative aspect-[2/3] overflow-hidden rounded-2xl bg-bg-3">
        {r.cover ? (
          <img src={r.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-end p-2.5 text-[12px] font-semibold text-white/70">{r.title}</div>
        )}
        <span className="glass absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">{KIND_META[r.kind].label}</span>
        <button
          onClick={() => !done && st !== "adding" && onAdd(r)}
          className={`absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-[transform,background-color] duration-150 active:scale-[0.85] ${done ? "bg-success text-black" : "btn-accent"}`}
          aria-label={done ? "No backlog" : `Adicionar ${r.title}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={st === "adding" ? "l" : done ? "d" : "p"} initial={{ scale: 0.3, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.3 }} transition={{ duration: 0.15 }}>
              {st === "adding" ? <Loader2 size={18} className="animate-spin" /> : done ? <Check size={19} strokeWidth={3} /> : <Plus size={20} strokeWidth={2.6} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-tight line-clamp-2">{r.title}</p>
      <p className="truncate text-[11.5px] text-white/50">{[r.year, r.subtitle?.split(" · ").slice(1).join(" · ")].filter(Boolean).join(" · ")}</p>
      {st && st !== "adding" && (
        <Link href={`/item/${st}`} className="text-[12px] font-medium text-accent-2">
          Ver →
        </Link>
      )}
    </motion.div>
  );
});

