"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Kind } from "@/lib/db/schema";
import type { LiteItem, Person, Shared, TagLite } from "@/lib/queries";

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
  items,
  me,
  people,
  myProviders,
  reviewCount,
  tags,
  shared,
  doneCount,
}: {
  children: React.ReactNode;
  tags: TagLite[];
  shared: Shared[];
  doneCount: number;
  items: LiteItem[];
  me: Viewer;
  people: Person[];
  myProviders: number[];
  reviewCount: number;
}) {
  const [drawOpen, setDrawOpen] = useState(false);
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
      tagsFor: (kind: Kind) => tags.filter((t) => t.kind === kind),
      tagName: (id: string) => byId.get(id),
      drawOpen,
      setDrawOpen,
      searchOpen,
      setSearchOpen,
      setAmbient,
    };
  }, [items, me, people, myProviders, reviewCount, tags, shared, doneCount, drawOpen, searchOpen, setAmbient]);
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
