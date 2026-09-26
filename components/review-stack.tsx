/* eslint-disable @next/next/no-img-element -- capas externas */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Check, Loader2, Search, Trash2, X } from "lucide-react";
import { confirmMatch, deleteItem, rematch } from "@/app/actions";
import type { Candidate, Kind } from "@/lib/db/schema";
import { KIND_META, KINDS } from "@/lib/kinds";
import { useSearch } from "./add-search";
import { Cover } from "./cover";

export type ReviewItem = {
  id: string;
  kind: Kind;
  title: string;
  year: number | null;
  coverUrl: string | null;
  coverColor: string | null;
  coverBlur: string | null;
  creators: string[];
  matchStatus: "matched" | "needs_review" | "unmatched";
  searchQuery: string;
  candidates: Candidate[];
};

export function ReviewStack({ items, single }: { items: ReviewItem[]; single: boolean }) {
  const router = useRouter();
  const [queue, setQueue] = useState(items);
  const [exitDir, setExitDir] = useState<1 | -1>(1);
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(items[0]?.matchStatus === "unmatched" || single);
  const total = items.length;
  const current = queue[0];

  const next = (dir: 1 | -1) => {
    setExitDir(dir);
    if (single && current) return router.push(`/item/${current.id}`);
    setQueue((q) => q.slice(1));
    setPicking(queue[1]?.matchStatus === "unmatched");
  };
  const act = (dir: 1 | -1, fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      next(dir);
    });

  if (!current)
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="btn-accent flex h-20 w-20 items-center justify-center rounded-full">
          <Check size={38} strokeWidth={3} />
        </motion.div>
        <h2 className="mt-6 text-[26px] font-bold">Tudo revisado</h2>
        <p className="mt-1 text-text-2">Seu backlog está redondinho.</p>
        <Link href="/" className="glass mt-6 flex h-11 items-center rounded-full px-6 font-medium">
          Voltar ao início
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-md">
      {!single && (
        <div className="mb-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="btn-accent h-full rounded-full transition-[width] duration-500" style={{ width: `${((total - queue.length + 1) / total) * 100}%` }} />
          </div>
          <span className="text-[13px] tabular-nums text-text-2">
            {total - queue.length + 1} de {total}
          </span>
        </div>
      )}

      <div className="relative h-[340px] sm:h-[430px]">
        {/* Cartas de trás, para dar profundidade */}
        {queue.slice(1, 3).map((it, i) => (
          <div
            key={it.id}
            className="glass absolute inset-0 rounded-[30px]"
            style={{ transform: `translateY(${(i + 1) * 12}px) scale(${1 - (i + 1) * 0.05})`, opacity: 0.6 - i * 0.25, zIndex: 2 - i }}
          />
        ))}
        <AnimatePresence custom={exitDir}>
          <SwipeCard
            key={current.id}
            item={current}
            onYes={() => current.matchStatus !== "unmatched" && act(1, () => confirmMatch(current.id))}
            onNo={() => setPicking(true)}
          />
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <RoundButton label="Remover" onClick={() => confirm(`Remover “${current.searchQuery}” do backlog?`) && act(-1, () => deleteItem(current.id))} className="text-danger">
          <Trash2 size={22} />
        </RoundButton>
        <RoundButton label="Buscar outro" onClick={() => setPicking((v) => !v)} className={picking ? "bg-white/15" : ""}>
          <Search size={22} />
        </RoundButton>
        {current.matchStatus !== "unmatched" && (
          <RoundButton label="É esse" onClick={() => act(1, () => confirmMatch(current.id))} className="btn-accent h-[72px] w-[72px]" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Check size={30} strokeWidth={3} />}
          </RoundButton>
        )}
      </div>
      <p className="mt-3 text-center text-[12px] text-text-3">Arraste para a direita se estiver certo, para a esquerda para trocar</p>

      <AnimatePresence>{picking && <Picker key={current.id} item={current} onPicked={(fn) => act(1, fn)} />}</AnimatePresence>
    </div>
  );
}

function RoundButton({ children, label, onClick, className = "", disabled }: { children: React.ReactNode; label: string; onClick: () => void; className?: string; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`glass flex h-14 w-14 items-center justify-center rounded-full ${className}`}
    >
      {children}
    </motion.button>
  );
}

