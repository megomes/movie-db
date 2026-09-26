import { BookOpen, Clapperboard, Gamepad2, Tv, type LucideIcon } from "lucide-react";
import type { Kind } from "@/lib/db/schema";

export const KIND_ICONS: Record<Kind, LucideIcon> = { movie: Clapperboard, series: Tv, game: Gamepad2, book: BookOpen };

// Lista com mais de um tipo: vale mostrar o ícone do tipo em cada capa
export const isMixed = (items: { kind: Kind }[]) => new Set(items.map((i) => i.kind)).size > 1;
