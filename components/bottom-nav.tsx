"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dices, LayoutGrid, Plus, ListChecks, Settings2 } from "lucide-react";

const TABS = [
  { href: "/", label: "E agora?", icon: Dices },
  { href: "/lista", label: "Lista", icon: LayoutGrid },
  { href: "/adicionar", label: "Adicionar", icon: Plus, primary: true },
  { href: "/revisar", label: "Revisar", icon: ListChecks },
  { href: "/ajustes", label: "Ajustes", icon: Settings2 },
];

export function BottomNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2">
        {TABS.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-text" : "text-muted"
                }`}
              >
                {primary ? (
                  <span className="-mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg shadow-accent/20">
                    <Icon size={20} strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                )}
                {!primary && label}
                {href === "/revisar" && reviewCount > 0 && (
                  <span className="absolute right-[22%] top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">
                    {reviewCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
