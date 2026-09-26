"use client";

export function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition-colors ${
        active ? "bg-text text-bg ring-text" : "bg-surface text-text/80 ring-line hover:bg-surface-2"
      }`}
      style={active && color ? { background: color, color: "#0c0b10", boxShadow: `0 0 0 1px ${color}` } : undefined}
    >
      {children}
    </button>
  );
}
