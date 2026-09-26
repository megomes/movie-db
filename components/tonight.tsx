/* eslint-disable @next/next/no-img-element -- arte externa */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Search } from "lucide-react";
import type { Kind } from "@/lib/db/schema";
import { accessFor, formatMinutes, KIND_META, KINDS, scoreLabel } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { Chip } from "./chip";
import { GlassButton } from "./glass-button";
import { Poster } from "./item-card";

const TIMES = [
  { id: "any", label: "Qualquer tempo", max: Infinity },
  { id: "short", label: "Até 1h40", max: 100 },
  { id: "evening", label: "Uma noite", max: 150 },
  { id: "weekend", label: "Um fim de semana", max: 900 },
] as const;
type TimeId = (typeof TIMES)[number]["id"];
type Company = "any" | "me" | "together";

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

function preload(src: string | null) {
  if (!src) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

export function Tonight({
  items,
  myProviders,
  userId,
  userImage,
  initialIds,
}: {
  items: LiteItem[];
  myProviders: number[];
  userId: string;
  userImage: string | null;
  initialIds: string[];
}) {
  const [kind, setKind] = useState<Kind | "any">("any");
  const [time, setTime] = useState<TimeId>("any");
  const [company, setCompany] = useState<Company>("any");
  const [onlyMine, setOnlyMine] = useState(false);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [picks, setPicks] = useState<LiteItem[]>(() => initialIds.map((id) => byId.get(id)!).filter(Boolean));
  const [shuffling, setShuffling] = useState(false);
  const cancel = useRef(false);

  const pool = useMemo(() => {
    const max = TIMES.find((t) => t.id === time)!.max;
    return items.filter((i) => {
      if (kind !== "any" && i.kind !== kind) return false;
      if (max !== Infinity && (i.kind === "book" || !i.minutes || i.minutes > max)) return false;
      if (onlyMine && (i.kind === "movie" || i.kind === "series") && accessFor(i, myProviders).tier !== "mine") return false;
      if (company === "me" && i.interestedIds.length > 0 && !i.interestedIds.includes(userId)) return false;
      if (company === "together" && i.interestedIds.length < 2) return false;
      return true;
    });
  }, [items, kind, time, company, onlyMine, myProviders, userId]);

  useEffect(() => () => void (cancel.current = true), []);

  // Sorteia: passa rapidamente por algumas artes (crossfade) e pousa no escolhido
  async function spin() {
    if (!pool.length || shuffling) return;
    setShuffling(true);
    const chosen = drawWeighted(pool, 9, userId);
    const teasers = drawWeighted(pool.filter((i) => i.coverUrl), 4, userId);
    await Promise.all([preload(chosen[0]?.coverUrl ?? null), preload(chosen[0]?.backdropUrl ?? null), ...teasers.map((t) => preload(t.coverUrl))]);
    for (const t of teasers) {
      if (cancel.current) return;
      setPicks([t]);
      await new Promise((r) => setTimeout(r, 170));
    }
    setPicks(chosen);
    setShuffling(false);
    navigator.vibrate?.(12);
  }

  const hero = picks[0];
  const more = picks.slice(1);

  return (
    <>
      <section className="relative h-[64svh] min-h-[440px] w-full overflow-hidden md:h-[70vh]">
        {hero && (
          <div key={hero.id} className="fade-in absolute inset-0">
            {/* retrato no celular, paisagem no desktop */}
            {hero.coverUrl && <img src={hero.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover md:hidden" />}
            {(hero.backdropUrl ?? hero.coverUrl) && (
              <img src={(hero.backdropUrl ?? hero.coverUrl)!} alt="" className="absolute inset-0 hidden h-full w-full object-cover md:block" />
            )}
          </div>
        )}
        <div className="hero-fade absolute inset-0" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
          <Link href="/ajustes" className="tap h-10 w-10 overflow-hidden rounded-full bg-glass backdrop-blur-md" aria-label="Ajustes">
            {userImage && <img src={userImage} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />}
          </Link>
          <GlassButton href="/lista" label="Buscar">
            <Search size={20} />
          </GlassButton>
        </div>

        {hero && (
          <div key={`meta-${hero.id}`} className="fade-in absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-5 text-center">
            <HeroMeta item={hero} myProviders={myProviders} />
            <div className="mt-4 flex items-center gap-2.5">
              <button
                onClick={spin}
                disabled={shuffling || !pool.length}
                className="tap flex h-10 items-center gap-2 rounded-full bg-pill px-5 text-[15px] font-medium text-white disabled:opacity-60"
              >
                <Dices size={18} className={shuffling ? "animate-spin" : ""} /> Sortear
              </button>
              <Link href={`/item/${hero.id}`} className="tap flex h-10 items-center rounded-full border border-white/80 px-5 text-[15px] font-medium">
                Detalhes
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="space-y-2 pt-2">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
          <Chip active={kind === "any"} onClick={() => setKind("any")}>
            Tudo
          </Chip>
          {KINDS.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {KIND_META[k].plural}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
          {TIMES.map((t) => (
            <Chip key={t.id} active={time === t.id} onClick={() => setTime(t.id)}>
              {t.label}
            </Chip>
          ))}
          <Chip active={company === "me"} onClick={() => setCompany((c) => (c === "me" ? "any" : "me"))}>
            Só eu
          </Chip>
          <Chip active={company === "together"} onClick={() => setCompany((c) => (c === "together" ? "any" : "together"))}>
            Juntos
          </Chip>
          <Chip active={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
            No meu streaming
          </Chip>
        </div>
        <p className="px-4 pt-1 text-xs text-text-3">
          {pool.length ? `${pool.length} opções · nota alta tem mais chance` : "Nada com esses filtros."}
        </p>
      </div>

      {more.length > 0 && !shuffling && (
        <section className="fade-in mt-6">
          <h2 className="mb-3 px-4 text-[20px] font-semibold leading-tight">Também sorteados</h2>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
            {more.map((i) => (
              <div key={i.id} className="w-[120px] shrink-0">
                <Poster item={i} myProviders={myProviders} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function HeroMeta({ item, myProviders }: { item: LiteItem; myProviders: number[] }) {
  const access = accessFor(item, myProviders);
  const score = scoreLabel(item);
  const length = item.kind === "book" ? (item.pages ? `${item.pages} pág.` : null) : formatMinutes(item.minutes, item.kind);
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-2">{KIND_META[item.kind].label}</p>
      <h1 className="mt-1.5 max-w-md text-[26px] font-semibold leading-tight text-balance line-clamp-2">{item.title}</h1>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-text-2">
        {score && (
          <span className="font-medium text-success">
            {score.source} {score.value}
          </span>
        )}
        {item.year && <span>{item.year}</span>}
        {length && <span>{length}</span>}
        {access.tier !== "unknown" && item.kind !== "book" && (
          <span className={access.tier === "mine" ? "text-success" : ""}>{access.label}</span>
        )}
      </p>
    </>
  );
}
