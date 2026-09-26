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

function Confetti() {
  const [bits] = useState(() => Array.from({ length: 26 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const d = 90 + Math.random() * 110;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: Math.random() * 540, c: ["#fff", "#67d87a", "#5b9bff", "#ffd166", "#ff8fab"][i % 5] };
  }));
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute h-2.5 w-1.5 rounded-[2px]"
          style={{ background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 60], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

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

  function mark() {
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
        whileTap={{ scale: 0.96 }}
        className={`relative flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[16px] font-semibold transition-colors sm:flex-none sm:px-9 ${done ? "bg-success text-black" : "btn-accent"}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={String(done)} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="flex items-center gap-2">
            {done ? "Saiu da lista!" : DONE_LABEL[kind]}
            <span className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? "bg-black/15" : "bg-white/25"}`}>
              <Check size={13} strokeWidth={3.5} />
            </span>
          </motion.span>
        </AnimatePresence>
        {done && <Confetti />}
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
      className="glass relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
    >
      <motion.span key={String(on)} initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 13 }}>
        <Heart size={21} className={on ? "fill-danger text-danger" : ""} />
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
      className="btn-accent flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-7 text-[16px] font-semibold sm:flex-none"
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={19} />} Quero ver também
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
      <button onClick={() => setOpen((v) => !v)} className="glass flex h-12 w-12 items-center justify-center rounded-full" aria-label="Mais opções" aria-expanded={open}>
        {pending ? <RefreshCw size={18} className="animate-spin" /> : <MoreHorizontal size={22} />}
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

