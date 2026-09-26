/* eslint-disable @next/next/no-img-element -- arte externa */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dices, Heart, HeartHandshake, Info } from "lucide-react";
import { togglePin } from "@/app/actions";
import { artSrc, coverSrc } from "@/lib/img";
import { ptGenre } from "@/lib/genres";
import { accessFor, formatMinutes, KIND_META, scoreLabel } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Cover } from "./cover";
import { Avatar } from "./people-switch";
import { GUTTER } from "./rail";

const DURATION = 8000;

// Destaque rotativo da home
export function Billboard({ featured }: { featured: LiteItem[] }) {
  const { setAmbient, setDrawOpen, shared, me } = useBacklog();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [spin, setSpin] = useState(0);
  // Fora da tela: para a rotação e o zoom (economiza CPU enquanto rola pelas prateleiras)
  const [onScreen, setOnScreen] = useState(true);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const item = featured[index];

  useEffect(() => {
    setAmbient(item?.coverColor);
  }, [item, setAmbient]);

  useEffect(() => {
    if (paused || !onScreen || featured.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % featured.length), DURATION);
    return () => clearTimeout(t);
  }, [index, paused, onScreen, featured.length]);

  // Pré-carrega o próximo
  useEffect(() => {
    const next = featured[(index + 1) % featured.length];
    if (next) new Image().src = (artSrc(next.backdropUrl, "lg") ?? coverSrc(next.coverUrl, "md"))!;
  }, [index, featured]);

  if (!item) return null;
  const go = (d: number) => setIndex((i) => (i + d + featured.length) % featured.length);

  return (
    <section ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className={`relative ${onScreen ? "" : "offscreen"}`}>
      {/* Desktop: arte em tela cheia */}
      <div className="relative hidden h-[86vh] min-h-[600px] overflow-hidden lg:block">
        <AnimatePresence initial={false}>
          <motion.div key={item.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}>
            <Art item={item} />
          </motion.div>
        </AnimatePresence>
        <div className="fade-left absolute inset-0" />
        <div className="fade-bottom absolute inset-0" />

        <div className={`absolute inset-x-0 bottom-[14%] ${GUTTER}`}>
          <AnimatePresence mode="wait">
            <motion.div key={item.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="max-w-2xl">
              <Meta item={item} big />
            </motion.div>
          </AnimatePresence>
          <Actions key={item.id} item={item} onDraw={() => setDrawOpen(true)} />
        </div>

        <Progress featured={featured} index={index} paused={paused || !onScreen} onPick={setIndex} className="absolute bottom-[14%] right-10" />
      </div>

      {/* Celular: card de arte arrastável */}
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+14px)] lg:hidden">
        <div className="relative z-20 mb-3 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-text-2">Seu backlog</p>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight">Pra hoje ✨</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/juntos" aria-label="Juntos" className="glass flex h-11 items-center gap-1.5 rounded-full pl-1.5 pr-3.5 text-[14px] font-semibold active:scale-95">
              {shared.length > 0 ? (
                <span className="flex -space-x-2">
                  <Avatar src={me.image} name={me.name} size={26} />
                  <Avatar src={shared[0].image} name={shared[0].name} size={26} />
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center">
                  <HeartHandshake size={18} />
                </span>
              )}
              Juntos
            </Link>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                setSpin((s) => s + 1);
                setDrawOpen(true);
              }}
              aria-label="Sortear"
              className="btn-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            >
              <motion.span animate={{ rotate: spin * 360 }} transition={{ type: "spring", stiffness: 120, damping: 14 }}>
                <Dices size={20} strokeWidth={2.2} />
              </motion.span>
            </motion.button>
          </div>
        </div>
        <motion.div
          className="relative aspect-[3/4] overflow-hidden rounded-[30px] bg-bg-3 shadow-[0_24px_60px_rgb(0_0_0/0.55)]"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragStart={() => setPaused(true)}
          onDragEnd={(_, info) => {
            setPaused(false);
            if (info.offset.x < -60) go(1);
            else if (info.offset.x > 60) go(-1);
          }}
        >
          <AnimatePresence initial={false}>
            <motion.div key={item.id} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
              {item.coverUrl ? (
                <img src={coverSrc(item.coverUrl, "lg")!} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <Cover item={item} rounded="rounded-none" className="h-full" />
              )}
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          {scoreLabel(item) && <span className="glass absolute left-4 top-4 rounded-full px-2.5 py-1 text-[12px] font-semibold">★ {scoreLabel(item)!.value}</span>}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <AnimatePresence mode="wait">
              <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <Meta item={item} />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Actions key={item.id} item={item} onDraw={() => setDrawOpen(true)} compact />
          <Progress featured={featured} index={index} paused={paused || !onScreen} onPick={setIndex} />
        </div>
      </div>
    </section>
  );
}

