"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Heart } from "lucide-react";
import type { CoverSize } from "@/lib/img";
import { accessFor, formatMinutes, KIND_META, scoreLabel } from "@/lib/kinds";
import type { LiteItem } from "@/lib/queries";
import { useBacklog } from "./backlog-context";
import { Cover } from "./cover";
import { KIND_ICONS } from "./kind-icon";

// Pôster interativo: inclina com o mouse (desktop), mostra nota e revela infos no hover.
export function Poster({
  item,
  morph = false,
  eager = false,
  size = "sm",
  href,
  showBadge = true,
  kindIcon = false,
}: {
  item: LiteItem;
  morph?: boolean;
  eager?: boolean;
  size?: CoverSize;
  href?: string;
  showBadge?: boolean;
  /** Ícone do tipo no selo (listas que misturam filmes, jogos, livros…) */
  kindIcon?: boolean;
}) {
  const { myProviders } = useBacklog();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 260, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 260, damping: 20 });
  const glare = useTransform(mx, (x) => `radial-gradient(circle at ${(x + 0.5) * 100}% 20%, rgb(255 255 255 / 0.16), transparent 55%)`);

  const score = scoreLabel(item);
  const access = accessFor(item, myProviders);
  const length = item.kind === "book" ? (item.pages ? `${item.pages} pág.` : null) : formatMinutes(item.minutes, item.kind);

  return (
    <Link
      href={href ?? `/item/${item.id}`}
      className="group relative block outline-none hover:z-10"
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
        // Sem preserve-3d: o cartão inclina como uma peça só (evita as camadas "brigarem" e piscarem).
        // Perspectiva dentro do próprio transform: com "perspective" no pai, o Firefox erra a origem
        // dentro das prateleiras com rolagem horizontal e o pôster "dá zoom" e pisca no hover.
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 800 }}
        className="relative rounded-2xl transition-[scale,box-shadow] duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_18px_50px_rgb(0_0_0/0.6)] group-focus-visible:ring-2 group-focus-visible:ring-accent group-active:scale-[0.97]"
      >
        {/* Recorte por clip-path: com a inclinação, o Firefox deixa o overflow-hidden "vazar" nos cantos arredondados.
            Dentro da peça inclinada nada de backdrop-filter nem mix-blend: no Firefox isso faz piscar. */}
        <div className="relative overflow-hidden rounded-2xl [clip-path:inset(0_round_1rem)]">
          <Cover item={item} size={size} eager={eager} morph={morph} rounded="rounded-2xl" />

          {/* Reflexo que acompanha o mouse */}
          <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glare }} />

          {showBadge && (score || kindIcon) && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-white/10">
              {kindIcon && <KindIcon kind={item.kind} />}
              {score && `★ ${score.value}`}
            </span>
          )}
          {item.pinned && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger/90">
              <Heart size={12} className="fill-white text-white" />
            </span>
          )}
          {access.tier === "mine" && <span className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-black/50 group-hover:opacity-0" />}

          {/* Infos no hover (desktop): degradê cobre o pôster inteiro; só o texto desliza */}
          <div className="pointer-events-none absolute inset-0 hidden flex-col justify-end bg-[linear-gradient(to_top,rgb(0_0_0/0.96)_0%,rgb(0_0_0/0.82)_32%,rgb(0_0_0/0.35)_62%,transparent_85%)] p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [@media(hover:hover)]:flex">
            <div className="translate-y-2 transition-transform duration-300 group-hover:translate-y-0">
              <p className="text-[13px] font-semibold leading-tight line-clamp-2">{item.title}</p>
              <p className="mt-1 text-[11px] text-white/65">{[item.year, length].filter(Boolean).join(" · ")}</p>
              {item.kind !== "book" && access.tier !== "unknown" && (
                <p className={`mt-0.5 truncate text-[11px] font-medium ${access.tier === "mine" ? "text-success" : "text-white/80"}`}>{access.label}</p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function KindIcon({ kind }: { kind: LiteItem["kind"] }) {
  const Icon = KIND_ICONS[kind];
  return <Icon size={12} strokeWidth={2.4} className="-ml-0.5 text-white/90" aria-label={KIND_META[kind].label} />;
}
