/* eslint-disable @next/next/no-img-element -- capas externas */
"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Clapperboard, Gamepad2, Moon, Shuffle } from "lucide-react";
import { artSrc, coverSrc } from "@/lib/img";
import { ptGenre } from "@/lib/genres";
import { accessFor, formatMinutes, KIND_META, scoreLabel } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { GUTTER } from "./rail";

export type TimeBucket = { id: string; label: string; hint: string; icon: "film" | "moon" | "game" | "book"; items: LiteItem[] };

const ICONS = { film: Clapperboard, moon: Moon, game: Gamepad2, book: BookOpen };

// "Quanto tempo você tem?": um cartão por faixa de tempo, cada um sugere algo que cabe
export function TimeCards({ buckets }: { buckets: TimeBucket[] }) {
  const visible = buckets.filter((b) => b.items.length);
  if (!visible.length) return null;
  return (
    <section className="rise">
      <div className={`mb-4 ${GUTTER}`}>
        <h2 className="text-[22px] font-bold tracking-tight lg:text-[28px]">Quanto tempo você tem?</h2>
        <p className="mt-0.5 text-[13px] text-text-2">Uma sugestão que cabe no seu tempo. Não curtiu? Embaralha.</p>
      </div>
      <div className={`no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-2 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible ${GUTTER}`}>
        {visible.map((b) => (
          <Card key={b.id} bucket={b} />
        ))}
      </div>
    </section>
  );
}

function Card({ bucket }: { bucket: TimeBucket }) {
  const { myProviders } = useBacklog();
  const [i, setI] = useState(0);
  const [spins, setSpins] = useState(0);
  const item = bucket.items[i % bucket.items.length];
  const Icon = ICONS[bucket.icon];
  const score = scoreLabel(item);
  const length = item.kind === "book" ? (item.pages ? `${item.pages} pág.` : null) : formatMinutes(item.minutes, item.kind);
  const access = accessFor(item, myProviders);
  const art = artSrc(item.backdropUrl, "md");

  return (
    <div className="relative h-[230px] w-[78%] shrink-0 snap-start overflow-hidden rounded-[28px] bg-bg-3 sm:w-[46%] lg:h-[260px] lg:w-auto">
      {/* Fundo: capa borrada na cor da obra */}
      <AnimatePresence initial={false}>
        <motion.div
          key={item.id}
          className="absolute inset-0"
          style={{ backgroundColor: item.coverColor ?? "#141a24" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          {art ? (
            <img src={art} alt="" className="ken-burns h-full w-full object-cover opacity-80" />
          ) : (
            item.coverUrl && <img src={coverSrc(item.coverUrl, "sm")!} alt="" className="h-full w-full scale-125 object-cover opacity-70 blur-2xl saturate-150" />
          )}
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/10" />

      <Link href={`/item/${item.id}`} className="absolute inset-0 flex flex-col p-4 lg:p-5">
        <span className="glass flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold">
          <Icon size={13} /> {bucket.label}
        </span>
        <span className="mt-0.5 pl-1 text-[11px] text-white/55">{bucket.hint}</span>
        <div className="mt-auto flex items-end gap-3.5">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={item.id}
              initial={{ y: 30, rotate: -8, opacity: 0 }}
              animate={{ y: 0, rotate: -3, opacity: 1 }}
              exit={{ y: -20, rotate: 8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="h-[118px] w-[80px] shrink-0 overflow-hidden rounded-xl shadow-[0_14px_30px_rgb(0_0_0/0.55)] lg:h-[132px] lg:w-[90px]"
              style={{ backgroundColor: item.coverColor ?? "#1a1a1a" }}
            >
              {item.coverUrl && <img src={coverSrc(item.coverUrl, "sm")!} alt="" className="h-full w-full object-cover" />}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={item.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} className="min-w-0 flex-1 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                {KIND_META[item.kind].label}
                {item.genres[0] && <span className="font-normal normal-case tracking-normal"> · {ptGenre(item.genres[0])}</span>}
              </p>
              <p className="mt-0.5 text-[16px] font-bold leading-tight line-clamp-2 lg:text-[18px]">{item.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-white/70">
                {score && <span className="rounded bg-white/90 px-1 text-[11px] font-bold text-black">★ {score.value}</span>}
                {length && <span>{length}</span>}
                {item.kind !== "book" && access.tier !== "unknown" && <span className={access.tier === "mine" ? "font-medium text-success" : "text-white/55"}>{access.label}</span>}
              </p>
              {item.overview && <p className="mt-1.5 text-[12px] leading-snug text-white/60 line-clamp-2">{item.overview}</p>}
            </motion.div>
          </AnimatePresence>
        </div>
      </Link>

      {bucket.items.length > 1 && (
        <button
          onClick={() => {
            setI((x) => x + 1);
            setSpins((s) => s + 1);
          }}
          className="glass absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full"
          aria-label={`Outra sugestão para ${bucket.label}`}
        >
          <motion.span animate={{ rotate: spins * 180 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
            <Shuffle size={16} />
          </motion.span>
        </button>
      )}
    </div>
  );
}