function SwipeCard({ item, onYes, onNo }: { item: ReviewItem; onYes: () => void; onNo: () => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const yes = useTransform(x, [30, 120], [0, 1]);
  const no = useTransform(x, [-120, -30], [1, 0]);
  const guessed = item.matchStatus !== "unmatched";

  return (
    <motion.div
      className="glass-strong absolute inset-0 z-10 flex cursor-grab flex-col overflow-hidden rounded-[30px] p-5 active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info: PanInfo) => {
        if (info.offset.x > 110 && guessed) onYes();
        else if (info.offset.x < -110) onNo();
      }}
      initial={{ scale: 0.92, y: 20, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      variants={{ out: (dir: number) => ({ x: dir * 500, rotate: dir * 20, opacity: 0, transition: { duration: 0.35 } }) }}
      exit="out"
    >
      {item.coverBlur && <img src={item.coverBlur} alt="" className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl" />}
      <div className="relative">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50">{KIND_META[item.kind].label} · no Obsidian</p>
        <p className="mt-1 text-[20px] font-bold leading-tight">“{item.searchQuery}”</p>
      </div>
      <div className="relative mt-5 flex flex-1 items-center gap-5">
        {guessed ? (
          <>
            <Cover item={item} className="w-[42%] shrink-0 shadow-2xl" rounded="rounded-2xl" eager />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-accent-2">Meu palpite</p>
              <p className="mt-1 text-[22px] font-bold leading-tight line-clamp-4">{item.title}</p>
              <p className="mt-1.5 text-[14px] text-white/60">{[item.year, item.creators.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</p>
            </div>
          </>
        ) : (
          <div className="w-full text-center">
            <p className="text-[40px]">🤔</p>
            <p className="mt-2 text-[17px] font-semibold">Não achei nada com esse nome</p>
            <p className="mt-1 text-[14px] text-white/60">Busque o nome certo logo abaixo.</p>
          </div>
        )}
      </div>
      <motion.span style={{ opacity: yes }} className="absolute right-6 top-6 rotate-12 rounded-xl border-[3px] border-success px-3 py-1 text-[20px] font-black text-success">
        É ESSE
      </motion.span>
      <motion.span style={{ opacity: no }} className="absolute left-6 top-6 -rotate-12 rounded-xl border-[3px] border-accent-2 px-3 py-1 text-[20px] font-black text-accent-2">
        OUTRO
      </motion.span>
    </motion.div>
  );
}

function Picker({ item, onPicked }: { item: ReviewItem; onPicked: (fn: () => Promise<unknown>) => void }) {
  const [kind, setKind] = useState<Kind>(item.kind);
  const [query, setQuery] = useState(item.searchQuery);
  const [busy, setBusy] = useState<string | null>(null);
  const edited = query !== item.searchQuery || kind !== item.kind;
  const { results, loading } = useSearch(kind, edited ? query : "");
  const options = edited
    ? results
    : [...new Map(item.candidates.map((c) => [c.externalId, c])).values()].filter((c) => !(c.title === item.title && c.year === item.year)).map((c) => ({ ...c, kind: item.kind }));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="glass mt-6 rounded-3xl p-4">
      <p className="mb-3 text-[15px] font-semibold">Qual é o certo?</p>
      <div className="glass flex h-11 items-center rounded-full px-4">
        <Search size={16} className="text-text-2" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} className="h-full flex-1 bg-transparent pl-2.5 text-[15px] outline-none" placeholder="Buscar pelo nome certo" />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Limpar">
            <X size={15} className="text-text-2" />
          </button>
        )}
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {KINDS.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium ${kind === k ? "btn-accent" : "glass text-white/70"}`}>
            {KIND_META[k].label}
          </button>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mt-4 flex min-h-[150px] gap-3 overflow-x-auto px-4">
        {loading && <Loader2 className="m-6 animate-spin text-text-2" />}
        {!loading &&
          options.map((c) => (
            <button
              key={`${c.kind}-${c.externalId}`}
              disabled={!!busy}
              onClick={() => {
                setBusy(c.externalId);
                onPicked(() => rematch(item.id, c.kind, c.externalId));
              }}
              className="press flex w-[96px] shrink-0 flex-col text-left disabled:opacity-50"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-bg-3">
                {c.cover && <img src={c.cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
                {busy === c.externalId && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-[12px] font-semibold leading-tight line-clamp-2">{c.title}</p>
              <p className="text-[11px] text-white/50">{c.year}</p>
            </button>
          ))}
        {!loading && !options.length && <p className="py-6 text-[14px] text-text-2">{edited ? "Nada encontrado. Tente outro nome ou tipo." : "Busque pelo nome certo acima."}</p>}
      </div>
    </motion.div>
  );
}
