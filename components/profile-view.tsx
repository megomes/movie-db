/* eslint-disable @next/next/no-img-element -- avatares do Google */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronRight, ListChecks, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { KIND_META, KINDS } from "@/lib/kinds";
import { useBacklog } from "./backlog-context";

export function ProfileHeader() {
  const router = useRouter();
  const { me, items, reviewCount, people } = useBacklog();
  const counts = Object.fromEntries(KINDS.map((k) => [k, items.filter((i) => i.kind === k).length]));
  // Horas estimadas de backlog (filmes, séries e jogos) + livros em páginas
  const hours = Math.round(items.filter((i) => i.kind !== "book").reduce((s, i) => s + (i.minutes ?? 0), 0) / 60);
  const pages = items.reduce((s, i) => s + (i.kind === "book" ? (i.pages ?? 0) : 0), 0);
  const others = people.filter((p) => p.userId !== me.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[26px] ring-2 ring-accent/60 lg:h-24 lg:w-24">
          {me.image ? <img src={me.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="flex h-full items-center justify-center bg-bg-3 text-3xl">{me.name?.[0]}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight lg:text-[40px]">{me.name}</h1>
          <p className="truncate text-[14px] text-text-2">{me.email}</p>
        </div>
        <button
          onClick={async () => {
            await authClient.signOut();
            router.replace("/auth/sign-in");
            router.refresh();
          }}
          className="glass tap flex h-11 items-center gap-2 rounded-full px-4 text-[14px]"
        >
          <LogOut size={16} /> <span className="hidden sm:inline">Sair</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {KINDS.map((k, i) => (
          <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl px-4 py-3.5">
            <p className="text-[24px] font-bold tabular-nums leading-none">{counts[k]}</p>
            <p className="mt-1.5 text-[12px] text-text-2">{KIND_META[k].plural}</p>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="btn-accent col-span-2 rounded-2xl px-4 py-3.5 sm:col-span-2">
          <p className="text-[24px] font-bold tabular-nums leading-none">
            {hours.toLocaleString("pt-BR")}h <span className="text-[14px] font-medium opacity-80">+ {pages.toLocaleString("pt-BR")} pág.</span>
          </p>
          <p className="mt-1.5 text-[12px] text-white/80">de coisas boas esperando por você</p>
        </motion.div>
      </div>

      {(reviewCount > 0 || others.length > 0) && (
        <div className="glass divide-y divide-white/10 overflow-hidden rounded-3xl">
          {reviewCount > 0 && (
            <Link href="/revisar" className="flex items-center gap-4 px-4 py-4 hover:bg-white/5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/15 text-danger">
                <ListChecks size={21} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Revisar importados</span>
                <span className="block text-[13px] text-text-2">{reviewCount} itens em que não tive certeza</span>
              </span>
              <ChevronRight size={18} className="text-text-3" />
            </Link>
          )}
          {others.map((p) => (
            <Link key={p.userId} href={`/pessoa/${p.userId}`} className="flex items-center gap-4 px-4 py-4 hover:bg-white/5">
              <span className="h-11 w-11 overflow-hidden rounded-2xl bg-bg-3">
                {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Backlog de {p.name?.split(" ")[0] ?? p.email}</span>
                <span className="block text-[13px] text-text-2">Espiar e trazer ideias pro seu</span>
              </span>
              <ChevronRight size={18} className="text-text-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
