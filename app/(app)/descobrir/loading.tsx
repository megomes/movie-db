import { DiscoverGridSkeleton } from "@/components/discover-skeleton";
import { GUTTER } from "@/components/rail";

// As listas vêm do IGDB (cache de 12h): a primeira visita pode levar uns segundos
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] pb-10 pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28">
      <div className={GUTTER}>
        <div className="mb-3 h-4 w-24 rounded-full bg-white/8" />
        <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">Descobrir</h1>
        <p className="mt-2 text-[15px] text-text-3">Carregando a lista…</p>
      </div>
      <DiscoverGridSkeleton className="mt-20" />
    </div>
  );
}
