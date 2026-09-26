/* eslint-disable @next/next/no-img-element -- avatares do Google */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Heart, RefreshCw, Replace, Trash2 } from "lucide-react";
import { deleteItem, markDone, reenrich, setMyPlatforms, toggleInterest, undoDone, updateNotes } from "@/app/actions";
import type { Kind } from "@/lib/db/schema";
import type { Person } from "@/lib/queries";

const DONE_LABEL: Record<Kind, string> = { movie: "Já vi", series: "Já vi", game: "Já joguei", book: "Já li" };

export function ItemActions({ itemId, kind, verb }: { itemId: string; kind: Kind; verb: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [undoing, setUndoing] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function done() {
    start(async () => {
      await markDone(itemId);
      setUndoing(5);
      timer.current = setInterval(() => {
        setUndoing((s) => {
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
    setUndoing(null);
    start(() => undoDone(itemId));
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={done}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 font-display text-base font-extrabold text-accent-ink active:scale-[0.98] disabled:opacity-60"
        >
          <Check size={20} strokeWidth={3} /> {DONE_LABEL[kind]}
        </button>
        <button
          onClick={() => start(() => reenrich(itemId))}
          disabled={pending}
          className="rounded-2xl bg-surface px-4 ring-1 ring-line disabled:opacity-60"
          aria-label="Atualizar dados"
          title="Atualizar notas e onde ver"
        >
          <RefreshCw size={18} className={pending && undoing === null ? "animate-spin" : ""} />
        </button>
        <Link href={`/revisar?item=${itemId}`} className="flex items-center rounded-2xl bg-surface px-4 ring-1 ring-line" aria-label="Não é esse" title="Não é esse? Trocar">
          <Replace size={18} />
        </Link>
        <button
          onClick={() => {
            if (confirm("Remover da lista? (não é 'já vi', é tirar porque não quer mais)")) start(async () => {
              await deleteItem(itemId);
              router.push("/lista");
            });
          }}
          className="rounded-2xl bg-surface px-4 text-danger ring-1 ring-line"
          aria-label="Remover"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <p className="-mt-4 text-xs text-muted">Depois de {verb}, some da lista. Sem histórico.</p>

      {undoing !== null && (
        <div className="rise fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-text px-4 py-3 text-bg shadow-2xl">
          <span className="text-sm font-medium">Saiu da lista 🎉</span>
          <button onClick={undo} className="rounded-lg bg-bg px-3 py-1.5 text-sm font-semibold text-text">
            Desfazer ({undoing})
          </button>
        </div>
      )}
    </>
  );
}

export function InterestToggle({ itemId, people, interestedIds, userId }: { itemId: string; people: Person[]; interestedIds: string[]; userId: string }) {
  const [pending, start] = useTransition();
  const [mine, setMine] = useState(interestedIds.includes(userId));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {people.map((p) => {
        const on = p.userId === userId ? mine : interestedIds.includes(p.userId);
        const first = p.name?.split(" ")[0] ?? "?";
        const content = (
          <>
            {p.image ? <img src={p.image} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs">{first[0]}</span>}
            {first}
            {on && <Heart size={14} className="fill-current" />}
          </>
        );
        const cls = `flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm ring-1 ${on ? "bg-danger/15 text-danger ring-danger/40" : "bg-surface text-muted ring-line"}`;
        return p.userId === userId ? (
          <button
            key={p.userId}
            disabled={pending}
            onClick={() => {
              setMine((v) => !v);
              start(() => toggleInterest(itemId));
            }}
            className={cls}
          >
            {content}
          </button>
        ) : (
          <span key={p.userId} className={cls}>
            {content}
          </span>
        );
      })}
    </div>
  );
}

export function NotesEditor({ itemId, initial }: { itemId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [, start] = useTransition();
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          if (!saved) start(async () => {
            await updateNotes(itemId, value);
            setSaved(true);
          });
        }}
        rows={2}
        placeholder="Quem indicou, por que quer ver, “se gostou de Interstellar”…"
        className="w-full resize-y rounded-xl bg-surface p-3 text-sm outline-none ring-1 ring-line placeholder:text-muted focus:ring-accent/60"
      />
      {!saved && <p className="mt-1 text-xs text-muted">Salva quando você sair do campo.</p>}
    </div>
  );
}

const PLATFORMS = ["PC", "Switch", "PS5", "Xbox"];

export function PlatformToggle({ itemId, current }: { itemId: string; current: string[] }) {
  const [value, setValue] = useState(current);
  const [, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Quero jogar no:</span>
      {PLATFORMS.map((p) => {
        const on = value.includes(p);
        return (
          <button
            key={p}
            onClick={() => {
              const next = on ? value.filter((x) => x !== p) : [...value, p];
              setValue(next);
              start(() => setMyPlatforms(itemId, next));
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${on ? "bg-game text-bg ring-game" : "bg-surface text-muted ring-line"}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
