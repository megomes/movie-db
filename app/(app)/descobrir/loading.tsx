import { GUTTER } from "@/components/rail";

// As listas vêm do IGDB (cache de 12h): a primeira visita pode levar uns segundos
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] pb-10 pt-[calc(env(safe-area-inset-top)+20px)] lg:pt-28">
      <div className={GUTTER}>
        <div className="mb-3 h-4 w-24 rounded-full bg-white/8" />
        <h1 className="text-[34px] font-bold leading-none tracking-tight lg:text-[52px]">Descobrir</h1>
        <p className="mt-2 text-[15px] text-text-3">Buscando a lista no IGDB…</p>
      </div>
      <div className={`mt-20 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-x-5 2xl:grid-cols-8 ${GUTTER}`}>
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="shimmer aspect-[2/3] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
