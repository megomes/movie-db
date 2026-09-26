/* eslint-disable @next/next/no-img-element -- capas externas */
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Search, Trash2 } from "lucide-react";
import { confirmMatch, deleteItem, rematch } from "@/app/actions";
import type { Candidate, Kind } from "@/lib/db/schema";
import { KIND_META, KINDS } from "@/lib/kinds";
import { useSearch } from "./add-search";
import { Chip } from "./chip";
import { Cover } from "./cover";

type ReviewItem = {
  id: string;
  kind: Kind;
  title: string;
  year: number | null;
  coverUrl: string | null;
  creators: string[];
  matchStatus: "matched" | "needs_review" | "unmatched";
  searchQuery: string;
  candidates: Candidate[];
  sourcePath: string | null;
};

export function ReviewCard({ item, single }: { item: ReviewItem; single: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [searching, setSearching] = useState(item.matchStatus === "unmatched" || single);
  const [kind, setKind] = useState<Kind>(item.kind);
  const [query, setQuery] = useState(item.searchQuery);
  const { results, loading } = useSearch(searching ? kind : item.kind, searching ? query : "");

  const act = (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    start(async () => {
      try {
        await fn();
        if (single) router.push(`/item/${item.id}`);
        else setGone(true);
      } finally {
        setBusy(null);
      }
    });
  };

  if (gone) return null;
  const guessed = item.matchStatus !== "unmatched";
  const options = [...new Map(item.candidates.map((c) => [c.externalId, c])).values()].filter(
    (c) => !(c.title === item.title && c.year === item.year),
  );

  return (
    <article id={item.id} className="rise rounded-2xl bg-surface p-3.5 ring-1 ring-line">
      <p className="text-xs text-muted">
        <span style={{ color: KIND_META[item.kind].color }}>●</span> {KIND_META[item.kind].label} · no Obsidian:{" "}
        <span className="text-text/90">“{item.searchQuery}”</span>
      </p>

      <div className="mt-3 flex gap-3">
        <Cover src={item.coverUrl} title={item.title} kind={item.kind} className="w-20 shrink-0" />
        <div className="min-w-0 flex-1">
          {guessed ? (
            <>
              <p className="text-xs text-muted">Meu palpite</p>
              <p className="font-semibold leading-tight">{item.title}</p>
              <p className="text-xs text-muted">{[item.year, item.creators.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Não achei nada com esse nome. Busque abaixo.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {guessed && !single && (
              <button
                onClick={() => act("ok", () => confirmMatch(item.id))}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-xl bg-ok px-3 py-2 text-sm font-semibold text-bg disabled:opacity-60"
              >
                {busy === "ok" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />} É esse
              </button>
            )}
            {!searching && (
              <button onClick={() => setSearching(true)} className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm ring-1 ring-line">
                <Search size={15} /> Buscar outro
              </button>
            )}
            <button
              onClick={() => confirm(`Remover “${item.searchQuery}” da lista?`) && act("del", () => deleteItem(item.id))}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-danger ring-1 ring-line"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {!!options.length && !searching && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">Ou será um destes?</p>
          <div className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5">
            {options.map((c) => (
              <CandidateButton key={c.externalId} c={c} busy={busy === c.externalId} disabled={pending} onPick={() => act(c.externalId, () => rematch(item.id, item.kind, c.externalId))} />
            ))}
          </div>
        </div>
      )}

      {searching && (
        <div className="mt-3 border-t border-line pt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-accent/60"
            placeholder="Buscar pelo nome certo"
          />
          <div className="no-scrollbar -mx-3.5 mt-2 flex gap-2 overflow-x-auto px-3.5">
            {KINDS.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)} color={KIND_META[k].color}>
                {KIND_META[k].label}
              </Chip>
            ))}
          </div>
          <div className="no-scrollbar -mx-3.5 mt-3 flex min-h-24 gap-2.5 overflow-x-auto px-3.5">
            {loading && <Loader2 size={18} className="m-4 animate-spin text-muted" />}
            {!loading &&
              results.map((c) => (
                <CandidateButton key={c.externalId} c={c} busy={busy === c.externalId} disabled={pending} onPick={() => act(c.externalId, () => rematch(item.id, c.kind, c.externalId))} />
              ))}
            {!loading && !results.length && query.length >= 2 && <p className="py-4 text-sm text-muted">Nada. Tente outro nome ou tipo.</p>}
          </div>
        </div>
      )}
    </article>
  );
}

function CandidateButton({ c, busy, disabled, onPick }: { c: Candidate; busy: boolean; disabled: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} disabled={disabled} className="flex w-24 shrink-0 flex-col justify-start self-start text-left disabled:opacity-60">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line">
        {c.cover && <img src={c.cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
      </div>
      <p className="mt-1 text-[12px] font-medium leading-tight line-clamp-2">{c.title}</p>
      <p className="text-[11px] text-muted">{[c.year, c.subtitle?.split(" · ").slice(1).join(" · ")].filter(Boolean).join(" · ")}</p>
    </button>
  );
}
