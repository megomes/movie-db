"use client";

// Pílula compacta de filtro: ativa = branca com texto preto; inativa = contorno sutil
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150 ${
        active ? "bg-text text-bg" : "border border-line text-text-2"
      }`}
    >
      {children}
    </button>
  );
}
