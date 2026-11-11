"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Loader2, Plus } from "lucide-react";
import { addItem } from "@/app/actions";
import { InstallChip, type InstallTarget, type Installed } from "./install-dialog";

// Volta para onde a pessoa estava (Descobrir, Meu Switch…); aberta direto por link, vai para o fallback
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="glass tap inline-flex h-10 items-center gap-1 rounded-full pl-2.5 pr-4 text-[14px]"
    >
      <ChevronLeft size={20} /> Voltar
    </button>
  );
}

// Põe o jogo no backlog (com a tag Switch) e abre a página completa do item
export function GameBacklogButton({ igdbId, switchTagId }: { igdbId: number; switchTagId: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "adding" | "error">("idle");
  return (
    <button
      disabled={state === "adding"}
      onClick={async () => {
        setState("adding");
        try {
          const id = await addItem("game", String(igdbId), switchTagId ? [switchTagId] : []);
          router.replace(`/item/${id}`);
        } catch {
          setState("error");
        }
      }}
      className="btn-accent tap inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-semibold disabled:opacity-70"
    >
      {state === "adding" ? <Loader2 size={17} className="animate-spin" /> : <Plus size={18} />}
      {state === "error" ? "Tentar de novo" : "Pôr no backlog"}
    </button>
  );
}

// Instalar/desinstalar no Switch a partir da página do jogo (recarrega os dados do servidor depois)
export function GameInstallButton({ game, installed }: { game: InstallTarget; installed: Installed | null }) {
  const router = useRouter();
  return <InstallChip game={game} installed={installed} size="lg" onChange={() => router.refresh()} />;
}
