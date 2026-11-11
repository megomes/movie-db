"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Download, ExternalLink, Eye, EyeOff, HardDrive, Heart, HeartOff, Loader2, Plus, Trash2, Trophy } from "lucide-react";
import { addItem, deleteItem, markDone, setHiddenPlatforms, togglePin } from "@/app/actions";
import { formatSize } from "@/lib/kinds";
import { useBacklog } from "./backlog-context";
import { Cover } from "./cover";
import type { LiteItem } from "@/lib/queries";
import { InstallDialog, Sheet, type InstallPlatform } from "./install-dialog";

// Jogo alvo do menu: igdbId identifica no backlog e nos instalados; itemId ajuda quando já é um item do backlog
export type MenuGame = { igdbId: number | null; title: string; coverUrl: string | null; itemId?: string | null; done?: boolean };

const OpenMenu = createContext<(e: React.MouseEvent, game: MenuGame) => void>(() => {});

/** Handler para onContextMenu: abre o menu do jogo no lugar do clique */
export const useGameMenu = () => useContext(OpenMenu);

const PLATFORMS: { id: InstallPlatform; label: string }[] = [
  { id: "switch", label: "Switch" },
  { id: "pc", label: "PC" },
];

// Plataformas dos filtros de Jogos (nomes do IGDB)
const VIEW_PLATFORMS = ["PC", "Switch"] as const;
type ViewPlatform = (typeof VIEW_PLATFORMS)[number];
const visibleOn = (i: LiteItem) => VIEW_PLATFORMS.filter((p) => i.platforms.includes(p) && !i.hiddenPlatforms.includes(p));

// Menu de botão direito dos jogos (qualquer tela): backlog, prioridade, zerado, instalado no Switch/PC
export function GameMenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; game: MenuGame } | null>(null);
  const [install, setInstall] = useState<{ game: MenuGame & { igdbId: number }; platform: InstallPlatform } | null>(null);
  const [hideAll, setHideAll] = useState<{ item: LiteItem; platform: ViewPlatform } | null>(null);
  const { installed } = useBacklog();
  const router = useRouter();

  const open = useCallback((e: React.MouseEvent, game: MenuGame) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, game });
  }, []);

  const installedRow = install ? installed.find((r) => r.igdbId === install.game.igdbId && r.platform === install.platform) : null;

  return (
    <OpenMenu.Provider value={open}>
      {children}
      {menu && (
        <Menu
          key={`${menu.x}-${menu.y}`}
          {...menu}
          onClose={() => setMenu(null)}
          onInstall={(platform) => {
            if (menu.game.igdbId == null) return;
            setInstall({ game: { ...menu.game, igdbId: menu.game.igdbId }, platform });
            setMenu(null);
          }}
          onHideAll={(item, platform) => {
            setHideAll({ item, platform });
            setMenu(null);
          }}
        />
      )}
      <AnimatePresence>{hideAll && <HideAllDialog {...hideAll} onClose={() => setHideAll(null)} />}</AnimatePresence>
      <AnimatePresence>
        {install && (
          <InstallDialog
            game={install.game}
            platform={install.platform}
            installed={installedRow ? { id: installedRow.id, sizeMb: installedRow.sizeMb } : null}
            onClose={() => setInstall(null)}
            onChange={() => router.refresh()}
          />
        )}
      </AnimatePresence>
    </OpenMenu.Provider>
  );
}

