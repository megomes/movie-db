"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dices } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { accessFor, formatMinutes, KIND_META, KINDS, scoreLabel, TIER_COLOR } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { Chip } from "./chip";
import { Cover } from "./cover";

const TIMES = [
  { id: "any", label: "Tanto faz", max: Infinity },
  { id: "short", label: "Até 1h40", max: 100 },
  { id: "evening", label: "Uma noite", max: 150 },
  { id: "weekend", label: "Um fim de semana", max: 900 },
] as const;

const COMPANY = [
  { id: "any", label: "Tanto faz" },
  { id: "me", label: "Só eu" },
  { id: "together", label: "Juntos" },
] as const;

type TimeId = (typeof TIMES)[number]["id"];
type CompanyId = (typeof COMPANY)[number]["id"];

function weightOf(i: LiteItem, userId: string) {
  let w = Math.max(0.5, ((i.score ?? 6.5) - 4) ** 2);
  if (i.priority != null) w *= 1.5;
  if (i.interestedIds.includes(userId)) w *= 1.5;
  return w;
}

function drawWeighted(pool: LiteItem[], n: number, userId: string) {
  const bag = pool.map((i) => ({ i, w: weightOf(i, userId) }));
  const out: LiteItem[] = [];
  while (out.length < n && bag.length) {
    const total = bag.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    const idx = bag.findIndex((x) => (r -= x.w) <= 0);
    out.push(bag.splice(idx === -1 ? bag.length - 1 : idx, 1)[0].i);
  }
  return out;
}

