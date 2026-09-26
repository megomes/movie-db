"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { KINDS } from "@/lib/kinds";
import { KIND_ICONS } from "./kind-icon";

// Rolo do caça-níquel: + → filme → série → jogo → livro (a busca aceita qualquer um)
function Slot({ size, className }: { size: number; className: string }) {
  return (
    <span className="relative flex overflow-hidden" style={{ width: size, height: size }}>
      <span className={`absolute left-0 top-0 flex flex-col ${className}`}>
        {[Plus, ...KINDS.map((k) => KIND_ICONS[k])].map((Icon, i) => (
          <span key={i} className="flex items-center justify-center" style={{ width: size, height: size }}>
            <Icon size={i ? size * 0.55 : size * 0.68} strokeWidth={i ? 2.2 : 2.8} />
          </span>
        ))}
      </span>
    </span>
  );
}

// Desktop: pílula com borda em degradê girando; no hover o ícone gira pelos tipos
export function AddPill() {
  return (
    <Link href="/adicionar" className="add-glow lift group relative flex h-10 items-center gap-1.5 rounded-full pl-1.5 pr-4 text-[14px] font-semibold" aria-label="Adicionar">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
        <Slot size={28} className="slot-hover" />
      </span>
      Adicionar
    </Link>
  );
}

// Celular: botão flutuante no meio da doca, com anel colorido; de tempos em tempos o ícone gira pelos tipos
export function AddFab({ active }: { active: boolean }) {
  return (
    <motion.div whileTap={{ scale: 0.86 }} className="relative -mt-8">
      <Link
        href="/adicionar"
        aria-label="Adicionar"
        className={`add-glow add-fab flex h-14 w-14 items-center justify-center rounded-full ${active ? "add-fab-on" : ""}`}
      >
        <Slot size={30} className="slot-idle" />
      </Link>
    </motion.div>
  );
}
