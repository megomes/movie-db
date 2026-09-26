/* eslint-disable @next/next/no-img-element -- avatares do Google */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Eye, HeartHandshake } from "lucide-react";
import { useBacklog } from "./backlog-context";

export function Avatar({ src, name, size = 28, ring = "ring-black/60" }: { src: string | null; name: string | null; size?: number; ring?: string }) {
  return (
    <span className={`block shrink-0 overflow-hidden rounded-full bg-bg-3 ring-2 ${ring}`} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex h-full items-center justify-center text-[11px] font-semibold">{name?.[0] ?? "?"}</span>
      )}
    </span>
  );
}

// "Eu ↔ Ana": avatares sobrepostos que abrem o backlog da outra pessoa ou o que vocês têm em comum
export function PeopleSwitch({ align = "center" }: { align?: "center" | "right" }) {
  const { me, shared } = useBacklog();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (!shared.length) return null;
  const active = pathname.startsWith("/pessoa");
  const common = shared.reduce((s, p) => s + p.count, 0);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`group flex h-9 items-center gap-2 rounded-full pl-1 pr-3 text-[14px] font-medium transition-colors ${active ? "btn-accent" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
      >
        <span className="flex -space-x-2.5">
          <motion.span whileHover={{ x: -2 }}>
            <Avatar src={me.image} name={me.name} size={26} />
          </motion.span>
          {shared.slice(0, 2).map((p) => (
            <motion.span key={p.userId} className="transition-transform duration-300 group-hover:translate-x-1">
              <Avatar src={p.image} name={p.name} size={26} />
            </motion.span>
          ))}
        </span>
        <span className="lg:hidden xl:inline">{shared.length === 1 ? shared[0].name?.split(" ")[0] : "Pessoas"}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Fechar" />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 460, damping: 34 }}
              className={`glass-strong absolute top-12 z-50 w-80 rounded-3xl p-2 ${align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"}`}
              onClick={() => setOpen(false)}
            >
              <Link href="/juntos" className="flex items-center gap-3 rounded-2xl p-3 hover:bg-white/10">
                <span className="relative flex h-12 w-16 shrink-0 items-center">
                  <span className="absolute left-0">
                    <Avatar src={me.image} name={me.name} size={40} ring="ring-[#0e131d]" />
                  </span>
                  <span className="absolute left-6">
                    <Avatar src={shared[0].image} name={shared[0].name} size={40} ring="ring-[#0e131d]" />
                  </span>
                  <span className="btn-accent absolute -bottom-0.5 left-[22px] flex h-5 w-5 items-center justify-center rounded-full">
                    <HeartHandshake size={11} />
                  </span>
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold">Juntos</span>
                  <span className="block text-[12px] text-white/55">{common ? `${common} em comum pra ver a dois` : "Nada em comum ainda"}</span>
                </span>
              </Link>
              {shared.map((p) => (
                <Link key={p.userId} href={`/pessoa/${p.userId}`} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-white/10">
                  <span className="relative flex w-16 shrink-0 justify-center">
                    <Avatar src={p.image} name={p.name} size={40} ring="ring-[#0e131d]" />
                    <span className="glass absolute -bottom-1 right-2 flex h-5 w-5 items-center justify-center rounded-full">
                      <Eye size={11} />
                    </span>
                  </span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold">Espiar {p.name?.split(" ")[0]}</span>
                    <span className="block text-[12px] text-white/55">
                      {p.total} {p.total === 1 ? "item" : "itens"} no backlog · só leitura
                    </span>
                  </span>
                </Link>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
