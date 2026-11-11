"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Compass, HardDrive, Loader2, Pencil, Plus, Search, Trophy, X } from "lucide-react";
import { addSwitchGame, removeSwitchGame } from "@/app/actions";
import type { SearchResult } from "@/lib/search";
import { useSearch } from "./add-search";
import { Cover } from "./cover";
import { GUTTER } from "./rail";
import { BacklogButton, ShotCover, useBacklogToggle, type BacklogRef } from "./shot-cover";

export type SwitchEntry = {
  id: string;
  title: string;
  sizeMb: number;
  igdbId: number | null;
  coverUrl: string | null;
  screenshots: string[];
};

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "in", label: "No backlog" },
  { id: "out", label: "Fora do backlog" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

export function formatSize(mb: number) {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: mb >= 10240 ? 1 : 2 })} GB`;
}

// Jogos instalados no Switch, do maior para o menor, com atalho para pôr/tirar do backlog
export function SwitchView({
  games: initial,
  backlog,
  switchTagId,
}: {
  games: SwitchEntry[];
  backlog: Record<number, BacklogRef>;
  switchTagId: string | null;
}) {
  const router = useRouter();
  const [games, setGames] = useState(initial);
  // Dados novos do servidor (depois de adicionar/remover) substituem o estado local
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setGames(initial);
  }
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  const { owned, busy, toggle } = useBacklogToggle(backlog, switchTagId);

  const itemOf = (g: SwitchEntry) => (g.igdbId != null ? (owned[g.igdbId] ?? null) : null);
  const total = games.reduce((s, g) => s + g.sizeMb, 0);
  const inBacklog = games.filter((g) => itemOf(g)).length;
  const max = games[0]?.sizeMb ?? 1;
  const visible = useMemo(
    () => games.filter((g) => {
      const has = g.igdbId != null && !!owned[g.igdbId];
      return filter === "in" ? has : filter === "out" ? !has : true;
    }),
    [games, filter, owned],
  );

  function remove(g: SwitchEntry) {
    setGames((gs) => gs.filter((x) => x.id !== g.id));
    removeSwitchGame(g.id).then(
      () => router.refresh(),
      () => router.refresh(),
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] pb-10 pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28">
      <header className={GUTTER}>
        <Link href="/lista?k=game" className="group mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-text-2 hover:text-white">
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> Jogos
        </Link>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">
            Meu Switch <span className="text-[0.55em] font-semibold text-text-3">{games.length}</span>
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/switch/descobrir" className="glass tap flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-white/85 hover:text-white">
              <Compass size={16} /> <span className="hidden sm:inline">Descobrir</span>
            </Link>
            <button
              onClick={() => setEditing((v) => !v)}
              aria-pressed={editing}
              className={`tap flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium ${editing ? "bg-white text-black" : "glass text-white/85 hover:text-white"}`}
            >
              {editing ? <Check size={16} /> : <Pencil size={15} />} <span className="hidden sm:inline">{editing ? "Pronto" : "Editar"}</span>
            </button>
            <button onClick={() => setAdding(true)} className="btn-accent tap flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold">
              <Plus size={17} /> <span className="hidden sm:inline">Adicionar</span>
            </button>
          </div>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-text-2">
          <span className="inline-flex items-center gap-1.5">
            <HardDrive size={15} /> {formatSize(total)} instalados
          </span>
          <span className="text-text-3">·</span>
          <span>{inBacklog} no backlog</span>
        </p>
      </header>

      <div className={`sticky top-0 z-30 mt-4 py-3 lg:top-20 ${GUTTER}`}>
        <div className="glass inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className="relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium">
              {filter === f.id && <motion.span layoutId="switch-filter" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className={`relative ${filter === f.id ? "text-white" : "text-white/70"}`}>
                {f.label} <span className="opacity-55">{f.id === "all" ? games.length : f.id === "in" ? inBacklog : games.length - inBacklog}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-x-3 gap-y-5 pt-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-7 2xl:grid-cols-8 ${GUTTER}`}>
        {visible.map((g, idx) => (
          <SwitchCard
            key={g.id}
            game={g}
            item={itemOf(g)}
            max={max}
            eager={idx < 12}
            busy={g.igdbId != null && busy.has(g.igdbId)}
            editing={editing}
            onToggle={() => g.igdbId != null && toggle(g.igdbId)}
            onRemove={() => remove(g)}
            delay={Math.min(idx, 18) * 20}
          />
        ))}
      </div>
      {!visible.length && <p className="px-4 py-24 text-center text-text-2">Nada por aqui.</p>}

      <AnimatePresence>
        {adding && (
          <AddSwitchDialog
            installed={new Set(games.map((g) => g.igdbId).filter((x): x is number => x != null))}
            onClose={() => setAdding(false)}
            onAdded={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SwitchCard({
  game: g,
  item,
  max,
  eager,
  busy,
  editing,
  onToggle,
  onRemove,
  delay,
}: {
  game: SwitchEntry;
  item: BacklogRef | null;
  max: number;
  eager: boolean;
  busy: boolean;
  editing: boolean;
  onToggle: () => void;
  onRemove: () => void;
  delay: number;
}) {
  const on = !!item;
  const cover = (
    <ShotCover
      id={g.id}
      title={g.title}
      coverUrl={g.coverUrl}
      screenshots={g.screenshots}
      eager={eager}
      dim={!on}
      overlay={(scrubbing) => (
        <>
          <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-white/10">{formatSize(g.sizeMb)}</span>
          {item?.done && !scrubbing && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-success/90 px-2 py-0.5 text-[11px] font-semibold text-black">
              <Trophy size={11} /> Zerado
            </span>
          )}
        </>
      )}
    />
  );

  return (
    <div className="rise" style={{ animationDelay: `${delay}ms` }}>
      <div className={`group relative ${editing ? "wiggle" : ""}`} style={editing ? { animationDelay: `${(delay % 7) * -40}ms` } : undefined}>
        {editing ? (
          <div className="pointer-events-none">{cover}</div>
        ) : item ? (
          <Link href={`/item/${item.id}`} aria-label={g.title} className="block">
            {cover}
          </Link>
        ) : (
          <button type="button" onClick={onToggle} disabled={g.igdbId == null} aria-label={`Adicionar ${g.title} ao backlog`} className="block w-full text-left disabled:cursor-default">
            {cover}
          </button>
        )}
        {editing && (
          <button
            type="button"
            onClick={onRemove}
            title="Tirar do Switch"
            aria-label={`Tirar ${g.title} do Switch`}
            className="tap absolute -right-1.5 -top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-danger text-white shadow-lg ring-2 ring-black/60"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        )}
        {!editing && g.igdbId != null && !item?.done && <BacklogButton on={on} busy={busy} onClick={onToggle} />}
      </div>
      <p className="mt-2 truncate text-[13px] font-medium leading-tight" title={g.title}>
        {g.title}
      </p>
      {/* Barra do espaço que ocupa, relativa ao maior jogo */}
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full ${on ? "bg-accent" : "bg-white/35"}`} style={{ width: `${Math.max(2, (g.sizeMb / max) * 100)}%` }} />
      </div>
    </div>
  );
}

const toMb = (value: string, unit: "GB" | "MB") => {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(unit === "GB" ? n * 1024 : n) : null;
};

// Busca o jogo no IGDB e pede o tamanho que ele ocupa no console
function AddSwitchDialog({ installed, onClose, onAdded }: { installed: Set<number>; onClose: () => void; onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState<"GB" | "MB">("GB");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, loading, error: searchError } = useSearch("game", query);
  const mb = toMb(size, unit);

  async function save() {
    if (!picked || !mb) return;
    setSaving(true);
    setError(null);
    try {
      await addSwitchGame(Number(picked.externalId), picked.title, mb, picked.cover);
      onAdded();
    } catch {
      setError("Não deu pra adicionar. Tenta de novo.");
      setSaving(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-start sm:pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Fechar" />
      <motion.div
        role="dialog"
        aria-label="Adicionar ao Switch"
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="glass-strong relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[18px] font-bold tracking-tight">Adicionar ao Switch</h2>
          <button onClick={onClose} className="tap flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        {picked ? (
          <form
            className="space-y-4 px-5 pb-5 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-14 shrink-0">
                <Cover item={{ id: picked.externalId, title: picked.title, kind: "game", coverUrl: picked.cover }} rounded="rounded-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{picked.title}</p>
                <p className="truncate text-[12px] text-white/55">{[picked.year, picked.subtitle].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="text-[13px] font-medium text-accent-2">
                Trocar
              </button>
            </div>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-white/45">Tamanho no console</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  autoFocus
                  inputMode="decimal"
                  value={size}
                  onChange={(e) => setSize(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="Ex.: 4,6"
                  className="glass h-11 min-w-0 flex-1 rounded-full px-4 text-[15px] tabular-nums outline-none placeholder:text-text-3"
                />
                <div className="glass flex rounded-full p-1">
                  {(["GB", "MB"] as const).map((u) => (
                    <button key={u} type="button" onClick={() => setUnit(u)} className={`rounded-full px-3.5 text-[13px] font-semibold ${unit === u ? "btn-accent" : "text-white/65"}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </label>
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <button type="submit" disabled={!mb || saving} className="btn-accent tap flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-40">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Adicionar {mb ? `(${formatSize(mb)})` : ""}
            </button>
          </form>
        ) : (
          <>
            <div className="px-5 pb-3">
              <div className="glass relative flex h-11 items-center rounded-full">
                <Search size={16} className="pointer-events-none absolute left-4 text-text-2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nome do jogo"
                  className="h-full w-full bg-transparent pl-10 pr-10 text-[14px] outline-none placeholder:text-text-3"
                />
                {loading && <Loader2 size={15} className="absolute right-4 animate-spin text-text-2" />}
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {searchError && <li className="px-2 py-6 text-center text-[14px] text-text-2">{searchError}</li>}
              {results.map((r) => {
                const has = installed.has(Number(r.externalId));
                return (
                  <li key={r.externalId}>
                    <button
                      onClick={() => setPicked(r)}
                      disabled={has}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-45 disabled:hover:bg-transparent"
                    >
                      <div className="w-10 shrink-0">
                        <Cover item={{ id: r.externalId, title: r.title, kind: "game", coverUrl: r.cover }} rounded="rounded-md" />
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{r.title}</span>
                        <span className="block truncate text-[12px] text-white/50">{[r.year, r.subtitle].filter(Boolean).join(" · ")}</span>
                      </span>
                      {has ? <span className="text-[12px] font-medium text-white/60">No Switch</span> : <Plus size={17} className="text-white/60" />}
                    </button>
                  </li>
                );
              })}
              {query.trim().length < 2 && <li className="px-2 py-6 text-center text-[14px] text-text-3">Busque pelo nome do jogo</li>}
            </ul>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
