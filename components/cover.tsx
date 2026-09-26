/* eslint-disable @next/next/no-img-element -- capas vêm de CDNs externos (TMDB/IGDB/Google), sem otimização */
"use client";

import { ViewTransition, useEffect, useRef, useState } from "react";
import type { Kind } from "@/lib/db/schema";
import { coverSrc, type CoverSize } from "@/lib/img";
import { KIND_META } from "@/lib/kinds";

export type CoverData = {
  id: string;
  title: string;
  kind: Kind;
  coverUrl: string | null;
  coverColor?: string | null;
  coverBlur?: string | null;
};

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// Pôster 2:3. Mostra na hora a cor/borrão da capa e faz fade quando a imagem chega.
// Sem capa, gera um pôster tipográfico no lugar de um buraco.
export function Cover({
  item,
  size = "sm",
  className = "",
  rounded = "rounded-lg",
  eager = false,
  morph = false,
}: {
  item: CoverData;
  size?: CoverSize;
  className?: string;
  rounded?: string;
  eager?: boolean;
  morph?: boolean;
}) {
  const src = coverSrc(item.coverUrl, size);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Imagem já no cache dispara onLoad antes da hidratação
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth) setLoaded(true);
  }, [src]);

  const h = hue(item.title);
  const body = (
    <div
      className={`relative aspect-[2/3] overflow-hidden ${rounded} ${className}`}
      style={{
        backgroundColor: item.coverColor ?? "#1a1a1a",
        backgroundImage: item.coverBlur ? `url(${item.coverBlur})` : undefined,
        backgroundSize: "cover",
      }}
    >
      {src ? (
        <>
          {!loaded && !item.coverBlur && <div className="shimmer absolute inset-0" />}
          <img
            ref={ref}
            key={src}
            src={src}
            alt={item.title}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-[opacity,filter] duration-500 ${loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"}`}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 flex flex-col justify-between p-[9%]"
          style={{ background: `linear-gradient(160deg, hsl(${h} 42% 26%), hsl(${(h + 50) % 360} 38% 9%))` }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">{KIND_META[item.kind].label}</span>
          <span className="text-[clamp(13px,1.1vw+8px,20px)] font-bold leading-[1.05] tracking-tight text-white line-clamp-5">{item.title}</span>
        </div>
      )}
    </div>
  );

  return morph ? (
    <ViewTransition name={`cover-${item.id}`} share="morph" default="none">
      {body}
    </ViewTransition>
  ) : (
    body
  );
}
