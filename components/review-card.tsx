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
    <article id={item.id} className="fade-in px-4 py-5">
      <p className="text-[13px] text-text-3">
        {KIND_META[item.kind].label} · no Obsidian: <span className="text-text-2">“{item.searchQuery}”</span>
      </p>

      <div className="mt-3 flex gap-3">
        <Cover src={item.coverUrl} title={item.title} className="w-[76px] shrink-0" />
        <div className="min-w-0 flex-1">
          {guessed ? (
            <>
              <p className="text-[12px] text-text-3">Meu palpite</p>
              <p className="text-[16px] font-semibold leading-tight">{item.title}</p>
              <p className="mt-0.5 text-[13px] text-text-2">{[item.year, item.creators.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</p>
            </>
          ) : (
            <p className="text-[14px] text-text-2">Não achei nada com esse nome.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {guessed && !single && (
              <button
                onClick={() => act("ok", () => confirmMatch(item.id))}
                disabled={pending}
                className="tap flex h-9 items-center gap-1.5 rounded-full bg-pill px-4 text-[14px] font-medium text-white disabled:opacity-60"
              >
                {busy === "ok" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2.6} />} É esse
              </button>
            )}
            {!searching && (
              <button onClick={() => setSearching(true)} className="tap flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-[14px]">
                <Search size={15} /> Outro
              </button>
            )}
            <button
              onClick={() => confirm(`Remover “${item.searchQuery}” da lista?`) && act("del", () => deleteItem(item.id))}
              disabled={pending}
              className="tap flex h-9 w-9 items-center justify-center text-text-2"
              aria-label="Remover"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      </div>

      {!!options.length && !searching && (
        <div className="mt-4">
          <p className="mb-2 text-[13px] text-text-2">Ou será um destes?</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {options.map((c) => (
              <CandidateButton key={c.externalId} c={c} busy={busy === c.externalId} disabled={pending} onPick={() => act(c.externalId, () => rematch(item.id, item.kind, c.externalId))} />
            ))}
          </div>
        </div>
      )}

      {searching && (
        <div className="mt-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-full bg-bg-3 px-4 text-[15px] outline-none placeholder:text-text-3"
            placeholder="Buscar pelo nome certo"
          />
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
            {KINDS.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                {KIND_META[k].label}
              </Chip>
            ))}
          </div>
          <div className="no-scrollbar -mx-4 mt-3 flex min-h-24 gap-2 overflow-x-auto px-4">
            {loading && <Loader2 size={18} className="m-4 animate-spin text-text-3" />}
            {!loading &&
              results.map((c) => (
                <CandidateButton key={`${c.kind}-${c.externalId}`} c={c} busy={busy === c.externalId} disabled={pending} onPick={() => act(c.externalId, () => rematch(item.id, c.kind, c.externalId))} />
              ))}
            {!loading && !results.length && query.length >= 2 && <p className="py-4 text-sm text-text-2">Nada. Tente outro nome ou tipo.</p>}
          </div>
        </div>
      )}
    </article>
  );
}

function CandidateButton({ c, busy, disabled, onPick }: { c: Candidate; busy: boolean; disabled: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} disabled={disabled} className="press flex w-[92px] shrink-0 flex-col justify-start self-start text-left disabled:opacity-60">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-bg-3">
        {c.cover && <img src={c.cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[12px] font-medium leading-tight line-clamp-2">{c.title}</p>
      <p className="text-[11px] text-text-2">{[c.year, c.subtitle?.split(" · ").slice(1).join(" · ")].filter(Boolean).join(" · ")}</p>
    </button>
  );
}
