/* eslint-disable @next/next/no-img-element -- capas vêm de CDNs externos (TMDB/IGDB/Google), sem otimização */
import type { Kind } from "@/lib/db/schema";

// Pôster 2:3 só com a arte. Sem capa, mostra o título sobre fundo escuro.
export function Cover({
  src,
  title,
  className = "",
  eager = false,
  rounded = "rounded-lg",
}: {
  src: string | null | undefined;
  title: string;
  kind?: Kind;
  className?: string;
  eager?: boolean;
  rounded?: string;
}) {
  return (
    <div className={`relative aspect-[2/3] overflow-hidden bg-bg-3 ${rounded} ${className}`}>
      {src ? (
        <img
          // key força um <img> novo por capa, para não exibir a anterior enquanto a nova carrega
          key={src}
          src={src}
          alt={title}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="fade-in absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-end bg-gradient-to-br from-bg-3 to-bg-2 p-2.5">
          <span className="text-[13px] font-semibold leading-tight text-text/85 line-clamp-4">{title}</span>
        </div>
      )}
    </div>
  );
}
