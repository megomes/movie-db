/* eslint-disable @next/next/no-img-element -- imagens externas */
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { artSrc } from "@/lib/img";

// Galeria horizontal (screenshots de jogo / cenas de filme) com visualizador em tela cheia
export function Gallery({ title, images }: { title: string; images: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const by = (d: 1 | -1) => rail.current?.scrollBy({ left: d * rail.current.clientWidth * 0.8, behavior: "smooth" });
  if (!images.length) return null;
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-[22px] font-bold tracking-tight">
          {title} <span className="text-[14px] font-semibold text-text-3">{images.length}</span>
        </h2>
        <div className="hidden gap-2 lg:flex">
          <button onClick={() => by(-1)} className="glass tap flex h-10 w-10 items-center justify-center rounded-full" aria-label="Anterior">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => by(1)} className="glass tap flex h-10 w-10 items-center justify-center rounded-full" aria-label="Próxima">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div ref={rail} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-4 pb-2 sm:mx-0 sm:px-0">
        {images.map((src, i) => (
          <button
            key={src}
            onClick={() => setOpen(i)}
            className="group relative aspect-video w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl bg-bg-3 sm:w-[340px] lg:w-[420px]"
          >
            <img src={artSrc(src, "md")!} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
          </button>
        ))}
      </div>
      <AnimatePresence>{open !== null && <Lightbox images={images} start={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </section>
  );
}

function Lightbox({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [dir, setDir] = useState(1);
  const go = (d: number) => {
    setDir(d);
    setI((x) => (x + d + images.length) % images.length);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div className="fixed inset-0 z-[80] flex flex-col bg-black/85 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] lg:px-8 lg:pt-6">
        <span className="text-[14px] tabular-nums text-white/60">
          {i + 1} / {images.length}
        </span>
        <button onClick={onClose} className="glass tap flex h-11 w-11 items-center justify-center rounded-full" aria-label="Fechar">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 lg:px-20">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.img
            key={images[i]}
            src={artSrc(images[i], "lg")!}
            alt=""
            custom={dir}
            variants={{ enter: (d: number) => ({ x: d * 80, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d * -80, opacity: 0 }) }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </AnimatePresence>
        <button onClick={() => go(-1)} className="glass tap absolute left-4 hidden h-12 w-12 items-center justify-center rounded-full lg:flex" aria-label="Anterior">
          <ChevronLeft size={24} />
        </button>
        <button onClick={() => go(1)} className="glass tap absolute right-4 hidden h-12 w-12 items-center justify-center rounded-full lg:flex" aria-label="Próxima">
          <ChevronRight size={24} />
        </button>
      </div>
      <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
        {images.map((src, idx) => (
          <button
            key={src}
            onClick={() => {
              setDir(idx > i ? 1 : -1);
              setI(idx);
            }}
            className={`h-12 w-20 shrink-0 overflow-hidden rounded-lg transition-all ${idx === i ? "ring-2 ring-accent" : "opacity-45 hover:opacity-80"}`}
          >
            <img src={artSrc(src, "md")!} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export function TrailerButton({ videoId, title }: { videoId: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="glass lift tap group flex h-12 items-center gap-2 rounded-full pl-2 pr-5 text-[15px] font-semibold">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 group-hover:scale-110">
          {/* Onda saindo do play no hover */}
          <span className="absolute inset-0 rounded-full bg-white/60 opacity-0 group-hover:animate-ping group-hover:opacity-100" />
          <Play size={15} className="relative ml-0.5 fill-current" />
        </span>
        Trailer
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <button onClick={() => setOpen(false)} className="glass tap absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] flex h-11 w-11 items-center justify-center rounded-full" aria-label="Fechar trailer">
              <X size={20} />
            </button>
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="aspect-video w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&hl=pt-BR&cc_lang_pref=pt`}
                title={`Trailer de ${title}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
