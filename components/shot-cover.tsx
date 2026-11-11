/* eslint-disable @next/next/no-img-element -- screenshots vêm direto do CDN do IGDB */
"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { addItem, deleteItem } from "@/app/actions";
import { useBacklog } from "./backlog-context";
import { Cover } from "./cover";

// Capa de jogo que, com o mouse em cima, percorre as screenshots pela posição horizontal
export function ShotCover({
  id,
  title,
  coverUrl,
  screenshots,
  eager = false,
  dim = false,
  overlay,
}: {
  id: string;
  title: string;
  coverUrl: string | null;
  screenshots: string[];
  eager?: boolean;
  /** Capa um pouco apagada até o hover (ex.: fora do backlog) */
  dim?: boolean;
  /** Selos por cima da capa; recebe se está mostrando screenshot */
  overlay?: (scrubbing: boolean) => React.ReactNode;
}) {
  const [shot, setShot] = useState<number | null>(null);
  const preloaded = useRef(false);

  return (
    <div
      className="relative overflow-hidden rounded-2xl transition-[scale,box-shadow] duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_18px_50px_rgb(0_0_0/0.6)]"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || !screenshots.length || preloaded.current) return;
        preloaded.current = true;
        for (const src of screenshots) new Image().src = src;
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !screenshots.length) return;
        const r = e.currentTarget.getBoundingClientRect();
        setShot(Math.min(screenshots.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * screenshots.length))));
      }}
      onPointerLeave={() => setShot(null)}
    >
      <Cover
        item={{ id, title, kind: "game", coverUrl }}
        eager={eager}
        rounded="rounded-2xl"
        className={dim && shot == null ? "opacity-80 transition-opacity group-hover:opacity-100" : ""}
      />
      {shot != null && (
        <>
          <img src={screenshots[shot]} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex gap-1">
            {screenshots.map((_, i) => (
              <span key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${i === shot ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </>
      )}
      {overlay?.(shot != null)}
    </div>
  );
}

// Botão redondo no canto da capa: + põe no backlog, ✓ (azul) já está lá
export function BacklogButton({ on, busy, onClick }: { on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      title={on ? "Tirar do backlog" : "Pôr no backlog"}
      className={`tap absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full ring-1 transition-colors ${
        on ? "btn-accent ring-white/20" : "bg-black/60 text-white/85 ring-white/15 hover:bg-black/80 hover:text-white"
      }`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : on ? <Check size={16} strokeWidth={2.6} /> : <Plus size={16} strokeWidth={2.4} />}
    </button>
  );
}

export type BacklogRef = { id: string; done: boolean };

// Estado "está no backlog?" por jogo do IGDB, com pôr/tirar otimista. A base é o backlog do app (que o menu de
// botão direito também muda) mais os zerados que a página mandou; as mudanças locais valem até o backlog atualizar.
export function useBacklogToggle(initial: Record<number, BacklogRef>) {
  const { items } = useBacklog();
  const [overrides, setOverrides] = useState<Record<number, BacklogRef | null>>({});
  const [lastItems, setLastItems] = useState(items);
  if (lastItems !== items) {
    setLastItems(items);
    setOverrides({});
  }
  const owned = useMemo(() => {
    const o: Record<number, BacklogRef> = {};
    for (const [k, v] of Object.entries(initial)) if (v.done) o[Number(k)] = v;
    for (const i of items) if (i.kind === "game" && i.igdbId != null) o[i.igdbId] = { id: i.id, done: false };
    for (const [k, v] of Object.entries(overrides)) {
      if (v) o[Number(k)] = v;
      else delete o[Number(k)];
    }
    return o;
  }, [initial, items, overrides]);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  const set = (igdbId: number, ref: BacklogRef | null) => setOverrides((o) => ({ ...o, [igdbId]: ref }));
  const mark = (igdbId: number, on: boolean) =>
    setBusy((b) => {
      const n = new Set(b);
      if (on) n.add(igdbId);
      else n.delete(igdbId);
      return n;
    });

  function toggle(igdbId: number) {
    const prev = owned[igdbId] ?? null;
    if (prev?.done || busy.has(igdbId)) return;
    mark(igdbId, true);
    startTransition(async () => {
      try {
        if (prev) {
          set(igdbId, null);
          await deleteItem(prev.id);
        } else {
          const id = await addItem("game", String(igdbId));
          set(igdbId, { id, done: false });
        }
      } catch {
        set(igdbId, prev);
      } finally {
        mark(igdbId, false);
      }
    });
  }

  return { owned, busy, toggle };
}