export function Tonight({ items, myProviders, userId }: { items: LiteItem[]; myProviders: number[]; userId: string }) {
  const [kind, setKind] = useState<Kind | "any">("any");
  const [time, setTime] = useState<TimeId>("any");
  const [company, setCompany] = useState<CompanyId>("any");
  const [onlyMine, setOnlyMine] = useState(false);
  const [picks, setPicks] = useState<LiteItem[]>([]);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false]);
  const [reelFaces, setReelFaces] = useState<(LiteItem | null)[]>([null, null, null]);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  const pool = useMemo(() => {
    const max = TIMES.find((t) => t.id === time)!.max;
    return items.filter((i) => {
      if (kind !== "any" && i.kind !== kind) return false;
      // Livro não tem "tempo de uma noite"; séries contam o total de episódios
      if (max !== Infinity && (i.kind === "book" || !i.minutes || i.minutes > max)) return false;
      if (onlyMine && (i.kind === "movie" || i.kind === "series") && accessFor(i, myProviders).tier !== "mine") return false;
      if (company === "me" && i.interestedIds.length > 0 && !i.interestedIds.includes(userId)) return false;
      if (company === "together" && i.interestedIds.length < 2) return false;
      return true;
    });
  }, [items, kind, time, company, onlyMine, myProviders, userId]);

  useEffect(() => () => timers.current.forEach(clearInterval), []);

  // A roleta gira só entre capas já carregadas; as escolhidas são pré-carregadas no clique
  const preloaded = useRef(new Map<string, LiteItem>());
  const preload = (list: LiteItem[]) => {
    for (const i of list) {
      if (!i.coverUrl || preloaded.current.has(i.id)) continue;
      const img = new Image();
      img.onload = () => preloaded.current.set(i.id, i);
      img.src = i.coverUrl;
    }
  };
  useEffect(() => {
    const withCover = items.filter((i) => i.coverUrl);
    preload([...withCover].sort(() => Math.random() - 0.5).slice(0, 18));
  }, [items]);

  function spin() {
    if (!pool.length) return;
    timers.current.forEach(clearInterval);
    const chosen = drawWeighted(pool, 3, userId);
    preload(chosen);
    setPicks(chosen);
    setSpinning([true, true, true]);
    const ready = [...preloaded.current.values()];
    const faces = ready.length >= 4 ? ready : pool;
    timers.current = [0, 1, 2].map((reel) => {
      const t = setInterval(() => {
        setReelFaces((prev) => {
          const next = [...prev];
          next[reel] = faces[Math.floor(Math.random() * faces.length)];
          return next;
        });
      }, 85);
      setTimeout(() => {
        clearInterval(t);
        setReelFaces((prev) => {
          const next = [...prev];
          next[reel] = chosen[reel] ?? null;
          return next;
        });
        setSpinning((prev) => {
          const next = [...prev];
          next[reel] = false;
          return next;
        });
      }, 700 + reel * 380);
      return t;
    });
    if ("vibrate" in navigator) navigator.vibrate?.(15);
  }

  const done = picks.length > 0 && spinning.every((s) => !s);

  return (
    <section className="mt-6 rounded-3xl bg-surface p-4 ring-1 ring-line sm:p-5">
      <div className="space-y-3">
        <Row label="O quê">
          <Chip active={kind === "any"} onClick={() => setKind("any")}>
            Tanto faz
          </Chip>
          {KINDS.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)} color={KIND_META[k].color}>
              {KIND_META[k].label}
            </Chip>
          ))}
        </Row>
        <Row label="Tempo">
          {TIMES.map((t) => (
            <Chip key={t.id} active={time === t.id} onClick={() => setTime(t.id)}>
              {t.label}
            </Chip>
          ))}
        </Row>
        <Row label="Com quem">
          {COMPANY.map((c) => (
            <Chip key={c.id} active={company === c.id} onClick={() => setCompany(c.id)}>
              {c.label}
            </Chip>
          ))}
          <Chip active={onlyMine} onClick={() => setOnlyMine((v) => !v)} color="var(--ok)">
            Só no meu streaming
          </Chip>
        </Row>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4">
        {[0, 1, 2].map((reel) => {
          const face = reelFaces[reel];
          const settled = !spinning[reel] && picks[reel];
          return (
            <div key={reel} className="min-w-0">
              <div className={`overflow-hidden rounded-xl ${spinning[reel] ? "blur-[1.5px] brightness-75" : ""} ${settled ? "reel-pop" : ""}`}>
                {face ? (
                  <Link href={settled ? `/item/${face.id}` : "#"} aria-disabled={!settled} tabIndex={settled ? 0 : -1}>
                    <Cover src={face.coverUrl} title={face.title} kind={face.kind} eager />
                  </Link>
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center rounded-xl border border-dashed border-line text-3xl text-muted/40">
                    ?
                  </div>
                )}
              </div>
              {settled && face && <PickMeta item={face} myProviders={myProviders} />}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={spin}
        disabled={!pool.length || spinning.some(Boolean)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 font-display text-lg font-extrabold text-accent-ink shadow-lg shadow-accent/15 transition active:scale-[0.98] disabled:opacity-50"
      >
        <Dices size={22} strokeWidth={2.4} />
        {done ? "Sortear de novo" : "Sortear"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        {pool.length ? `${pool.length} opções com esses filtros · nota alta pesa mais` : "Nada com esses filtros. Afrouxa um pouco."}
      </p>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">{children}</div>
    </div>
  );
}

function PickMeta({ item, myProviders }: { item: LiteItem; myProviders: number[] }) {
  const access = accessFor(item, myProviders);
  const score = scoreLabel(item);
  const length = item.kind === "book" ? (item.pages ? `${item.pages} pág.` : null) : formatMinutes(item.minutes, item.kind);
  return (
    <div className="rise mt-2 px-0.5">
      <p className="text-[13px] font-semibold leading-tight line-clamp-2">{item.title}</p>
      <p className="mt-1 text-[11px] text-muted">{[score && `★ ${score.value}`, length].filter(Boolean).join(" · ")}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: TIER_COLOR[access.tier] }}>
        <span className="truncate">{access.label}</span>
      </p>
    </div>
  );
}
