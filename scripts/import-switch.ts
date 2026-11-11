/**
 * Importa a lista de jogos instalados no Switch (com tamanho) para a página /switch.
 *   npm run import:switch -- --owner=email@x.com --file=switch.md
 * O arquivo é uma tabela markdown "| # | Jogo | Tamanho |" (ex.: "6,58 GB", "455 MB").
 * Substitui a lista inteira da pessoa (é um retrato do console). Capa e ID vêm do IGDB.
 *   --dry  -> só mostra o que faria
 */
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db, profiles, switchGames } from "../lib/db";
import { getIgdbScreenshots, PLATFORM, searchIgdb } from "../lib/sources/igdb";
import { normalize, similarity } from "../lib/sources/http";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FILE = arg("file");
const OWNER_EMAIL = arg("owner") ?? process.env.OBSIDIAN_BACKLOG_OWNER ?? "";
const DRY = process.argv.includes("--dry");
if (!FILE) throw new Error("Informe o arquivo: --file=switch.md");
if (!OWNER_EMAIL) throw new Error("Informe o dono: --owner=email@x.com");

function parse(md: string) {
  const out: { title: string; sizeMb: number }[] = [];
  for (const line of md.split(/\r?\n/)) {
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const size = cells.at(-1)!.match(/^([\d.,]+)\s*(MB|GB)$/i);
    if (!size) continue;
    const n = Number(size[1].replace(/\./g, "").replace(",", "."));
    out.push({ title: cells.at(-2)!, sizeMb: Math.round(size[2].toUpperCase() === "GB" ? n * 1024 : n) });
  }
  return out;
}

async function resolve(title: string) {
  const found = await searchIgdb(title);
  // "Picross S+" e "Picross S" normalizam igual: o título idêntico ganha
  const exact = (t: string) => Number(t.toLowerCase() === title.toLowerCase());
  const switchIds: number[] = [PLATFORM.SWITCH, PLATFORM.SWITCH2];
  const best = found
    .map((g) => ({ g, sim: similarity(title, g.title), sw: g.platformIds.some((p) => switchIds.includes(p)) }))
    .filter((x) => x.sim >= 0.6 || normalize(x.g.title).startsWith(normalize(title)))
    .sort((a, b) => exact(b.g.title) - exact(a.g.title) || Number(b.sw) - Number(a.sw) || b.sim - a.sim || b.g.popularity - a.g.popularity)[0];
  return best ? { igdbId: Number(best.g.externalId), coverUrl: best.g.cover, match: best.g.title } : null;
}

async function main() {
  const [owner] = await db.select().from(profiles).where(eq(profiles.email, OWNER_EMAIL.toLowerCase()));
  if (!owner) throw new Error(`Perfil ${OWNER_EMAIL} não encontrado (entre no app uma vez antes)`);
  const games = parse(fs.readFileSync(FILE!, "utf8"));
  console.log(`${games.length} jogos no arquivo`);

  const rows = [];
  for (const g of games) {
    // Coletâneas ("PATAPON 1+2 REPLAY") não aparecem na busca do IGDB: tenta sem o "1+2"
    const r = (await resolve(g.title).catch(() => null)) ?? (g.title.includes("+") ? await resolve(g.title.replace(/\s*\d*\+\d*\s*/g, " ").trim()).catch(() => null) : null);
    console.log(`${r ? "✓" : "·"} ${g.title} (${g.sizeMb} MB)${r && r.match !== g.title ? ` → ${r.match}` : ""}`);
    rows.push({ ownerId: owner.userId, title: g.title, sizeMb: g.sizeMb, igdbId: r?.igdbId ?? null, coverUrl: r?.coverUrl ?? null });
  }
  const shots = await getIgdbScreenshots(rows.map((r) => r.igdbId).filter((x): x is number => x != null));
  const final = rows.map((r) => ({ ...r, screenshots: (r.igdbId != null && shots.get(r.igdbId)) || [] }));
  console.log(`Screenshots: ${final.filter((r) => r.screenshots.length).length} jogos`);
  if (DRY) return;
  await db.delete(switchGames).where(eq(switchGames.ownerId, owner.userId));
  await db.insert(switchGames).values(final);
  console.log(`Gravados ${rows.length}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
