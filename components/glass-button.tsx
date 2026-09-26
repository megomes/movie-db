import Link from "next/link";

// Botão circular translúcido para usar sobre a arte (voltar, buscar, perfil…)
export function GlassButton({
  href,
  onClick,
  label,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const cls = "tap flex h-10 w-10 items-center justify-center rounded-full bg-glass text-white backdrop-blur-md";
  if (href)
    return (
      <Link href={href} className={cls} aria-label={label}>
        {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label}>
      {children}
    </button>
  );
}
