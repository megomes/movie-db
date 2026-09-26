/* eslint-disable @next/next/no-img-element -- capas vêm de CDNs externos (TMDB/IGDB/Google), sem otimização */
import type { Kind } from "@/lib/db/schema";
import { KIND_META } from "@/lib/kinds";

export function Cover({
  src,
  title,
  kind,
  className = "",
  eager = false,
}: {
  src: string | null | undefined;
  title: string;
  kind: Kind;
  className?: string;
  eager?: boolean;
}) {
  const color = KIND_META[kind].color;
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line ${className}`}
      style={{ backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${color} 28%, transparent), transparent 70%)` }}
    >
      {src ? (
        <img
          // key força um <img> novo por capa, para não exibir a anterior enquanto a nova carrega
          key={src}
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-end p-2.5">
          <span className="font-display text-sm font-semibold leading-tight text-text/90 line-clamp-4">{title}</span>
        </div>
      )}
    </div>
  );
}
