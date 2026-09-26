"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { BookOpen, Clapperboard, Dices, Gamepad2, Heart, RotateCcw, SlidersHorizontal, Sparkles, Tv, X } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { artSrc, coverSrc } from "@/lib/img";
import { accessFor, formatMinutes, KIND_META, scoreLabel } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Cover } from "./cover";

const KIND_TILES: { id: Kind | "any"; label: string; icon: typeof Tv }[] = [
  { id: "any", label: "Tanto faz", icon: Sparkles },
  { id: "movie", label: "Filme", icon: Clapperboard },
  { id: "series", label: "Série", icon: Tv },
  { id: "game", label: "Jogo", icon: Gamepad2 },
  { id: "book", label: "Livro", icon: BookOpen },
];

const TIMES = [
  { id: "any", label: "Sem pressa", max: Infinity },
  { id: "short", label: "Até 1h40", max: 100 },
  { id: "evening", label: "Uma noite", max: 150 },
  { id: "weekend", label: "Um fim de semana", max: 900 },
] as const;

type Phase = "setup" | "spinning" | "result";

function weightOf(i: LiteItem) {
  let w = Math.max(0.4, ((i.score ?? 6.5) - 4) ** 2);
  if (i.pinned) w *= 2.5;
  if (i.priority != null) w *= 1.3;
  return w;
}

function pickWeighted(pool: LiteItem[]) {
  const total = pool.reduce((s, i) => s + weightOf(i), 0);
  let r = Math.random() * total;
  return pool.find((i) => (r -= weightOf(i)) <= 0) ?? pool[pool.length - 1];
}

const preload = (src: string | null) =>
  src
    ? new Promise<void>((res) => {
        const img = new Image();
        img.onload = img.onerror = () => res();
        img.src = src;
      })
    : Promise.resolve();

export function DrawOverlay() {
  const { drawOpen, setDrawOpen } = useBacklog();
  return <AnimatePresence>{drawOpen && <Draw onClose={() => setDrawOpen(false)} />}</AnimatePresence>;
}

