"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Plus, Search } from "lucide-react";
import { KIND_META } from "@/lib/kinds";
import { normalize } from "@/lib/sources/http";
import { useBacklog } from "./backlog-context";
import { Cover } from "./cover";

export function SearchPalette() {
  const { searchOpen, setSearchOpen } = useBacklog();
  return <AnimatePresence>{searchOpen && <Palette onClose={() => setSearchOpen(false)} />}</AnimatePresence>;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { items } = useBacklog();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    const nq = normalize(q);
    if (!nq) return [...items].filter((i) => i.pinned || (i.score ?? 0) >= 8.5).slice(0, 7);
    return items.filter((i) => normalize([i.title, ...i.creators, ...i.genres].join(" ")).includes(nq)).slice(0, 8);
  }, [items, q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  const total = results.length + (q.trim() ? 1 : 0);

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[calc(env(safe-area-inset-top)+12px)] sm:pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Fechar busca" />
      <motion.div
        initial={{ y: -16, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -10, scale: 0.98, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="glass-strong relative w-full max-w-xl overflow-hidden rounded-3xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(total - 1, s + 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(0, s - 1));
          }
          if (e.key === "Enter") {
            if (sel < results.length) go(`/item/${results[sel].id}`);
            else if (q.trim()) go(`/adicionar?q=${encodeURIComponent(q.trim())}`);
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5">
          <Search size={19} className="text-text-2" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder="Buscar no seu backlog…"
            className="h-14 flex-1 bg-transparent text-[17px] outline-none placeholder:text-text-3"
          />
          <kbd className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60 sm:block">Esc</kbd>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-2">
          {!q && <li className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-3">Destaques</li>}
          {results.map((i, idx) => (
            <li key={i.id}>
              <button
                onMouseEnter={() => setSel(idx)}
                onClick={() => go(`/item/${i.id}`)}
                className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors ${sel === idx ? "bg-white/10" : ""}`}
              >
                <Cover item={i} className="w-10 shrink-0" rounded="rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{i.title}</p>
                  <p className="truncate text-[12px] text-text-2">{[KIND_META[i.kind].label, i.year, i.creators[0]].filter(Boolean).join(" · ")}</p>
                </div>
                {sel === idx && <CornerDownLeft size={15} className="text-text-3" />}
              </button>
            </li>
          ))}
          {q.trim() && (
            <li>
              <button
                onMouseEnter={() => setSel(results.length)}
                onClick={() => go(`/adicionar?q=${encodeURIComponent(q.trim())}`)}
                className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ${sel === results.length ? "bg-white/10" : ""}`}
              >
                <span className="flex h-[60px] w-10 items-center justify-center rounded-md border border-dashed border-white/20">
                  <Plus size={16} />
                </span>
                <span className="text-[15px]">
                  Adicionar “<span className="font-semibold">{q.trim()}</span>” ao backlog
                </span>
              </button>
            </li>
          )}
          {q && !results.length && <li className="px-3 pb-2 pt-1 text-[13px] text-text-2">Nada no seu backlog com esse nome.</li>}
        </ul>
      </motion.div>
    </motion.div>
  );
}
