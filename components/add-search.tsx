/* eslint-disable @next/next/no-img-element -- capas externas */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { addFromImdb, addItem, searchAction } from "@/app/actions";
import type { Kind } from "@/lib/db/schema";
import { KIND_META, KINDS } from "@/lib/kinds";
import { Chip } from "./chip";

type Result = Awaited<ReturnType<typeof searchAction>>[number];

export function useSearch(kind: Kind | "any", query: string) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const active = query.trim().length >= 2;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await searchAction(kind, q);
        if (id === seq.current) setResults(r);
      } catch {
        if (id === seq.current) setError("A busca falhou. Tenta de novo.");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [kind, query]);

  return { results: active ? results : [], loading: active && loading, error: active ? error : null };
}

export function AddSearch({ initialQuery, initialKind, imdbId }: { initialQuery: string; initialKind: Kind | "any"; imdbId: string | null }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | "any">(initialKind);
  const [query, setQuery] = useState(initialQuery);
  const [adding, setAdding] = useState<string | null>(null);
  const [, start] = useTransition();
  const { results, loading, error } = useSearch(kind, query);

  function add(r: Result) {
    const key = `${r.kind}:${r.externalId}`;
    setAdding(key);
    start(async () => {
      try {
        const id = await addItem(r.kind, r.externalId);
        router.push(`/item/${id}`);
      } catch {
        setAdding(null);
        alert("Não consegui adicionar. Tenta de novo.");
      }
    });
  }

  return (
    <div className="mt-5">
      {imdbId && (
        <button
          onClick={() => {
            setAdding("imdb");
            start(async () => {
              const id = await addFromImdb(imdbId);
              if (id) router.push(`/item/${id}`);
              else setAdding(null);
            });
          }}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 font-semibold text-accent-ink"
        >
          {adding === "imdb" ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          Adicionar o link do IMDb compartilhado
        </button>
      )}

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          autoFocus={!imdbId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome do filme, série, jogo ou livro"
          className="w-full rounded-2xl bg-surface py-3.5 pl-11 pr-10 text-base outline-none ring-1 ring-line placeholder:text-muted focus:ring-accent/60"
        />
        {loading && <Loader2 size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip active={kind === "any"} onClick={() => setKind("any")}>
          Tudo
        </Chip>
        {KINDS.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)} color={KIND_META[k].color}>
            {KIND_META[k].label}
          </Chip>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <ul className="mt-4 divide-y divide-line">
        {results.map((r) => {
          const key = `${r.kind}:${r.externalId}`;
          return (
            <li key={key}>
              <button onClick={() => add(r)} disabled={!!adding} className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-60">
                <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line">
                  {r.cover && <img src={r.cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted">
                    <span style={{ color: KIND_META[r.kind].color }}>●</span> {[r.year, r.subtitle].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-line">
                  {adding === key ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!loading && query.trim().length >= 2 && !results.length && !error && <p className="mt-6 text-center text-sm text-muted">Nada encontrado.</p>}
    </div>
  );
}
