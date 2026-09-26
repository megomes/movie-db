"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Heart, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Replace, Tag, Trash2 } from "lucide-react";
import { copyToMine, deleteItem, markDone, reenrich, setItemTags, togglePin, undoDone, updateNotes } from "@/app/actions";
import type { Kind } from "@/lib/db/schema";
import { useAmbient, useBacklog } from "./backlog-context";
import { useTagAsk } from "./tag-picker";

const DONE_LABEL: Record<Kind, string> = { movie: "Já vi", series: "Já vi", game: "Já joguei", book: "Já li" };

export function AmbientColor({ color }: { color: string | null }) {
  useAmbient(color);
  return null;
}

const EMOJI: Record<Kind, string[]> = { movie: ["🍿", "🎬", "⭐"], series: ["📺", "🍿", "⭐"], game: ["🎮", "🏆", "⭐"], book: ["📚", "✨", "⭐"] };

// Explosão: papeizinhos + emojis do tipo, com gravidade
function Confetti({ kind }: { kind: Kind }) {
  const [bits] = useState(() =>
    Array.from({ length: 44 }, (_, i) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const d = 110 + Math.random() * 170;
      const emoji = i % 6 === 0 ? EMOJI[kind][(i / 6) % 3] : null;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: (Math.random() - 0.5) * 900, c: ["#fff", "#67d87a", "#5b9bff", "#ffd166", "#ff8fab"][i % 5], round: i % 3 === 0, emoji, delay: Math.random() * 0.08 };
    }),
  );
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-10">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className={`absolute ${b.emoji ? "text-[22px] leading-none" : b.round ? "h-2 w-2 rounded-full" : "h-3 w-1.5 rounded-[2px]"}`}
          style={b.emoji ? undefined : { background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: [0, b.x * 0.85, b.x], y: [0, b.y, b.y + 140], opacity: [1, 1, 0], rotate: b.r, scale: b.emoji ? [0.4, 1.3, 1] : 1 }}
          transition={{ duration: 1.5, ease: [0.2, 0.8, 0.4, 1], delay: b.delay, times: [0, 0.45, 1] }}
        >
          {b.emoji}
        </motion.span>
      ))}
    </span>
  );
}

const SPARKS = [
  { l: "8%", t: "10%", dx: "-14px", dy: "-16px", d: "0ms" },
  { l: "30%", t: "-6%", dx: "-4px", dy: "-20px", d: "220ms" },
  { l: "58%", t: "-8%", dx: "6px", dy: "-22px", d: "90ms" },
  { l: "86%", t: "6%", dx: "16px", dy: "-16px", d: "330ms" },
  { l: "94%", t: "62%", dx: "20px", dy: "6px", d: "160ms" },
  { l: "70%", t: "92%", dx: "8px", dy: "18px", d: "420ms" },
  { l: "22%", t: "90%", dx: "-10px", dy: "18px", d: "280ms" },
  { l: "-2%", t: "52%", dx: "-20px", dy: "2px", d: "380ms" },
];

const DONE_TEXT: Record<Kind, string> = { movie: "Visto!", series: "Maratonada!", game: "Zerado!", book: "Lido!" };

