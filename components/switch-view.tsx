"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Compass, HardDrive, Loader2, Pencil, Plus, Search, Trophy, X } from "lucide-react";
import { addSwitchGame, removeSwitchGame } from "@/app/actions";
import { formatSize } from "@/lib/kinds";
import type { SearchResult } from "@/lib/search";
import { useSearch } from "./add-search";
import { Cover } from "./cover";
import { InstallChip, Sheet, SizeField, toMb } from "./install-dialog";
import { GUTTER } from "./rail";
import { useGameMenu } from "./game-menu";
import { BacklogButton, ShotCover, useBacklogToggle, type BacklogRef } from "./shot-cover";

export type SwitchEntry = {
  id: string;
  title: string;
  sizeMb: number;
  igdbId: number | null;
  coverUrl: string | null;
  screenshots: string[];
};

// Jogo do backlog que sai para Switch (pelo IGDB) e não está no console
export type MissingEntry = { id: string; title: string; igdbId: number | null; coverUrl: string | null; screenshots: string[] };

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "in", label: "No backlog" },
  { id: "out", label: "Fora do backlog" },
  { id: "missing", label: "No backlog, não instalado" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

// Jogos instalados no Switch, do maior para o menor, com atalho para pôr/tirar do backlog
export function SwitchView({
  games: initial,
  backlog,
  missing,
}: {
  games: SwitchEntry[];
  missing: MissingEntry[];
  backlog: Record<number, BacklogRef>;
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
  // O filtro fica na URL: voltar de um jogo reabre no mesmo filtro
  const sp = useSearchParams();
  const [filter, setFilterState] = useState<FilterId>(FILTERS.find((f) => f.id === sp.get("filtro"))?.id ?? "all");
  function setFilter(f: FilterId) {
    setFilterState(f);
    window.history.replaceState(null, "", f === "all" ? "/switch" : `/switch?filtro=${f}`);
  }
  const { owned, busy, toggle } = useBacklogToggle(backlog);

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
            <Link href="/descobrir?plataforma=switch" className="glass tap flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-white/85 hover:text-white">
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
                {f.label} <span className="opacity-55">{f.id === "all" ? games.length : f.id === "in" ? inBacklog : f.id === "out" ? games.length - inBacklog : missing.length}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {filter === "missing" && (
        <div className={`grid grid-cols-3 gap-x-3 gap-y-5 pt-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-7 2xl:grid-cols-8 ${GUTTER}`}>
          {missing.map((g, idx) => (
            <MissingCard key={g.id} game={g} eager={idx < 12} delay={Math.min(idx, 18) * 20} onInstalled={() => router.refresh()} />
          ))}
        </div>
      )}
      {filter === "missing" && !missing.length && <p className="px-4 py-24 text-center text-text-2">Tudo que está no backlog já está instalado.</p>}

      <div className={`grid grid-cols-3 gap-x-3 gap-y-5 pt-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-7 2xl:grid-cols-8 ${GUTTER} ${filter === "missing" ? "hidden" : ""}`}>
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
      {filter !== "missing" && !visible.length && <p className="px-4 py-24 text-center text-text-2">Nada por aqui.</p>}

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
  const openMenu = useGameMenu();
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
      <div
        className={`group relative ${editing ? "wiggle" : ""}`}
        style={editing ? { animationDelay: `${(delay % 7) * -40}ms` } : undefined}
        onContextMenu={editing ? undefined : (e) => openMenu(e, { igdbId: g.igdbId, title: g.title, coverUrl: g.coverUrl, itemId: item?.id, done: item?.done })}
      >
        {editing ? (
          <div className="pointer-events-none">{cover}</div>
        ) : item || g.igdbId != null ? (
          <Link href={item ? `/item/${item.id}` : `/jogo/${g.igdbId}`} aria-label={g.title} className="block">
            {cover}
          </Link>
        ) : (
          cover
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

// Jogo do backlog que não está no Switch: abre o item e tem o atalho para instalar (com o tamanho)
function MissingCard({ game: g, eager, delay, onInstalled }: { game: MissingEntry; eager: boolean; delay: number; onInstalled: () => void }) {
  const openMenu = useGameMenu();
  return (
    <div className="rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="group relative" onContextMenu={(e) => openMenu(e, { igdbId: g.igdbId, title: g.title, coverUrl: g.coverUrl, itemId: g.id })}>
        <Link href={`/item/${g.id}`} aria-label={g.title} className="block">
          <ShotCover id={g.id} title={g.title} coverUrl={g.coverUrl} screenshots={g.screenshots} eager={eager} />
        </Link>
      </div>
      <p className="mt-2 truncate text-[13px] font-medium leading-tight" title={g.title}>
        {g.title}
      </p>
      {g.igdbId != null && (
        <div className="mt-1.5">
          <InstallChip game={{ igdbId: g.igdbId, title: g.title, coverUrl: g.coverUrl }} installed={null} onChange={(next) => next && onInstalled()} />
        </div>
      )}
    </div>
  );
}

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
    <Sheet label="Adicionar ao Switch" onClose={onClose}>

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
            <SizeField value={size} unit={unit} onValue={setSize} onUnit={setUnit} />
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
    </Sheet>
  );
}
