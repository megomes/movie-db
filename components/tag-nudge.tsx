"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus, Tag, X } from "lucide-react";
import { createTag } from "@/app/actions";
import type { Kind } from "@/lib/db/schema";
import { KIND_META } from "@/lib/kinds";
import { useBacklog } from "./backlog-context";

const SUGGESTIONS: Record<Kind, string[]> = {
  movie: ["Pra ver a dois", "Clássicos", "Terror", "Comédia leve", "Oscar"],
  series: ["Pra maratonar", "Leve", "Documentário", "Anime", "Com alguém"],
  game: ["PC", "Switch", "PS5", "Xbox", "Co-op"],
  book: ["Ficção", "Não ficção", "Trabalho", "Pra comprar", "Kindle"],
};
const MIN_ITEMS = 6;
const storeKey = (kind: Kind) => `tag-nudge-off:${kind}`;
const read = (kind: Kind) => {
  try {
    return localStorage.getItem(storeKey(kind)) === "1";
  } catch {
    return false;
  }
};

// Na Lista: quando a divisão já tem vários itens e nenhuma tag, sugere algumas pra criar num toque
export function TagNudge({ kind, count }: { kind: Kind; count: number }) {
  const { tagsFor } = useBacklog();
  const [eligible] = useState(() => tagsFor(kind).length === 0);
  const [closed, setClosed] = useState(false);
  const dismissed = useSyncExternalStore(
    () => () => {},
    () => read(kind),
    () => true,
  );
  const [created, setCreated] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const show = eligible && count >= MIN_ITEMS && !dismissed && !closed;

  const close = () => {
    try {
      localStorage.setItem(storeKey(kind), "1");
    } catch {}
    setClosed(true);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="mt-5 overflow-hidden">
          <div className="glass relative overflow-hidden rounded-[26px] p-4 lg:flex lg:items-center lg:gap-5 lg:p-5">
            <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-accent/30 blur-3xl" />
            <div className="relative flex items-start gap-3 pr-8 lg:w-[340px] lg:shrink-0 lg:pr-0">
              <span className="btn-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                <Tag size={20} />
              </span>
              <span>
                <span className="block text-[16px] font-semibold leading-tight">
                  {created.length ? "Pronto! Agora é só marcar" : `Organize seus ${count} ${KIND_META[kind].plural.toLowerCase()}`}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-text-2">
                  {created.length
                    ? "Ao adicionar algo, o app pergunta a tag. Nos que você já tem, use “Trocar tags” no detalhe."
                    : "Com tags, dá pra filtrar e agrupar a lista. Toque pra criar:"}
                </span>
              </span>
            </div>
            <div className="no-scrollbar relative -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:mt-0 lg:flex-1 lg:flex-wrap lg:px-0">
              {SUGGESTIONS[kind].map((name) => {
                const on = created.includes(name);
                return (
                  <motion.button
                    key={name}
                    whileTap={{ scale: 0.9 }}
                    disabled={on || pending}
                    onClick={() =>
                      start(async () => {
                        await createTag(kind, name);
                        setCreated((c) => [...c, name]);
                      })
                    }
                    className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors ${on ? "btn-accent" : "bg-white/[0.07] hover:bg-white/[0.12]"}`}
                  >
                    {on ? <Check size={15} strokeWidth={3} /> : <Plus size={15} />} {name}
                  </motion.button>
                );
              })}
              <Link href="/ajustes#tags" className="flex h-10 shrink-0 items-center rounded-full px-3 text-[14px] font-medium text-text-2 hover:text-white">
                Outra…
              </Link>
            </div>
            <button onClick={close} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-text-2 hover:bg-white/10 hover:text-white" aria-label="Dispensar">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