// Botão azul principal ("Watched ✓"). Depois de marcar, confete e 5s para desfazer.
export function DoneButton({ itemId, kind }: { itemId: string; kind: Kind }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  function mark(e: React.MouseEvent<HTMLButtonElement>) {
    // A onda verde nasce de onde o dedo/mouse tocou
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: ((e.clientX - r.left) / r.width) * 100 || 50, y: ((e.clientY - r.top) / r.height) * 100 || 50 });
    setDone(true);
    navigator.vibrate?.([12, 30, 12]);
    start(async () => {
      await markDone(itemId);
      setLeft(5);
      timer.current = setInterval(() => {
        setLeft((s) => {
          if (s === null) return null;
          if (s <= 1) {
            clearInterval(timer.current!);
            router.push("/lista");
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    });
  }

  function undo() {
    if (timer.current) clearInterval(timer.current);
    setLeft(null);
    setDone(false);
    start(() => undoDone(itemId));
  }

  return (
    <>
      <motion.button
        onClick={mark}
        disabled={pending || done}
        whileTap={{ scale: 0.92 }}
        animate={done ? { scale: [1, 0.86, 1.12, 0.97, 1] } : { scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`lift group btn-accent relative flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[16px] font-semibold sm:flex-none sm:px-9 ${done ? "" : "done-btn"}`}
      >
        {!done && <span className="shine" />}
        {/* Faíscas do hover (CSS), saindo das bordas */}
        {!done &&
          SPARKS.map((k, i) => (
            <span key={i} aria-hidden className="spark" style={{ left: k.l, top: k.t, "--dx": k.dx, "--dy": k.dy, "--d": k.d } as React.CSSProperties}>
              ✦
            </span>
          ))}
        {/* Onda verde a partir do toque */}
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <AnimatePresence>
            {done && (
              <motion.span
                className="absolute aspect-square w-[260%] rounded-full bg-success"
                style={{ left: `${origin.x}%`, top: `${origin.y}%`, x: "-50%", y: "-50%" }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </AnimatePresence>
        </span>
        {/* Onda de choque em volta */}
        {done && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-success"
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={String(done)}
            initial={{ y: 14, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 26, delay: done ? 0.12 : 0 }}
            className={`relative flex items-center gap-2 ${done ? "text-black" : ""}`}
          >
            {done ? DONE_TEXT[kind] : DONE_LABEL[kind]}
            <span className={`done-badge flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 ${done ? "bg-black/15" : "bg-white/25"}`}>
              {done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path d="M4 12.5l5 5L20 6.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }} />
                </svg>
              ) : (
                <svg className="done-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              )}
            </span>
          </motion.span>
        </AnimatePresence>
        {done && <Confetti kind={kind} />}
      </motion.button>

      <AnimatePresence>
        {left !== null && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="glass-strong fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl px-4 py-3 lg:bottom-8"
          >
            <span className="text-[14px]">Tirado do backlog 🎉</span>
            <button onClick={undo} className="tap rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black">
              Desfazer · {left}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const DONE_PAST: Record<Kind, string> = { movie: "Visto", series: "Vista", game: "Zerado", book: "Lido" };
const doneDay = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });

// Item já visto (aberto pelo histórico): mostra quando e permite voltar pro backlog
export function DoneBadge({ itemId, kind, doneAt }: { itemId: string; kind: Kind; doneAt: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <>
      <span className="flex h-12 items-center gap-2 rounded-full bg-success/15 px-5 text-[15px] font-semibold text-success ring-1 ring-success/30">
        <Check size={18} strokeWidth={3} /> {DONE_PAST[kind]} em {doneDay.format(new Date(doneAt))}
      </span>
      <button
        onClick={() =>
          start(async () => {
            await undoDone(itemId);
            router.refresh();
          })
        }
        disabled={pending}
        className="glass lift group flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium"
      >
        {pending ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} className="transition-transform duration-500 group-hover:-rotate-180" />} Voltar pro backlog
      </button>
    </>
  );
}

// "Quero muito": coração com pulo e partículas
export function PinButton({ itemId, initial }: { itemId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [burst, setBurst] = useState(0);
  const [, start] = useTransition();
  return (
    <button
      onClick={() => {
        const next = !on;
        setOn(next);
        if (next) setBurst((b) => b + 1);
        start(() => togglePin(itemId).then(() => undefined));
      }}
      aria-pressed={on}
      aria-label={on ? "Tirar de quero muito" : "Quero muito"}
      className="glass lift heart-hover group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
    >
      <motion.span key={String(on)} initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 13 }}>
        <span className="heartbeat block">
          <Heart size={21} className={`transition-colors duration-200 ${on ? "fill-danger text-danger" : "group-hover:text-danger"}`} />
        </span>
      </motion.span>
      <AnimatePresence>
        {burst > 0 && on && (
          <motion.span key={burst} className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.8 }}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-danger"
                  initial={{ x: -3, y: -3 }}
                  animate={{ x: Math.cos(a) * 30 - 3, y: Math.sin(a) * 30 - 3 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              );
            })}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export function CopyButton({ itemId, kind, title, cover }: { itemId: string; kind: Kind; title: string; cover: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { ask, picker } = useTagAsk();
  return (
    <>
    {picker}
    <button
      onClick={() =>
        ask({
          kind,
          title,
          cover,
          confirmLabel: "Trazer pro meu backlog",
          onConfirm: (tagIds) => new Promise<void>((done) => start(async () => {
            router.push(`/item/${await copyToMine(itemId, tagIds)}`);
            done();
          })),
        })
      }
      disabled={pending}
      className="btn-accent lift group relative flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-7 text-[16px] font-semibold sm:flex-none"
    >
      <span className="shine" />
      {pending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={19} className="transition-transform duration-300 group-hover:rotate-90" />} Quero ver também
    </button>
    </>
  );
}

// Tags do item no topo do detalhe, com botão para trocar
export function ItemTags({ itemId, kind, title, cover, tagIds, editable }: { itemId: string; kind: Kind; title: string; cover: string | null; tagIds: string[]; editable: boolean }) {
  const { tagName } = useBacklog();
  const { ask, picker } = useTagAsk();
  const names = tagIds.map(tagName).filter(Boolean) as string[];
  if (!editable && !names.length) return null;
  const open = () =>
    ask({ kind, title, cover, initial: tagIds, confirmLabel: "Salvar tags", onConfirm: (ids) => setItemTags(itemId, ids) });
  return (
    <>
      {picker}
      {names.map((n) => (
        <span key={n} className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-[12px] font-semibold text-accent-2 ring-1 ring-accent/40">
          <Tag size={12} /> {n}
        </span>
      ))}
      {editable && (
        <button onClick={open} className="glass tap flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium text-white/80 hover:text-white">
          {names.length ? <Pencil size={12} /> : <Plus size={13} />} {names.length ? "Trocar tags" : "Adicionar tag"}
        </button>
      )}
    </>
  );
}

export function ItemMenu({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] hover:bg-white/10";
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="glass lift group flex h-12 w-12 items-center justify-center rounded-full" aria-label="Mais opções" aria-expanded={open}>
        {pending ? <RefreshCw size={18} className="animate-spin" /> : <MoreHorizontal size={22} className="transition-transform duration-300 group-hover:rotate-90" />}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-label="Fechar" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="glass-strong absolute right-0 top-14 z-50 w-60 origin-top-right rounded-2xl p-1.5"
            >
              <button
                className={row}
                onClick={() => {
                  setOpen(false);
                  start(() => reenrich(itemId));
                }}
              >
                <RefreshCw size={17} className="text-text-2" /> Atualizar dados
              </button>
              <Link href={`/revisar?item=${itemId}`} className={row}>
                <Replace size={17} className="text-text-2" /> Não é esse? Trocar
              </Link>
              <button
                className={`${row} text-danger`}
                onClick={() => {
                  if (confirm("Remover do backlog? (é tirar porque não quer mais, não “já vi”)"))
                    start(async () => {
                      await deleteItem(itemId);
                      router.push("/lista");
                    });
                }}
              >
                <Trash2 size={17} /> Remover do backlog
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NotesEditor({ itemId, initial }: { itemId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "dirty" | "saved">("idle");
  const [, start] = useTransition();
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("dirty");
        }}
        onBlur={() => {
          if (state === "dirty")
            start(async () => {
              await updateNotes(itemId, value);
              setState("saved");
            });
        }}
        rows={3}
        placeholder="Quem indicou, por que quer ver, “se gostou de Interstellar”…"
        className="glass w-full resize-y rounded-2xl p-4 text-[14px] leading-relaxed text-white/85 outline-none placeholder:text-text-3 focus:border-accent/50"
      />
      <AnimatePresence>
        {state === "saved" && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-3 right-4 flex items-center gap-1 text-[12px] text-success">
            <Check size={13} /> salvo
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

