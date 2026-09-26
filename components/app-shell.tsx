/* eslint-disable @next/next/no-img-element -- avatar do Google e ícone estático */
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Dices, House, LayoutGrid, ListChecks, LogOut, Plus, Search, Settings2, Users } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { useBacklog } from "./backlog-context";
import { DrawOverlay } from "./draw-overlay";
import { SearchPalette } from "./search-palette";

const SECTIONS = [
  { href: "/", label: "Início", match: (p: string) => p === "/" },
  { href: "/lista?k=movie", label: "Filmes", match: (p: string, k: string | null) => p === "/lista" && k === "movie" },
  { href: "/lista?k=series", label: "Séries", match: (p: string, k: string | null) => p === "/lista" && k === "series" },
  { href: "/lista?k=game", label: "Jogos", match: (p: string, k: string | null) => p === "/lista" && k === "game" },
  { href: "/lista?k=book", label: "Livros", match: (p: string, k: string | null) => p === "/lista" && k === "book" },
  { href: "/lista", label: "Tudo", match: (p: string, k: string | null) => p === "/lista" && !k },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="ambient pointer-events-none fixed inset-x-0 top-0 -z-10 h-[90vh]" />
      <TopBar />
      <main className="min-h-dvh pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16">{children}</main>
      <Dock />
      <DrawOverlay />
      <SearchPalette />
    </>
  );
}

function useScrolled(threshold = 24) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > threshold);
    // Esconde ao rolar para baixo, mostra ao subir
    setHidden(y > 200 && y > last.current + 4);
    if (y < last.current - 4 || y < 200) setHidden(false);
    last.current = y;
  });
  return { scrolled, hidden };
}

function TopBar() {
  const pathname = usePathname();
  const k = useSearchParams().get("k");
  const { scrolled } = useScrolled();
  const { setDrawOpen, setSearchOpen } = useBacklog();

  return (
    <header className="fixed inset-x-0 top-0 z-40 hidden px-6 pt-4 lg:block">
      <div
        className={`mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 rounded-full px-3 transition-all duration-500 ${
          scrolled ? "glass" : "border border-transparent"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5 pl-1">
          <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-[10px]" />
          <span className="text-[17px] font-semibold tracking-tight">Backlog</span>
        </Link>

        <nav className={`flex items-center gap-1 rounded-full p-1 ${scrolled ? "" : "glass"}`}>
          {SECTIONS.map((s) => {
            const active = s.match(pathname, k);
            return (
              <Link key={s.href} href={s.href} className="relative rounded-full px-4 py-1.5 text-[14px] font-medium">
                {active && (
                  <motion.span layoutId="top-pill" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className={`relative transition-colors ${active ? "text-white" : "text-white/70 hover:text-white"}`}>{s.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="glass tap flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] text-white/70 hover:text-white"
          >
            <Search size={16} /> Buscar <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">Ctrl K</kbd>
          </button>
          <button
            onClick={() => setDrawOpen(true)}
            className="btn-accent group tap flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold"
          >
            <Dices size={18} className="transition-transform duration-500 group-hover:rotate-[200deg]" /> Sortear
          </button>
          <Link href="/adicionar" className="glass tap flex h-10 w-10 items-center justify-center rounded-full" aria-label="Adicionar">
            <Plus size={19} />
          </Link>
          <AvatarMenu />
        </div>
      </div>
    </header>
  );
}

function AvatarMenu() {
  const router = useRouter();
  const { me, people, reviewCount } = useBacklog();
  const [open, setOpen] = useState(false);
  const others = people.filter((p) => p.userId !== me.id);
  const row = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] hover:bg-white/10";
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative block h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/15" aria-label="Menu da conta">
        {me.image ? <img src={me.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="flex h-full items-center justify-center bg-bg-3">{me.name?.[0]}</span>}
        {reviewCount > 0 && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-bg" />}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Fechar" />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="glass-strong absolute right-0 top-12 z-50 w-64 origin-top-right rounded-2xl p-1.5"
              onClick={() => setOpen(false)}
            >
              <div className="px-3 pb-2 pt-2">
                <p className="truncate text-[14px] font-semibold">{me.name}</p>
                <p className="truncate text-[12px] text-text-2">{me.email}</p>
              </div>
              <Link href="/revisar" className={row}>
                <ListChecks size={17} className="text-text-2" /> Revisar
                {reviewCount > 0 && <span className="ml-auto rounded-full bg-danger px-2 text-[11px] font-semibold leading-5">{reviewCount}</span>}
              </Link>
              {others.map((p) => (
                <Link key={p.userId} href={`/pessoa/${p.userId}`} className={row}>
                  <Users size={17} className="text-text-2" /> Backlog de {p.name?.split(" ")[0] ?? p.email}
                </Link>
              ))}
              <Link href="/ajustes" className={row}>
                <Settings2 size={17} className="text-text-2" /> Perfil e streamings
              </Link>
              <button
                className={`${row} w-full text-left`}
                onClick={async () => {
                  await authClient.signOut();
                  router.replace("/auth/sign-in");
                  router.refresh();
                }}
              >
                <LogOut size={17} className="text-text-2" /> Sair
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const DOCK = [
  { href: "/", label: "Início", icon: House },
  { href: "/lista", label: "Lista", icon: LayoutGrid },
  { href: "draw", label: "Sortear", icon: Dices },
  { href: "/adicionar", label: "Adicionar", icon: Plus },
  { href: "/ajustes", label: "Perfil", icon: null },
];

function Dock() {
  const pathname = usePathname();
  const { hidden } = useScrolled();
  const { me, reviewCount, setDrawOpen } = useBacklog();
  const [spin, setSpin] = useState(0);

  return (
    <motion.nav
      animate={{ y: hidden ? 120 : 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:hidden"
    >
      <ul className="glass flex items-center gap-1 rounded-full p-1.5">
        {DOCK.map(({ href, label, icon: Icon }) => {
          if (href === "draw")
            return (
              <li key={href}>
                <button
                  onClick={() => {
                    setSpin((s) => s + 1);
                    setDrawOpen(true);
                  }}
                  aria-label={label}
                  className="btn-accent mx-1 flex h-12 w-12 items-center justify-center rounded-full active:scale-95"
                >
                  <motion.span animate={{ rotate: spin * 360 }} transition={{ type: "spring", stiffness: 120, damping: 14 }}>
                    <Dices size={22} strokeWidth={2.2} />
                  </motion.span>
                </button>
              </li>
            );
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/ajustes" && pathname.startsWith("/revisar"));
          return (
            <li key={href}>
              <Link href={href} aria-label={label} className="relative flex h-12 w-12 items-center justify-center rounded-full">
                {active && (
                  <motion.span layoutId="dock-blob" className="absolute inset-0 rounded-full bg-accent/20" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                {Icon ? (
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.8} className={`relative transition-colors ${active ? "text-accent-2" : "text-white/60"}`} />
                ) : (
                  <span className={`relative block h-7 w-7 overflow-hidden rounded-full ring-2 ${active ? "ring-accent" : "ring-white/20"}`}>
                    {me.image ? <img src={me.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="flex h-full items-center justify-center bg-bg-3 text-xs">{me.name?.[0]}</span>}
                  </span>
                )}
                {href === "/ajustes" && reviewCount > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-black/50" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
