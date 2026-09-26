/* eslint-disable @next/next/no-img-element -- avatares do Google */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Heart, MoreHorizontal, RefreshCw, Replace, Trash2 } from "lucide-react";
import { deleteItem, markDone, reenrich, setMyPlatforms, toggleInterest, undoDone, updateNotes } from "@/app/actions";
import type { Kind } from "@/lib/db/schema";
import type { Person } from "@/lib/queries";

const DONE_LABEL: Record<Kind, string> = { movie: "Já vi", series: "Já vi", game: "Já joguei", book: "Já li" };

// Pílula principal ("Play" da referência). Depois de marcar, 5s para desfazer.
export function DoneButton({ itemId, kind }: { itemId: string; kind: Kind }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [undoing, setUndoing] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

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
      <button
        onClick={done}
        disabled={pending || undoing !== null}
        className="tap mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-pill text-[15px] font-medium text-white disabled:opacity-60"
      >
        <Check size={18} strokeWidth={2.6} /> {DONE_LABEL[kind]}
      </button>

      {undoing !== null && (
        <div className="fade-in fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-bg-3 px-4 py-3">
          <span className="text-sm">Saiu da lista</span>
          <button onClick={undo} className="tap text-sm font-semibold">
            Desfazer · {undoing}
          </button>
        </div>
      )}
    </>
  );
}

// "Eu quero" no canto do título (o "+" da referência)
export function WantButton({ itemId, initial }: { itemId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  return (
    <button
      onClick={() => {
        setOn((v) => !v);
        start(() => toggleInterest(itemId));
      }}
      aria-pressed={on}
      aria-label={on ? "Tirar da minha vontade" : "Eu quero"}
      className="tap mt-4 flex h-10 w-10 shrink-0 items-center justify-center"
    >
      <Heart size={24} className={on ? "fill-danger text-danger" : "text-white"} />
    </button>
  );
}

export function ItemMenu({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const row = "tap flex w-full items-center gap-3 px-4 py-3 text-left text-[15px]";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="tap flex h-10 w-10 items-center justify-center rounded-full bg-glass text-white backdrop-blur-md"
        aria-label="Mais opções"
        aria-expanded={open}
      >
        {pending ? <RefreshCw size={18} className="animate-spin" /> : <MoreHorizontal size={22} />}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Fechar" onClick={() => setOpen(false)} />
          <div className="fade-in absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-xl bg-bg-3 py-1">
            <button
              className={row}
              onClick={() => {
                setOpen(false);
                start(() => reenrich(itemId));
              }}
            >
              <RefreshCw size={18} className="text-text-2" /> Atualizar dados
            </button>
            <Link href={`/revisar?item=${itemId}`} className={row}>
              <Replace size={18} className="text-text-2" /> Não é esse? Trocar
            </Link>
            <button
              className={`${row} text-danger`}
              onClick={() => {
                if (confirm("Remover da lista? (é tirar porque não quer mais, não “já vi”)"))
                  start(async () => {
                    await deleteItem(itemId);
                    router.push("/lista");
                  });
              }}
            >
              <Trash2 size={18} /> Remover da lista
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Avatares de quem quer (como o "Top Cast" da referência)
export function InterestToggle({ people, interestedIds }: { people: Person[]; interestedIds: string[] }) {
  return (
    <div className="flex gap-4">
      {people.map((p) => {
        const on = interestedIds.includes(p.userId);
        const first = p.name?.split(" ")[0] ?? "?";
        return (
          <div key={p.userId} className={`w-[60px] text-center transition-opacity ${on ? "" : "opacity-40"}`}>
            <div className={`mx-auto h-[52px] w-[52px] overflow-hidden rounded-full bg-bg-3 ${on ? "ring-2 ring-danger" : ""}`}>
              {p.image ? (
                <img src={p.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg">{first[0]}</span>
              )}
            </div>
            <p className="mt-1.5 truncate text-[12px] font-medium">{first}</p>
            <p className="text-[11px] text-text-2">{on ? "quer" : "—"}</p>
          </div>
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
          if (!saved)
            start(async () => {
              await updateNotes(itemId, value);
              setSaved(true);
            });
        }}
        rows={2}
        placeholder="Quem indicou, por que quer ver, “se gostou de Interstellar”…"
        className="w-full resize-y rounded-lg bg-bg-2 p-3 text-[14px] leading-[1.45] text-text-2 outline-none placeholder:text-text-3 focus:text-text"
      />
      {!saved && <p className="mt-1 text-xs text-text-3">Salva quando você sair do campo.</p>}
    </div>
  );
}

const PLATFORMS = ["PC", "Switch", "PS5", "Xbox"];

export function PlatformToggle({ itemId, current }: { itemId: string; current: string[] }) {
  const [value, setValue] = useState(current);
  const [, start] = useTransition();
  return (
    <div>
      <p className="mb-2 text-[13px] text-text-2">Quero jogar no</p>
      <div className="flex flex-wrap gap-2">
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
              aria-pressed={on}
              className={`tap h-8 rounded-full px-3.5 text-[13px] font-medium ${on ? "bg-text text-bg" : "border border-line text-text-2"}`}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
