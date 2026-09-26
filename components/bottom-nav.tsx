"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, ListChecks, Plus, User } from "lucide-react";

const TABS = [
  { href: "/", label: "Início", icon: House },
  { href: "/lista", label: "Lista", icon: LayoutGrid },
  { href: "/adicionar", label: "Adicionar", icon: Plus },
  { href: "/revisar", label: "Revisar", icon: ListChecks },
  { href: "/ajustes", label: "Ajustes", icon: User },
];

export function BottomNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-nav pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-xl items-center justify-around px-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-14 w-14 items-center justify-center transition-opacity duration-150 ${active ? "opacity-100" : "opacity-50"}`}
              >
                <Icon size={22} strokeWidth={active ? 2.3 : 1.9} />
                {href === "/revisar" && reviewCount > 0 && (
                  <span className="absolute right-3 top-3.5 h-2 w-2 rounded-full bg-danger" aria-label={`${reviewCount} para revisar`} />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