function Draw({ onClose }: { onClose: () => void }) {
  const { items, myProviders } = useBacklog();
  const [kind, setKind] = useState<Kind | "any">("any");
  const [time, setTime] = useState<(typeof TIMES)[number]["id"]>("any");
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [ring, setRing] = useState<LiteItem[]>([]);
  const [winner, setWinner] = useState<LiteItem | null>(null);
  const rotation = useMotionValue(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const pool = useMemo(() => {
    const max = TIMES.find((t) => t.id === time)!.max;
    return items.filter((i) => {
      if (kind !== "any" && i.kind !== kind) return false;
      if (max !== Infinity && (i.kind === "book" || !i.minutes || i.minutes > max)) return false;
      if (onlyMine && (i.kind === "movie" || i.kind === "series") && accessFor(i, myProviders).tier !== "mine") return false;
      if (onlyPinned && !i.pinned) return false;
      return true;
    });
  }, [items, kind, time, onlyMine, onlyPinned, myProviders]);

  async function spin() {
    if (!pool.length) return;
    const win = pickWeighted(pool);
    // Anel de pôsteres: o vencedor + outros do mesmo filtro (ou de tudo, se o filtro for pequeno)
    const extras = [...(pool.length > 8 ? pool : items)].filter((i) => i.id !== win.id).sort(() => Math.random() - 0.5);
    const n = Math.min(14, Math.max(8, extras.length + 1));
    const others = extras.slice(0, n - 1);
    const winIndex = Math.floor(Math.random() * n);
    const list = [...others.slice(0, winIndex), win, ...others.slice(winIndex)];
    setRing(list);
    setWinner(null);
    setPhase("spinning");
    await Promise.race([Promise.all(list.map((i) => preload(coverSrc(i.coverUrl, "sm")))), new Promise((r) => setTimeout(r, 900))]);
    preload(artSrc(win.backdropUrl, "lg") ?? coverSrc(win.coverUrl, "lg"));

    const step = 360 / list.length;
    const target = -(360 * 3 + winIndex * step);
    rotation.set(0);
    await animate(rotation, target, { duration: 3.4, ease: [0.12, 0.72, 0.12, 1] });
    navigator.vibrate?.([10, 40, 18]);
    setWinner(win);
    setPhase("result");
  }

  return (
    <motion.div
      className="fixed inset-0 z-[70] overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Fundo: vidro escuro + arte do vencedor borrada */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-2xl" />
      <AnimatePresence>
        {winner && (
          <motion.div
            key={winner.id}
            className="fixed inset-0 bg-cover bg-center opacity-40 blur-3xl saturate-150"
            style={{ backgroundImage: `url(${coverSrc(winner.coverUrl, "sm") ?? winner.coverBlur ?? ""})`, backgroundColor: winner.coverColor ?? undefined }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col px-5 pb-10 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-white/60">Sorteio</p>
          <button onClick={onClose} className="glass tap flex h-10 w-10 items-center justify-center rounded-full" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {phase === "setup" && (
            <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }} className="flex flex-1 flex-col">
              <h2 className="mt-6 text-[38px] font-bold leading-[1.02] tracking-tight sm:text-[52px]">
                O que vai ser
                <br />
                <span className="text-white/50">hoje?</span>
              </h2>

              <div className="mt-8 grid grid-cols-5 gap-2">
                {KIND_TILES.map(({ id, label, icon: Icon }) => {
                  const on = kind === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setKind(id)}
                      className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl text-[12px] font-medium transition-colors sm:text-[13px] ${on ? "text-white" : "glass text-white/80"}`}
                    >
                      {on && <motion.span layoutId="kind-tile" className="btn-accent absolute inset-0 rounded-2xl" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                      <Icon size={24} className="relative" strokeWidth={1.8} />
                      <span className="relative">{label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mb-2 mt-7 text-[12px] font-semibold uppercase tracking-wider text-white/50">Quanto tempo você tem</p>
              <div className="glass flex rounded-full p-1">
                {TIMES.map((t) => (
                  <button key={t.id} onClick={() => setTime(t.id)} className="relative flex-1 rounded-full py-2 text-[12px] font-medium sm:text-[14px]">
                    {time === t.id && <motion.span layoutId="time-pill" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <span className={`relative ${time === t.id ? "text-white" : "text-white/75"}`}>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-2">
                <Toggle on={onlyMine} onChange={setOnlyMine} icon={<Tv size={17} />} label="Só o que está no meu streaming" />
                <Toggle on={onlyPinned} onChange={setOnlyPinned} icon={<Heart size={17} />} label="Só os que eu quero muito" />
              </div>

              <div className="mt-auto pt-10">
                <button
                  onClick={spin}
                  disabled={!pool.length}
                  className="btn-accent group flex h-16 w-full items-center justify-center gap-3 rounded-full text-[19px] font-semibold transition active:scale-[0.98] disabled:opacity-40"
                >
                  <Dices size={24} className="transition-transform duration-700 group-hover:rotate-[360deg]" /> Girar
                </button>
                <p className="mt-3 text-center text-[13px] text-white/50">
                  {pool.length ? `${pool.length} ${pool.length === 1 ? "opção" : "opções"} na roleta · nota alta e “quero muito” pesam mais` : "Nada com esses filtros."}
                </p>
              </div>
            </motion.div>
          )}

          {phase !== "setup" && (
            <motion.div key="wheel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center">
              <Ring items={ring} rotation={rotation} winner={winner} />
              <AnimatePresence>
                {phase === "result" && winner && <Result item={winner} myProviders={myProviders} onAgain={spin} onFilters={() => setPhase("setup")} onClose={onClose} />}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Toggle({ on, onChange, icon, label }: { on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px]">
      <span className="text-white/70">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition-colors ${on ? "bg-accent" : "bg-white/15"}`}>
        <motion.span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow" animate={{ left: on ? 24 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
      </span>
    </button>
  );
}

// Carrossel 3D: pôsteres num cilindro que gira e para no vencedor
function Ring({ items, rotation, winner }: { items: LiteItem[]; rotation: ReturnType<typeof useMotionValue<number>>; winner: LiteItem | null }) {
  const n = items.length;
  const w = 150;
  const radius = Math.round(w / 2 / Math.tan(Math.PI / n)) + 28;
  // Empurra o cilindro para trás pelo raio: o pôster da frente fica no tamanho real
  const rotateY = useTransform(rotation, (v) => `translateZ(${-radius}px) rotateY(${v}deg)`);
  return (
    <div className="relative mt-10 h-[260px] w-full sm:mt-14 sm:h-[300px]" style={{ perspective: 1100 }}>
      <motion.div className="absolute left-1/2 top-0 h-[225px] w-[150px] sm:scale-110" style={{ transformStyle: "preserve-3d", transform: rotateY, marginLeft: -w / 2 }}>
        {items.map((it, i) => {
          const isWinner = winner?.id === it.id;
          return (
            <motion.div
              key={it.id}
              className="absolute inset-0"
              style={{ transform: `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)`, backfaceVisibility: "hidden" }}
              animate={{ opacity: winner && !isWinner ? 0.15 : 1, filter: winner && !isWinner ? "blur(3px)" : "blur(0px)" }}
              transition={{ duration: 0.5 }}
            >
              <div className={`h-full w-full rounded-xl transition-shadow duration-500 ${isWinner ? "shadow-[0_0_70px_rgb(47_123_255/0.55)] ring-2 ring-accent" : ""}`}>
                <Cover item={it} eager rounded="rounded-xl" />
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      {winner && <Burst />}
    </div>
  );
}

// Pequena explosão de confete quando para
function Burst() {
  const [bits] = useState(() => Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
    const d = 120 + Math.random() * 90;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7, r: Math.random() * 360, c: ["#fff", "#67d87a", "#ffd166", "#ff8fab", "#8ecae6"][i % 5] };
  }));
  return (
    <div className="pointer-events-none absolute left-1/2 top-[110px]">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute h-2 w-1 rounded-sm"
          style={{ background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: b.x, y: b.y, opacity: 0, rotate: b.r, scale: 0.6 }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

function Result({ item, myProviders, onAgain, onFilters, onClose }: { item: LiteItem; myProviders: number[]; onAgain: () => void; onFilters: () => void; onClose: () => void }) {
  const access = accessFor(item, myProviders);
  const score = scoreLabel(item);
  const length = item.kind === "book" ? (item.pages ? `${item.pages} pág.` : null) : formatMinutes(item.minutes, item.kind);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 28 }} className="mt-4 w-full text-center">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/55">{KIND_META[item.kind].label}</p>
      <h3 className="mx-auto mt-1.5 max-w-lg text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">{item.title}</h3>
      <p className="mt-2 flex flex-wrap justify-center gap-x-3 text-[14px] text-white/65">
        {score && <span className="font-medium text-success">{score.source} {score.value}</span>}
        {item.year && <span>{item.year}</span>}
        {length && <span>{length}</span>}
        {item.kind !== "book" && access.tier !== "unknown" && <span className={access.tier === "mine" ? "text-success" : ""}>{access.label}</span>}
      </p>
      <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href={`/item/${item.id}`} onClick={onClose} className="btn-accent flex h-12 w-full items-center justify-center rounded-full px-8 text-[16px] font-semibold sm:w-auto">
          Bora!
        </Link>
        <div className="flex w-full gap-3 sm:w-auto">
          <button onClick={onAgain} className="glass tap flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-[15px] sm:flex-none">
            <RotateCcw size={17} /> De novo
          </button>
          <button onClick={onFilters} className="glass tap flex h-12 w-12 items-center justify-center rounded-full" aria-label="Mudar filtros">
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
