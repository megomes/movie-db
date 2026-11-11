"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, Download, HardDrive, Loader2, Trash2, X } from "lucide-react";
import { addSwitchGame, removeSwitchGame } from "@/app/actions";
import { formatSize } from "@/lib/kinds";
import { Cover } from "./cover";

export type Installed = { id: string; sizeMb: number };
export type InstallTarget = { igdbId: number; title: string; coverUrl: string | null };
export type InstallPlatform = "switch" | "pc";
const PLATFORM_LABEL: Record<InstallPlatform, string> = { switch: "Switch", pc: "PC" };

export const toMb = (value: string, unit: "GB" | "MB") => {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(unit === "GB" ? n * 1024 : n) : null;
};

const fromMb = (mb: number) =>
  mb >= 1024 ? { value: (mb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 }), unit: "GB" as const } : { value: String(mb), unit: "MB" as const };

// Campo de tamanho com GB/MB (aceita vírgula)
export function SizeField({
  value,
  unit,
  onValue,
  onUnit,
}: {
  value: string;
  unit: "GB" | "MB";
  onValue: (v: string) => void;
  onUnit: (u: "GB" | "MB") => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-white/45">Tamanho no console</span>
      <div className="mt-1.5 flex gap-2">
        <input
          autoFocus
          inputMode="decimal"
          value={value}
          onChange={(e) => onValue(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="Ex.: 4,6"
          className="glass h-11 min-w-0 flex-1 rounded-full px-4 text-[15px] tabular-nums outline-none placeholder:text-text-3"
        />
        <div className="glass flex rounded-full p-1">
          {(["GB", "MB"] as const).map((u) => (
            <button key={u} type="button" onClick={() => onUnit(u)} className={`rounded-full px-3.5 text-[13px] font-semibold ${unit === u ? "btn-accent" : "text-white/65"}`}>
              {u}
            </button>
          ))}
        </div>
      </div>
    </label>
  );
}

// Folha de baixo (celular) / modal (desktop) com a moldura de vidro do app.
// Vai direto no <body>: dentro de um card animado (transform) o "fixed" ficaria preso no card.
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-start sm:pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Fechar" />
      <motion.div
        role="dialog"
        aria-label={label}
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="glass-strong relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[18px] font-bold tracking-tight">{label}</h2>
          <button onClick={onClose} className="tap flex h-9 w-9 items-center justify-center rounded-full bg-white/10" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// Instalar (com o tamanho), corrigir o tamanho ou desinstalar um jogo do Switch
export function InstallDialog({
  game,
  installed,
  onClose,
  onChange,
  platform = "switch",
}: {
  game: InstallTarget;
  installed: Installed | null;
  onClose: () => void;
  onChange: (next: Installed | null) => void;
  platform?: InstallPlatform;
}) {
  const start = installed ? fromMb(installed.sizeMb) : { value: "", unit: "GB" as const };
  const [size, setSize] = useState(start.value);
  const [unit, setUnit] = useState<"GB" | "MB">(start.unit);
  const [saving, setSaving] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mb = toMb(size, unit);

  async function run(kind: "save" | "remove") {
    setSaving(kind);
    setError(null);
    try {
      if (kind === "remove" && installed) {
        await removeSwitchGame(installed.id);
        onChange(null);
      } else if (mb) {
        const row = await addSwitchGame(game.igdbId, game.title, mb, game.coverUrl, platform);
        onChange({ id: row.id, sizeMb: row.sizeMb });
      }
      onClose();
    } catch {
      setError("Não deu certo. Tenta de novo.");
      setSaving(null);
    }
  }

  return (
    <Sheet label={`${installed ? "Instalado no" : "Instalar no"} ${PLATFORM_LABEL[platform]}`} onClose={onClose}>
      <form
        className="space-y-4 px-5 pb-5 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          run("save");
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-14 shrink-0">
            <Cover item={{ id: String(game.igdbId), title: game.title, kind: "game", coverUrl: game.coverUrl }} rounded="rounded-lg" />
          </div>
          <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug line-clamp-2">{game.title}</p>
        </div>
        <SizeField value={size} unit={unit} onValue={setSize} onUnit={setUnit} />
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <button type="submit" disabled={!mb || !!saving} className="btn-accent tap flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-40">
          {saving === "save" ? <Loader2 size={17} className="animate-spin" /> : installed ? <Check size={17} /> : <Download size={17} />}
          {installed ? "Salvar tamanho" : "Instalar"} {mb ? `(${formatSize(mb)})` : ""}
        </button>
        {installed && (
          <button
            type="button"
            onClick={() => run("remove")}
            disabled={!!saving}
            className="tap flex h-11 w-full items-center justify-center gap-2 rounded-full bg-danger/15 text-[15px] font-semibold text-danger disabled:opacity-40"
          >
            {saving === "remove" ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={16} />} Desinstalar
          </button>
        )}
      </form>
    </Sheet>
  );
}

// Pílula "Instalar" / "Instalado · 4,6 GB" que abre o diálogo
export function InstallChip({
  game,
  installed,
  onChange,
  size = "sm",
}: {
  game: InstallTarget;
  installed: Installed | null;
  onChange: (next: Installed | null) => void;
  size?: "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const big = size === "lg";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`tap inline-flex shrink-0 items-center rounded-full font-semibold transition-colors ${
          big ? "h-11 gap-2 px-5 text-[14px]" : "h-7 gap-1 px-2.5 text-[11.5px]"
        } ${installed ? "bg-success/15 text-success hover:bg-success/25" : "glass text-white/80 hover:text-white"}`}
      >
        {installed ? <HardDrive size={big ? 16 : 12} /> : <Download size={big ? 16 : 12} />}
        {installed ? (big ? `Instalado · ${formatSize(installed.sizeMb)}` : formatSize(installed.sizeMb)) : "Instalar"}
      </button>
      <AnimatePresence>{open && <InstallDialog game={game} installed={installed} onClose={() => setOpen(false)} onChange={onChange} />}</AnimatePresence>
    </>
  );
}
