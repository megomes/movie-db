"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { createTag, deleteTag, renameTag } from "@/app/actions";
import type { Kind } from "@/lib/db/schema";
import { KIND_META, KINDS } from "@/lib/kinds";
import { useBacklog } from "./backlog-context";

// Gerenciar tags por divisão (Perfil)
export function TagManager() {
  const { tags, items } = useBacklog();
  const [kind, setKind] = useState<Kind>("book");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) for (const t of i.tagIds) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [items]);
  const list = tags.filter((t) => t.kind === kind);

  return (
    <div>
      <div className="glass no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
        {KINDS.map((k) => {
          const n = tags.filter((t) => t.kind === k).length;
          return (
            <button key={k} onClick={() => setKind(k)} className="relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium">
              {kind === k && <motion.span layoutId="tag-kind" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className={`relative ${kind === k ? "text-white" : "text-white/70"}`}>
                {KIND_META[k].plural} {n > 0 && <span className="opacity-60">{n}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="glass mt-4 overflow-hidden rounded-3xl">
        <AnimatePresence initial={false}>
          {list.map((t) => (
            <TagRow key={t.id} id={t.id} name={t.name} count={counts.get(t.id) ?? 0} />
          ))}
        </AnimatePresence>
        {!list.length && (
          <p className="px-5 py-6 text-[14px] text-white/55">
            Sem tags em {KIND_META[kind].plural.toLowerCase()}. Crie uma abaixo e o app vai perguntar qual usar sempre que você adicionar algo aqui.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            start(async () => {
              await createTag(kind, name);
              setName("");
            });
          }}
          className="flex items-center gap-3 border-t border-white/10 px-5 py-3"
        >
          <Plus size={17} className="text-text-2" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Nova tag em ${KIND_META[kind].plural}…`} className="h-9 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3" />
          {name.trim() && (
            <button type="submit" disabled={pending} className="btn-accent flex h-9 items-center rounded-full px-4 text-[13px] font-semibold">
              {pending ? <Loader2 size={14} className="animate-spin" /> : "Criar"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function TagRow({ id, name, count }: { id: string; name: string; count: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();

  return (
    <motion.div layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-b border-white/10 last:border-b-0">
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-2">
          <Tag size={16} />
        </span>
        {editing ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!value.trim() || value.trim() === name) return setEditing(false);
              start(async () => {
                await renameTag(id, value);
                setEditing(false);
              });
            }}
          >
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="h-9 flex-1 rounded-lg bg-white/10 px-3 text-[15px] outline-none" />
            <button type="submit" disabled={pending} className="btn-accent flex h-9 w-9 items-center justify-center rounded-full" aria-label="Salvar">
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(name);
                setEditing(false);
              }}
              className="glass flex h-9 w-9 items-center justify-center rounded-full"
              aria-label="Cancelar"
            >
              <X size={15} />
            </button>
          </form>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="group flex flex-1 items-center gap-2 text-left">
              <span className="text-[15px] font-medium">{name}</span>
              <Pencil size={13} className="text-white/30 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <span className="text-[13px] tabular-nums text-white/45">
              {count} {count === 1 ? "item" : "itens"}
            </span>
            <button
              onClick={() =>
                confirm(`Apagar a tag “${name}”? ${count ? `Ela sai de ${count} ${count === 1 ? "item" : "itens"} (os itens continuam no backlog).` : ""}`) &&
                start(() => deleteTag(id))
              }
              disabled={pending}
              className="tap flex h-9 w-9 items-center justify-center rounded-full text-white/45 hover:bg-danger/15 hover:text-danger"
              aria-label={`Apagar ${name}`}
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