function Art({ item }: { item: LiteItem }) {
  const art = artSrc(item.backdropUrl, "lg");
  if (art) return <img src={art} alt="" className="ken-burns h-full w-full object-cover" />;
  // Sem arte de fundo (livros, alguns jogos): capa borrada + capa flutuando à direita
  return (
    <div className="relative h-full w-full" style={{ backgroundColor: item.coverColor ?? "#101522" }}>
      {item.coverUrl && <img src={coverSrc(item.coverUrl, "sm")!} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl saturate-150" />}
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: 4 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute right-[12%] top-1/2 w-[min(22vw,340px)] -translate-y-1/2 shadow-[0_40px_90px_rgb(0_0_0/0.7)]"
      >
        <Cover item={item} size="lg" rounded="rounded-2xl" eager />
      </motion.div>
    </div>
  );
}

function Meta({ item, big = false }: { item: LiteItem; big?: boolean }) {
  const { myProviders } = useBacklog();
  const access = accessFor(item, myProviders);
  const score = scoreLabel(item);
  const length = item.kind === "book" ? (item.pages ? `${item.pages} páginas` : null) : formatMinutes(item.minutes, item.kind);
  return (
    <>
      <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
        {KIND_META[item.kind].label}
        {item.genres[0] && <span className="font-normal normal-case tracking-normal text-white/55">· {ptGenre(item.genres[0])}</span>}
      </span>
      {big && item.logoUrl ? (
        // Logotipo oficial no lugar do título (como nos apps de streaming)
        <img src={item.logoUrl} alt={item.title} className="mt-5 max-h-[150px] w-auto max-w-[min(520px,80%)] object-contain object-left drop-shadow-[0_6px_30px_rgb(0_0_0/0.6)]" />
      ) : (
        <h2 className={`mt-3 font-bold leading-[1.02] tracking-tight ${big ? "text-[clamp(40px,4.4vw,68px)] line-clamp-2" : "text-[28px] line-clamp-2"}`}>{item.title}</h2>
      )}
      <p className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-white/75 ${big ? "text-[15px]" : "text-[13px]"}`}>
        {score && (
          <span className={`rounded-md px-1.5 py-0.5 text-[12px] font-bold ${score.source === "IMDb" ? "bg-[#f5c518] text-black" : "bg-white/90 text-black"}`}>
            {score.source} {score.value}
          </span>
        )}
        {item.year && <span>{item.year}</span>}
        {length && <span>{length}</span>}
        {item.kind !== "book" && access.tier !== "unknown" && <span className={access.tier === "mine" ? "font-medium text-success" : ""}>{access.label}</span>}
      </p>
      {big && item.overview && <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/70 line-clamp-3">{item.overview}</p>}
    </>
  );
}

function Actions({ item, onDraw, compact = false }: { item: LiteItem; onDraw: () => void; compact?: boolean }) {
  const [pinned, setPinned] = useState(item.pinned);
  const [, start] = useTransition();
  return (
    <div className={`flex items-center gap-2.5 ${compact ? "" : "mt-7"}`}>
      <Link href={`/item/${item.id}`} className={`btn-accent lift tap group relative flex items-center gap-2 rounded-full font-semibold ${compact ? "h-11 px-5 text-[14px]" : "h-12 px-7 text-[16px]"}`}>
        <span className="shine" />
        <Info size={18} className="transition-transform duration-300 group-hover:scale-110" /> Detalhes
      </Link>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => {
          setPinned((v) => !v);
          start(() => togglePin(item.id).then(() => undefined));
        }}
        className={`glass lift heart-hover group flex items-center justify-center rounded-full ${compact ? "h-11 w-11" : "h-12 w-12"}`}
        aria-label={pinned ? "Tirar de quero muito" : "Quero muito"}
      >
        <motion.span key={String(pinned)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
          <span className="heartbeat block">
            <Heart size={20} className={`transition-colors duration-200 ${pinned ? "fill-danger text-danger" : "group-hover:text-danger"}`} />
          </span>
        </motion.span>
      </motion.button>
      {!compact && (
        <button onClick={onDraw} className="glass lift tap group flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium">
          <Dices size={18} className="transition-transform duration-500 group-hover:rotate-[200deg]" /> Sortear outro
        </button>
      )}
    </div>
  );
}

function Progress({ featured, index, paused, onPick, className = "" }: { featured: LiteItem[]; index: number; paused: boolean; onPick: (i: number) => void; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {featured.map((f, i) => (
        <button
          key={f.id}
          onClick={() => onPick(i)}
          className={`relative h-1.5 overflow-hidden rounded-full bg-white/20 transition-all duration-300 lg:w-10 ${i === index ? "w-7" : "w-2"}`}
          aria-label={`Destaque ${i + 1}`}
        >
          {i < index && <span className="absolute inset-0 bg-white/70" />}
          {i === index && (
            // scaleX em vez de width: roda no compositor, sem recalcular layout a cada quadro
            <motion.span
              key={`${f.id}-${paused}`}
              className="absolute inset-0 origin-left bg-white"
              initial={{ scaleX: paused ? 1 : 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: paused ? 0 : DURATION / 1000, ease: "linear" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
