/* eslint-disable @next/next/no-img-element -- capa externa */
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Plus, Tag, X } from "lucide-react";
import { createTag } from "@/app/actions";
import type { Kind } from "@/lib/db/schema";
import { KIND_META } from "@/lib/kinds";
import type { TagLite } from "@/lib/queries";
import { useBacklog } from "./backlog-context";

export type TagPickerRequest = {
  kind: Kind;
  title: string;
  cover?: string | null;
  initial?: string[];
  confirmLabel?: string;
  onConfirm: (tagIds: string[]) => Promise<unknown>;
};

// Painel de escolha de tags (ao adicionar, copiar ou editar um item)
export function TagPicker({ request, onClose }: { request: TagPickerRequest | null; onClose: () => void }) {
  return <AnimatePresence>{request && <Panel key={request.title} request={request} onClose={onClose} />}</AnimatePresence>;
}

function Panel({ request, onClose }: { request: TagPickerRequest; onClose: () => void }) {
  const { tagsFor } = useBacklog();
  const [list, setList] = useState<TagLite[]>(() => tagsFor(request.kind));
  const [selected, setSelected] = useState<string[]>(request.initial ?? []);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const tag = await createTag(request.kind, name);
      setList((l) => (l.some((t) => t.id === tag.id) ? l : [...l, tag]));
      setSelected((s) => (s.includes(tag.id) ? s : [...s, tag.id]));
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  async function confirm(ids: string[]) {
    setSaving(true);
    try {
      await request.onConfirm(ids);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-label="Fechar" />
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="glass-strong relative w-full max-w-lg rounded-t-[32px] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:rounded-[32px] sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-start gap-4">
          {request.cover && <img src={request.cover} alt="" className="h-20 w-[54px] shrink-0 rounded-lg object-cover shadow-lg" />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-accent-2">
              <Tag size={13} /> Tags · {KIND_META[request.kind].plural}
            </p>
            <h3 className="mt-1 text-[20px] font-bold leading-tight line-clamp-2">{request.title}</h3>
          </div>
          <button onClick={onClose} className="glass tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        <p className="mb-3 mt-5 text-[14px] text-white/65">Em qual tag você quer colocar?</p>
        <div className="flex flex-wrap gap-2">
          {list.map((t) => {
            const on = selected.includes(t.id);
            return (
              <motion.button
                key={t.id}
                layout
                whileTap={{ scale: 0.93 }}
                onClick={() => toggle(t.id)}
                aria-pressed={on}
                className={`flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors ${on ? "btn-accent" : "glass text-white/80 hover:text-white"}`}
              >
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 16, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden">
                      <Check size={16} strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
                {t.name}
              </motion.button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="glass mt-4 flex h-11 items-center rounded-full pl-4 pr-1.5"
        >
          <Plus size={16} className="text-text-2" />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova tag…" className="h-full flex-1 bg-transparent pl-2 text-[15px] outline-none placeholder:text-text-3" />
          {newName.trim() && (
            <button type="submit" disabled={creating} className="btn-accent flex h-8 items-center rounded-full px-3.5 text-[13px] font-semibold">
              {creating ? <Loader2 size={14} className="animate-spin" /> : "Criar"}
            </button>
          )}
        </form>

        <div className="mt-6 flex items-center gap-3">
          <button onClick={() => confirm([])} disabled={saving} className="tap h-12 rounded-full px-4 text-[14px] text-white/55 hover:text-white">
            Sem tag
          </button>
          <button
            onClick={() => confirm(selected)}
            disabled={saving || !selected.length}
            className="btn-accent flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[16px] font-semibold disabled:opacity-40"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {request.confirmLabel ?? "Salvar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Hook: pergunta as tags quando a divisão tem tags; senão segue direto
export function useTagAsk() {
  const { tagsFor } = useBacklog();
  const [request, setRequest] = useState<TagPickerRequest | null>(null);
  const ask = (req: TagPickerRequest) => {
    if (tagsFor(req.kind).length === 0 && !req.initial) return req.onConfirm([]);
    setRequest(req);
  };
  const picker = <TagPicker request={request} onClose={() => setRequest(null)} />;
  return { ask, picker };
}
