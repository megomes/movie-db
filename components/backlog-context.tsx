"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Kind } from "@/lib/db/schema";
import type { InstalledLite, LiteItem, Person, Shared, TagLite } from "@/lib/queries";

export type Viewer = { id: string; name: string | null; email: string; image: string | null };

type Ctx = {
  items: LiteItem[];
  me: Viewer;
  people: Person[];
  myProviders: number[];
  reviewCount: number;
  tags: TagLite[];
  shared: Shared[];
  doneCount: number;
  family: LiteItem[];
  /**
   * Muda um item na tela antes do servidor responder (null = some da lista), roda a ação e desfaz se ela falhar.
   * A lista não recarrega nem perde o lugar: o card some/muda na hora e o resto se reorganiza.
   */
  optimistic: (id: string, patch: Partial<LiteItem> | null, action: () => Promise<unknown>) => Promise<void>;
  /** Jogos instalados (Switch e PC), por igdbId */
  installed: InstalledLite[];
  tagsFor: (kind: Kind) => TagLite[];
  tagName: (id: string) => string | undefined;
  drawOpen: boolean;
  setDrawOpen: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  setAmbient: (color: string | null | undefined) => void;
};

const BacklogContext = createContext<Ctx | null>(null);

export function BacklogProvider({
  children,
  items: serverItems,
  me,
  people,
  myProviders,
  reviewCount,
  tags,
  shared,
  doneCount,
  family,
  installed,
}: {
  children: React.ReactNode;
  installed: InstalledLite[];
  tags: TagLite[];
  shared: Shared[];
  doneCount: number;
  family: LiteItem[];
  items: LiteItem[];
  me: Viewer;
  people: Person[];
  myProviders: number[];
  reviewCount: number;
}) {
  const [drawOpen, setDrawOpen] = useState(false);

  // Mudanças locais por item, até o servidor mandar a lista já com elas
  const [overrides, setOverrides] = useState<Record<string, Partial<LiteItem> | null>>({});
  const [lastItems, setLastItems] = useState(serverItems);
  if (lastItems !== serverItems) {
    setLastItems(serverItems);
    setOverrides((prev) => {
      const byId = new Map(serverItems.map((i) => [i.id, i]));
      const next: typeof prev = {};
      for (const [id, patch] of Object.entries(prev)) {
        const server = byId.get(id);
        const pending = patch === null ? !!server : !!server && Object.entries(patch).some(([k, v]) => JSON.stringify(server[k as keyof LiteItem]) !== JSON.stringify(v));
        if (pending) next[id] = patch;
      }
      return next;
    });
  }
  const items = useMemo(() => {
    if (!Object.keys(overrides).length) return serverItems;
    const out: LiteItem[] = [];
    for (const i of serverItems) {
      if (!(i.id in overrides)) out.push(i);
      else if (overrides[i.id]) out.push({ ...i, ...overrides[i.id] });
    }
    return out;
  }, [serverItems, overrides]);
  const optimistic = useCallback(async (id: string, patch: Partial<LiteItem> | null, action: () => Promise<unknown>) => {
    setOverrides((o) => ({ ...o, [id]: patch }));
    try {
      await action();
    } catch (e) {
      setOverrides((o) => {
        const n = { ...o };
        delete n[id];
        return n;
      });
      throw e;
    }
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cor da arte em destaque tinge o topo da página (ver .ambient em globals.css)
  const setAmbient = useCallback((color: string | null | undefined) => {
    document.documentElement.style.setProperty("--ambient", color ?? "#1b1b22");
  }, []);

  // Ctrl/Cmd+K abre a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => {
    const byId = new Map(tags.map((t) => [t.id, t.name]));
    return {
      items,
      me,
      people,
      myProviders,
      reviewCount,
      tags,
      shared,
      doneCount,
      family,
      optimistic,
      installed,
      tagsFor: (kind: Kind) => tags.filter((t) => t.kind === kind),
      tagName: (id: string) => byId.get(id),
      drawOpen,
      setDrawOpen,
      searchOpen,
      setSearchOpen,
      setAmbient,
    };
  }, [items, me, people, myProviders, reviewCount, tags, shared, doneCount, family, optimistic, installed, drawOpen, searchOpen, setAmbient]);
  return <BacklogContext.Provider value={value}>{children}</BacklogContext.Provider>;
}

export function useBacklog() {
  const ctx = useContext(BacklogContext);
  if (!ctx) throw new Error("useBacklog fora do BacklogProvider");
  return ctx;
}

// Define a cor ambiente enquanto o componente estiver montado
export function useAmbient(color: string | null | undefined) {
  const { setAmbient } = useBacklog();
  useEffect(() => {
    setAmbient(color);
  }, [color, setAmbient]);
}
