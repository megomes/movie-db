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
    <div>
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
          className="tap mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-pill text-[15px] font-medium text-white"
        >
          {adding === "imdb" ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          Adicionar o link do IMDb compartilhado
        </button>
      )}

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          autoFocus={!imdbId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome do filme, série, jogo ou livro"
          className="h-11 w-full rounded-full bg-bg-3 pl-11 pr-10 text-base outline-none placeholder:text-text-3"
        />
        {loading && <Loader2 size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-text-3" />}
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip active={kind === "any"} onClick={() => setKind("any")}>
          Tudo
        </Chip>
        {KINDS.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            {KIND_META[k].plural}
          </Chip>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <ul className="mt-3">
        {results.map((r) => {
          const key = `${r.kind}:${r.externalId}`;
          return (
            <li key={key}>
              <button onClick={() => add(r)} disabled={!!adding} className="tap flex w-full items-center gap-3 py-2 text-left disabled:opacity-60">
                <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-bg-3">
                  {r.cover && <img src={r.cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{r.title}</p>
                  <p className="truncate text-[13px] text-text-2">{[r.year, r.subtitle].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line">
                  {adding === key ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!loading && query.trim().length >= 2 && !results.length && !error && <p className="mt-6 text-center text-sm text-text-2">Nada encontrado.</p>}
    </div>
  );
}
