"use client";

import { useState } from "react";
import { Check, ClipboardCopy, LoaderCircle } from "lucide-react";
import { exportBacklogMarkdown } from "@/app/actions";

// Copia o backlog inteiro em markdown (para colar num agente de IA)
async function copyBacklog() {
  const text = exportBacklogMarkdown();
  // Safari só aceita copiar depois de um await se a promessa já entrar no ClipboardItem dentro do clique
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
      return;
    } catch {
      // cai no writeText abaixo
    }
  }
  await navigator.clipboard.writeText(await text);
}

export function CopyBacklogButton({ className, iconClass, size, onDone }: { className: string; iconClass?: string; size: number; onDone?: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const Icon = state === "busy" ? LoaderCircle : state === "ok" ? Check : ClipboardCopy;
  return (
    <button
      className={className}
      disabled={state === "busy"}
      onClick={async (e) => {
        e.stopPropagation();
        setState("busy");
        try {
          await copyBacklog();
          setState("ok");
          setTimeout(() => {
            setState("idle");
            onDone?.();
          }, 1100);
        } catch {
          setState("error");
          setTimeout(() => setState("idle"), 2500);
        }
      }}
    >
      <span className={iconClass}>
        <Icon size={size} className={`${state === "busy" ? "animate-spin" : ""} ${state === "ok" ? "text-success" : ""}`} />
      </span>
      <span className="flex-1 text-left">
        {state === "ok" ? "Copiado!" : state === "error" ? "Não deu para copiar" : "Copiar backlog para IA"}
      </span>
    </button>
  );
}
