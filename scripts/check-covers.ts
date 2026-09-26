/**
 * Diagnóstico: encontra capas que são placeholder ("imagem indisponível") ou quebradas.
 *   npx tsx --env-file=.env.local scripts/check-covers.ts
 */
import { isNull } from "drizzle-orm";
import { db, items } from "../lib/db";

async function main() {
  const rows = await db.select({ kind: items.kind, title: items.title, cover: items.coverUrl }).from(items).where(isNull(items.doneAt));
  const bySize = new Map<number, string[]>();
  const broken: string[] = [];
  await Promise.all(
    rows
      .filter((r) => r.cover)
      .map(async (r) => {
        try {
          const res = await fetch(r.cover!);
          if (!res.ok) return broken.push(`${r.kind} ${r.title} (${res.status})`);
          const n = (await res.arrayBuffer()).byteLength;
          bySize.set(n, [...(bySize.get(n) ?? []), `${r.kind} ${r.title}`]);
        } catch {
          broken.push(`${r.kind} ${r.title} (erro)`);
        }
      }),
  );
  const dup = [...bySize.entries()].filter(([, l]) => l.length > 1);
  console.log("Tamanhos idênticos (provável placeholder):");
  for (const [n, l] of dup) console.log(` ${n} bytes x${l.length}:`, l.slice(0, 5).join(" | "));
  console.log("Quebradas:", broken);
  const small = [...bySize.entries()].filter(([n]) => n < 6000).flatMap(([n, l]) => l.map((t) => `${n}b ${t}`));
  console.log("Muito pequenas (<6KB):", small);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
