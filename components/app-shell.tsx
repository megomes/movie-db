/* eslint-disable @next/next/no-img-element -- avatar do Google e ícone estático */
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { BookOpen, Clapperboard, Dices, Eye, Gamepad2, HeartHandshake, House, LayoutGrid, ListChecks, LogOut, Plus, Search, Settings2, Tv, Users } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { useBacklog } from "./backlog-context";
import { DrawOverlay } from "./draw-overlay";
import { PeopleSwitch } from "./people-switch";
import { SearchPalette } from "./search-palette";

// Só mostra na navegação os tipos que têm algo no backlog
function useKindsWithItems() {
  const { items } = useBacklog();
  const kinds = new Set<string>(items.map((i) => i.kind));
  return <T extends { kind?: string }>(list: T[]) => list.filter((s) => !s.kind || kinds.has(s.kind));
}

const SECTIONS: { href: string; kind?: string; label: string; match: (p: string, k: string | null) => boolean }[] = [
  { href: "/", label: "Início", match: (p: string) => p === "/" },
  { href: "/lista?k=movie", kind: "movie", label: "Filmes", match: (p: string, k: string | null) => p === "/lista" && k === "movie" },
  { href: "/lista?k=series", kind: "series", label: "Séries", match: (p: string, k: string | null) => p === "/lista" && k === "series" },
  { href: "/lista?k=game", kind: "game", label: "Jogos", match: (p: string, k: string | null) => p === "/lista" && k === "game" },
  { href: "/lista?k=book", kind: "book", label: "Livros", match: (p: string, k: string | null) => p === "/lista" && k === "book" },
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
  const { items, setDrawOpen, setSearchOpen } = useBacklog();
  const withItems = useKindsWithItems();

  return (
    <header className="fixed inset-x-0 top-0 z-40 hidden px-6 pt-4 lg:block">
      <div
        className={`glass-nav mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 rounded-full px-3 transition-shadow duration-500 ${scrolled ? "shadow-2xl" : ""}`}
      >
        <Link href="/" className="flex items-center gap-2.5 pl-1">
          <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-[10px]" />
          <span className="text-[17px] font-semibold tracking-tight">Backlog</span>
        </Link>

        <nav className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
          {withItems(SECTIONS).map((s) => {
            const active = s.match(pathname, k);
            return (
              <Link
                key={s.href}
                href={s.href}
                onClick={(e) => {
                  // Já na Lista: troca a divisão só no cliente (instantâneo, sem ir ao servidor nem animar a grade toda)
                  if (pathname === "/lista" && s.href.startsWith("/lista")) {
                    e.preventDefault();
                    window.history.pushState(null, "", s.href);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="relative rounded-full px-4 py-1.5 text-[14px] font-medium"
              >
                {active && (
                  <motion.span layoutId="top-pill" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className={`relative transition-colors ${active ? "text-white" : "text-white/70 hover:text-white"}`}>{s.label}</span>
              </Link>
            );
          })}
          <span className="mx-1 h-5 w-px bg-white/15" />
          <PeopleSwitch />
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="tap flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-3.5 text-[13px] text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Search size={16} /> Buscar <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">Ctrl K</kbd>
          </button>
          {items.length > 0 && (
            <button
              onClick={() => setDrawOpen(true)}
              className="btn-accent group tap flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold"
            >
              <Dices size={18} className="transition-transform duration-500 group-hover:rotate-[200deg]" /> Sortear
            </button>
          )}
          <Link href="/adicionar" className="tap flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10" aria-label="Adicionar">
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

const DOCK: { href: string; kind?: string; label: string; icon: typeof House; match: (p: string, k: string | null) => boolean }[] = [
  { href: "/", label: "Início", icon: House, match: (p: string) => p === "/" },
  { href: "/lista?k=movie", kind: "movie", label: "Filmes", icon: Clapperboard, match: (p: string, k: string | null) => p === "/lista" && k === "movie" },
  { href: "/lista?k=series", kind: "series", label: "Séries", icon: Tv, match: (p: string, k: string | null) => p === "/lista" && k === "series" },
  { href: "/lista?k=game", kind: "game", label: "Jogos", icon: Gamepad2, match: (p: string, k: string | null) => p === "/lista" && k === "game" },
  { href: "/lista?k=book", kind: "book", label: "Livros", icon: BookOpen, match: (p: string, k: string | null) => p === "/lista" && k === "book" },
];

// Celular: doca espelhando a barra do topo + menu no avatar (sorteio fica no menu e na home)
function Dock() {
  const pathname = usePathname();
  const k = useSearchParams().get("k");
  const { hidden } = useScrolled();
  const { me, reviewCount } = useBacklog();
  const withItems = useKindsWithItems();
  const [menu, setMenu] = useState(false);
  const menuActive = ["/ajustes", "/revisar", "/juntos", ...(withItems(DOCK).length < DOCK.length ? [] : ["/adicionar"])].some((p) => pathname.startsWith(p)) || pathname.startsWith("/pessoa");

  return (
    <>
      <motion.nav
        animate={{ y: hidden ? 120 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:hidden"
      >
        <ul className="glass-nav flex w-full max-w-md items-center rounded-full p-1">
          {withItems(DOCK).map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname, k);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-label={label}
                  onClick={(e) => {
                    if (pathname === "/lista" && href.startsWith("/lista")) {
                      e.preventDefault();
                      window.history.pushState(null, "", href);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className="relative flex h-12 w-full items-center justify-center rounded-full"
                >
                  {active && <motion.span layoutId="dock-blob" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                  <Icon size={21} strokeWidth={active ? 2.3 : 1.8} className={`relative transition-colors ${active ? "text-white" : "text-white/60"}`} />
                </Link>
              </li>
            );
          })}
          {/* Sobrou espaço (poucos tipos no backlog): atalho pra adicionar */}
          {withItems(DOCK).length < DOCK.length && (
            <li className="flex-1">
              <Link href="/adicionar" aria-label="Adicionar" className="relative flex h-12 w-full items-center justify-center rounded-full">
                {pathname === "/adicionar" && <motion.span layoutId="dock-blob" className="btn-accent absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                <Plus size={22} strokeWidth={2.2} className={`relative ${pathname === "/adicionar" ? "text-white" : "text-white/60"}`} />
              </Link>
            </li>
          )}
          <li className="mx-1 h-6 w-px bg-white/15" />
          <li>
            <button onClick={() => setMenu(true)} aria-label="Menu" className="relative flex h-12 w-12 items-center justify-center">
              <span className={`block h-8 w-8 overflow-hidden rounded-full ring-2 ${menuActive ? "ring-accent" : "ring-white/25"}`}>
                {me.image ? <img src={me.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="flex h-full items-center justify-center bg-bg-3 text-xs">{me.name?.[0]}</span>}
              </span>
              {reviewCount > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-black/60" />}
            </button>
          </li>
        </ul>

      </motion.nav>
      <MobileMenu open={menu} onClose={() => setMenu(false)} />
    </>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { me, items, shared, reviewCount, setSearchOpen, setDrawOpen } = useBacklog();
  const row = "flex items-center gap-4 rounded-2xl px-3 py-3 text-[16px] active:bg-white/10";
  const icon = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]";
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Fechar" />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 80 && onClose()}
            className="glass-strong relative w-full rounded-t-[32px] p-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
            onClick={(e) => (e.target as HTMLElement).closest("a,button[data-close]") && onClose()}
          >
            <div className="mx-auto mb-3 mt-1 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="flex items-center gap-3 px-3 pb-3">
              <span className="h-12 w-12 overflow-hidden rounded-2xl bg-bg-3">
                {me.image && <img src={me.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold">{me.name}</span>
                <span className="block truncate text-[13px] text-white/50">{me.email}</span>
              </span>
            </div>
            <div className={`grid ${items.length ? "grid-cols-3" : "grid-cols-2"} gap-2 px-1 pb-2`}>
              <button data-close onClick={() => setSearchOpen(true)} className="glass flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-[13px] font-semibold">
                <Search size={20} /> Buscar
              </button>
              {items.length > 0 && (
                <button data-close onClick={() => setDrawOpen(true)} className="btn-accent flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-[13px] font-semibold">
                  <Dices size={21} /> Sortear
                </button>
              )}
              <Link href="/adicionar" className={`${items.length ? "glass" : "btn-accent"} flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-[13px] font-semibold`}>
                <Plus size={21} /> Adicionar
              </Link>
            </div>
            {shared.some((p) => p.count) && (
              <Link href="/juntos" className={row}>
                <span className={icon}>
                  <HeartHandshake size={19} />
                </span>
                <span className="flex-1">Juntos</span>
                <span className="text-[13px] text-white/45">{shared.reduce((s, p) => s + p.count, 0)} em comum</span>
              </Link>
            )}
            {shared.map((p) => (
              <Link key={p.userId} href={`/pessoa/${p.userId}`} className={row}>
                <span className={`${icon} overflow-hidden`}>{p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <Eye size={19} />}</span>
                <span className="flex-1">Espiar {p.name?.split(" ")[0]}</span>
                <span className="text-[13px] text-white/45">{p.total} itens</span>
              </Link>
            ))}
            {reviewCount > 0 && (
              <Link href="/revisar" className={row}>
                <span className={`${icon} text-danger`}>
                  <ListChecks size={19} />
                </span>
                <span className="flex-1">Revisar</span>
                <span className="rounded-full bg-danger px-2 text-[12px] font-semibold leading-5">{reviewCount}</span>
              </Link>
            )}
            {items.length > 0 && (
              <Link href="/lista" className={row}>
                <span className={icon}>
                  <LayoutGrid size={19} />
                </span>
                <span className="flex-1">Tudo</span>
              </Link>
            )}
            <Link href="/ajustes" className={row}>
              <span className={icon}>
                <Settings2 size={19} />
              </span>
              <span className="flex-1">Perfil, tags e streamings</span>
            </Link>
            <button
              data-close
              className={`${row} w-full text-left text-white/70`}
              onClick={async () => {
                await authClient.signOut();
                router.replace("/auth/sign-in");
                router.refresh();
              }}
            >
              <span className={icon}>
                <LogOut size={19} />
              </span>
              Sair
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
