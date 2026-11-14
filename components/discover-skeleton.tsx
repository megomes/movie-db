import { GUTTER } from "./rail";

// Grade de capas "carregando" do Descobrir (rota inteira e troca de lista)
export function DiscoverGridSkeleton({ className = "" }: { className?: string }) {
  return (
    <div data-skeleton aria-busy="true" className={`grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-7 2xl:grid-cols-8 ${GUTTER} ${className}`}>
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className="rise" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
          <div className="shimmer aspect-[2/3] rounded-2xl" />
          <div className="shimmer mt-2 h-3 w-3/4 rounded-full" />
          <div className="shimmer mt-1.5 h-2.5 w-1/2 rounded-full opacity-60" />
        </div>
      ))}
    </div>
  );
}
