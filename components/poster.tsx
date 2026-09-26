"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Heart } from "lucide-react";
import type { CoverSize } from "@/lib/img";
import { accessFor, formatMinutes, scoreLabel } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Cover } from "./cover";

// Pôster interativo: inclina com o mouse (desktop), mostra nota e revela infos no hover.
export function Poster({
  item,
  morph = false,
  eager = false,
  size = "sm",
  href,
  showBadge = true,
}: {
  item: LiteItem;
  morph?: boolean;
  eager?: boolean;
  size?: CoverSize;
  href?: string;
  showBadge?: boolean;
}) {
  const { myProviders } = useBacklog();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 260, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 260, damping: 20 });
  const glare = useTransform(mx, (x) => `radial-gradient(circle at ${(x + 0.5) * 100}% 20%, rgb(255 255 255 / 0.35), transparent 55%)`);

  const score = scoreLabel(item);
  const access = accessFor(item, myProviders);
  const length = item.kind === "book" ? (item.pages ? `${item.pages} pág.` : null) : formatMinutes(item.minutes, item.kind);

  return (
    <Link
      href={href ?? `/item/${item.id}`}
      className="group relative block outline-none [perspective:800px]"
      aria-label={item.title}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative rounded-2xl transition-[scale,box-shadow] duration-300 group-hover:z-10 group-hover:scale-[1.04] group-hover:shadow-[0_18px_50px_rgb(0_0_0/0.6)] group-focus-visible:ring-2 group-focus-visible:ring-accent group-active:scale-[0.97]"
      >
        <Cover item={item} size={size} eager={eager} morph={morph} rounded="rounded-2xl" />

        {/* Reflexo que acompanha o mouse */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 mix-blend-overlay transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glare }}
        />

        {showBadge && score && (
          <span className="glass absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums">★ {score.value}</span>
        )}
        {item.pinned && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger/90">
            <Heart size={12} className="fill-white text-white" />
          </span>
        )}
        {access.tier === "mine" && <span className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-black/50 group-hover:opacity-0" />}

        {/* Infos no hover (desktop) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-2 rounded-b-2xl bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:hover)]:block">
          <p className="text-[13px] font-semibold leading-tight line-clamp-2">{item.title}</p>
          <p className="mt-1 text-[11px] text-white/65">{[item.year, length].filter(Boolean).join(" · ")}</p>
          {item.kind !== "book" && access.tier !== "unknown" && (
            <p className={`mt-0.5 truncate text-[11px] font-medium ${access.tier === "mine" ? "text-success" : "text-white/80"}`}>{access.label}</p>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