function Menu({
  x,
  y,
  game,
  onClose,
  onInstall,
  onHideAll,
}: {
  x: number;
  y: number;
  game: MenuGame;
  onClose: () => void;
  onInstall: (p: InstallPlatform) => void;
  onHideAll: (item: LiteItem, p: ViewPlatform) => void;
}) {
  const router = useRouter();
  const { items, installed, optimistic } = useBacklog();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [, start] = useTransition();

  // Item do meu backlog (mesmo vindo da página de outra pessoa, vale o meu)
  const item = items.find((i) => i.id === game.itemId) ?? (game.igdbId != null ? items.find((i) => i.kind === "game" && i.igdbId === game.igdbId) : undefined);
  const mine = game.igdbId != null ? installed.filter((r) => r.igdbId === game.igdbId) : [];

  // Cabe na tela: abre para o outro lado perto das bordas
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: y + height > window.innerHeight - 8 ? Math.max(8, y - height) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // Muda na tela na hora (o card some ou troca de grupo) e fecha o menu; se o servidor falhar, volta como estava
  function fast(itemId: string, patch: Partial<LiteItem> | null, action: () => Promise<unknown>) {
    onClose();
    optimistic(itemId, patch, action).catch(() => {});
  }

  function run(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError(false);
    start(async () => {
      try {
        await action();
        onClose();
      } catch {
        setError(true);
        setBusy(null);
      }
    });
  }

  return createPortal(
    <motion.div
      ref={ref}
      role="menu"
      aria-label={game.title}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      style={{ left: pos.left, top: pos.top }}
      className="glass-strong fixed z-[70] w-[260px] origin-top-left rounded-2xl p-1.5 shadow-[0_20px_60px_rgb(0_0_0/0.6)]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
        <div className="w-8 shrink-0">
          <Cover item={{ id: String(game.igdbId ?? game.itemId ?? game.title), title: game.title, kind: "game", coverUrl: game.coverUrl }} rounded="rounded-md" />
        </div>
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug line-clamp-2">{game.title}</p>
      </div>
      <Sep />

      {item ? (
        <>
          <Row
            busy={busy}
            id="pin"
            icon={item.pinned ? <HeartOff size={15} /> : <Heart size={15} className="text-danger" />}
            label={item.pinned ? "Tirar da prioridade" : "Priorizar (Quero muito)"}
            onClick={() => fast(item.id, { pinned: !item.pinned }, () => togglePin(item.id))}
          />
          <Row busy={busy} id="done" icon={<Trophy size={15} />} label="Marcar como zerado" onClick={() => fast(item.id, null, () => markDone(item.id))} />
        </>
      ) : game.done ? (
        <p className="flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] text-text-3">
          <Trophy size={15} /> Já zerado
        </p>
      ) : (
        game.igdbId != null && <Row busy={busy} id="add" icon={<Plus size={16} />} label="Pôr no backlog" onClick={() => run("add", () => addItem("game", String(game.igdbId)))} />
      )}

      {game.igdbId != null && (
        <>
          <Sep />
          {PLATFORMS.map((p) => {
            const row = mine.find((r) => r.platform === p.id);
            return (
              <Row
            busy={busy}
                key={p.id}
                id={`install-${p.id}`}
                icon={row ? <HardDrive size={15} className="text-success" /> : <Download size={15} />}
                label={row ? `Instalado no ${p.label}` : `Registrar instalado no ${p.label}`}
                hint={row ? formatSize(row.sizeMb) : undefined}
                onClick={() => onInstall(p.id)}
              />
            );
          })}
        </>
      )}

      {/* Esconder do PC/Switch: some daquele filtro, fica só no outro */}
      {item && VIEW_PLATFORMS.some((p) => item.platforms.includes(p)) && (
        <>
          <Sep />
          {VIEW_PLATFORMS.filter((p) => item.platforms.includes(p)).map((p) => {
            const hidden = item.hiddenPlatforms.includes(p);
            return (
              <Row
                key={p}
                busy={busy}
                id={`hide-${p}`}
                icon={hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                label={hidden ? `Mostrar no ${p}` : `Esconder do ${p}`}
                onClick={() => {
                  const next = hidden ? item.hiddenPlatforms.filter((x) => x !== p) : [...item.hiddenPlatforms, p];
                  // Era a última plataforma em que ele aparece: pergunta antes
                  if (!hidden && visibleOn(item).every((x) => x === p)) return onHideAll(item, p);
                  fast(item.id, { hiddenPlatforms: next }, () => setHiddenPlatforms(item.id, next));
                }}
              />
            );
          })}
        </>
      )}

      <Sep />
      <Row
            busy={busy}
        id="open"
        icon={<ExternalLink size={15} />}
        label="Abrir página"
        onClick={() => {
          onClose();
          router.push(item ? `/item/${item.id}` : game.itemId ? `/item/${game.itemId}` : `/jogo/${game.igdbId}`);
        }}
      />
      {item && <Row busy={busy} id="remove" danger icon={<Trash2 size={15} />} label="Tirar do backlog" onClick={() => fast(item.id, null, () => deleteItem(item.id))} />}
      {error && <p className="px-2.5 pb-1.5 pt-1 text-[12px] text-danger">Não deu certo. Tenta de novo.</p>}
    </motion.div>,
    document.body,
  );
}

function Row({
  id,
  busy,
  icon,
  label,
  hint,
  onClick,
  danger,
}: {
  id: string;
  busy: string | null;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={!!busy}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors disabled:opacity-50 ${
        danger ? "text-danger hover:bg-danger/15" : "text-white/90 hover:bg-white/10"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{busy === id ? <Loader2 size={15} className="animate-spin" /> : icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[12px] tabular-nums text-text-3">{hint}</span>}
    </button>
  );
}

function Sep() {
  return <div className="mx-2 my-1 h-px bg-white/10" />;
}

// Esconder da última plataforma em que o jogo aparece = ele some das listas. Confirma e tira do backlog,
// ou deixa mostrar no outro console (se o jogo sai nele e estava escondido lá).
function HideAllDialog({ item, platform, onClose }: { item: LiteItem; platform: ViewPlatform; onClose: () => void }) {
  const { optimistic } = useBacklog();
  const other = VIEW_PLATFORMS.find((p) => p !== platform && item.platforms.includes(p));

  function act(kind: "other" | "remove") {
    onClose();
    if (kind === "remove") optimistic(item.id, null, () => deleteItem(item.id)).catch(() => {});
    else optimistic(item.id, { hiddenPlatforms: [platform] }, () => setHiddenPlatforms(item.id, [platform])).catch(() => {});
  }

  return (
    <Sheet label="Vai sumir das listas" onClose={onClose}>
      <div className="space-y-4 px-5 pb-5 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-14 shrink-0">
            <Cover item={{ id: item.id, title: item.title, kind: "game", coverUrl: item.coverUrl }} rounded="rounded-lg" />
          </div>
          <p className="min-w-0 flex-1 text-[14px] leading-snug text-white/80">
            Escondendo do {platform}, <b className="text-white">{item.title}</b> não aparece mais no PC nem no Switch.{" "}
            {other ? `Ele também sai para ${other}, onde está escondido.` : `Ele não sai para ${platform === "PC" ? "Switch" : "PC"}.`} Tirar do backlog?
          </p>
        </div>
        <div className="space-y-2">
          {other && (
            <button
              type="button"
              onClick={() => act("other")}
              className="btn-accent tap flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-50"
            >
              <Eye size={17} /> Mostrar só no {other}
            </button>
          )}
          <button
            type="button"
            onClick={() => act("remove")}
            className="tap flex h-11 w-full items-center justify-center gap-2 rounded-full bg-danger/15 text-[15px] font-semibold text-danger disabled:opacity-50"
          >
            <Trash2 size={16} /> Sim, tirar do backlog
          </button>
          <button type="button" onClick={onClose} className="glass tap flex h-11 w-full items-center justify-center rounded-full text-[15px] font-medium">
            Cancelar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
