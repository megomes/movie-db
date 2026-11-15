/**
 * Lista "Trailers" do Descobrir: os jogos cujos trailers foram mais vistos nos canais GameTrailers e IGN desde 2022.
 *   npm run sync:trailers                        -> lista os canais com o yt-dlp (precisa estar instalado) e grava
 *   npm run sync:trailers -- --tsv=a.tsv,b.tsv   -> usa listagens já baixadas (id, timestamp, views, duração, título)
 *   npm run sync:trailers -- --dry               -> só mostra o que faria
 * Do título do vídeo sai o nome do jogo ("Nome - Official ... Trailer"); trailers de filme/série ficam de fora.
 * Soma as visualizações por jogo, liga ao IGDB pelo nome e guarda na tabela trailer_games (só jogos de 2022 para cá
 * ou ainda sem data). A página busca capa/screenshots no IGDB pelos ids.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { inArray } from "drizzle-orm";
import { db, trailerGames, youtubeLikes, type TrailerVideo } from "../lib/db";
import { GAME_TYPES, igdb } from "../lib/sources/igdb";
import { normalize } from "../lib/sources/http";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DRY = process.argv.includes("--dry");
const CHANNELS = ["GameTrailers", "IGN"];
const SINCE = Date.UTC(2022, 0, 1) / 1000;
// Quantos nomes (os mais vistos) procurar no IGDB, quantos pela busca quando o nome exato não bate, e quantos jogos guardar
const MAX_NAMES = 3000;
const MAX_SEARCH = 900;
const KEEP = 1000;
// Anúncio pago: trailer com muita visualização e quase nenhuma curtida (trailer de verdade fica entre 0,5% e 3%)
const CHECK_VIEWS = 300_000;
const AD_RATIO = 0.0015;

type Video = { id: string; ts: number; views: number; title: string; channel: string };

function parse(text: string, channel: string): Video[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((c) => c.length >= 5)
    .map(([id, ts, views, , ...title]) => ({ id, ts: Number(ts), views: Number(views) || 0, title: title.join("\t"), channel }));
}

// Lista o canal (sem baixar vídeo nenhum) até o primeiro vídeo antes de SINCE
function listChannel(channel: string): Promise<Video[]> {
  return new Promise((resolve, reject) => {
    const p = spawn("yt-dlp", [
      "--lazy-playlist",
      "--flat-playlist",
      "--extractor-args",
      "youtubetab:approximate_date",
      "--break-match-filters",
      `timestamp>=${SINCE}`,
      "-O",
      "%(id)s\t%(timestamp)s\t%(view_count)s\t%(duration)s\t%(title)s",
      `https://www.youtube.com/@${channel}/videos`,
    ]);
    let out = "";
    p.stdout.setEncoding("utf8").on("data", (d) => (out += d));
    p.stderr.on("data", () => {});
    p.on("error", reject);
    p.on("close", () => resolve(parse(out, channel)));
  });
}

// Curtidas dos vídeos (yt-dlp, 25 por processo, 4 processos de cada vez); guarda no banco
async function fetchLikes(ids: string[]): Promise<Map<string, { views: number; likes: number | null }>> {
  const out = new Map<string, { views: number; likes: number | null }>();
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 25) batches.push(ids.slice(i, i + 25));
  let done = 0;
  const run = (batch: string[]) =>
    new Promise<void>((resolve) => {
      const p = spawn("yt-dlp", ["--skip-download", "--ignore-errors", "--no-warnings", "-O", "%(id)s\t%(view_count)s\t%(like_count)s", ...batch.map((id) => `https://youtu.be/${id}`)]);
      let buf = "";
      p.stdout.setEncoding("utf8").on("data", (d) => (buf += d));
      p.stderr.on("data", () => {});
      p.on("close", () => {
        for (const line of buf.split(/\r?\n/)) {
          const [id, views, likes] = line.split("\t");
          if (id && batch.includes(id)) out.set(id, { views: Number(views) || 0, likes: likes && likes !== "NA" ? Number(likes) : null });
        }
        done += batch.length;
        process.stdout.write(`\r  curtidas: ${done}/${ids.length}`);
        resolve();
      });
      p.on("error", () => resolve());
    });
  const queue = [...batches];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let b = queue.shift(); b; b = queue.shift()) await run(b);
  }));
  if (ids.length) process.stdout.write("\n");
  return out;
}

// "Nome do Jogo - Official Gameplay Trailer | gamescom 2026" -> ["Nome do Jogo"]; filme ("(2026) Ator, Atriz"), série,
// clipe, guia, review etc. -> null. Um apelido entre parênteses também vale: "GTA 6 (Grand Theft Auto 6)".
function gameNames(title: string): string[] | null {
  const t = title.replace(/\s*\|.*$/, "").trim();
  const m = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!m) return null;
  const [, left, right] = m;
  if (!/\b(trailer|gameplay|teaser|cinematic|reveal)\b/i.test(right)) return null;
  if (/\(\d{4}\)/.test(right) || /\bclip\b/i.test(right) || /\b(season|episode|series|movie|film|anime)\b/i.test(left + " " + right)) return null;
  const alias = left.match(/\(([^)]+)\)/)?.[1];
  const main = left.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (!main || main.length > 80) return null;
  return alias ? [main, alias.trim()] : [main];
}

// Para comparar nomes: sem pontuação e com números romanos virando algarismos ("VI" = "6")
const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12" };
const key = (s: string) =>
  normalize(s)
    .split(" ")
    .map((w) => ROMAN[w] ?? w)
    .join(" ");

type Raw = {
  id: number;
  name: string;
  first_release_date?: number;
  platforms?: number[];
  total_rating_count?: number;
  hypes?: number;
  alternative_names?: { name: string }[];
};
const FIELDS = "fields name,first_release_date,platforms,total_rating_count,hypes,alternative_names.name";
const recent = (g: Raw) => !g.first_release_date || g.first_release_date >= SINCE;
// Mais de um jogo com o mesmo nome: o recente (ou sem data) e mais falado
const best = (list: Raw[]) =>
  [...list].sort((a, b) => Number(recent(b)) - Number(recent(a)) || (b.hypes ?? 0) + (b.total_rating_count ?? 0) - ((a.hypes ?? 0) + (a.total_rating_count ?? 0)))[0];
const quote = (s: string) => s.replace(/["\\]/g, "");

async function main() {
  const tsv = arg("tsv");
  const videos: Video[] = [];
  if (tsv) {
    for (const f of tsv.split(",")) videos.push(...parse(readFileSync(f, "utf8"), basename(f).replace(/^yt-|\.tsv$/g, "")));
  } else {
    for (const ch of CHANNELS) {
      const v = await listChannel(ch);
      console.log(`${ch}: ${v.length} vídeos desde 2022`);
      videos.push(...v);
    }
  }
  const inRange = videos.filter((v) => v.ts >= SINCE);

  // Trailers com muita visualização: confere as curtidas (as já conferidas vêm do banco) e tira os anúncios pagos
  const big = inRange.filter((v) => v.views >= CHECK_VIEWS && gameNames(v.title));
  const likes = new Map<string, { views: number; likes: number | null }>();
  for (let i = 0; i < big.length; i += 500) {
    const rows = await db.select().from(youtubeLikes).where(inArray(youtubeLikes.videoId, big.slice(i, i + 500).map((v) => v.id)));
    for (const r of rows) likes.set(r.videoId, r);
  }
  const todo = big.filter((v) => !likes.has(v.id)).map((v) => v.id);
  console.log(`${big.length} trailers com ${CHECK_VIEWS / 1000} mil+ visualizações; conferindo curtidas de ${todo.length} novos`);
  const fresh = await fetchLikes(todo);
  for (const [id, x] of fresh) likes.set(id, x);
  if (!DRY && fresh.size) {
    const vals = [...fresh].map(([videoId, x]) => ({ videoId, views: x.views, likes: x.likes }));
    for (let i = 0; i < vals.length; i += 200) await db.insert(youtubeLikes).values(vals.slice(i, i + 200)).onConflictDoNothing();
  }
  const ads = new Set(big.filter((v) => { const x = likes.get(v.id); return x?.likes != null && x.likes / Math.max(1, x.views) < AD_RATIO; }).map((v) => v.id));
  console.log(`anúncios pagos fora: ${ads.size}`);
  for (const v of big.filter((x) => ads.has(x.id)).sort((a, b) => b.views - a.views).slice(0, 15)) console.log(`  ${(v.views / 1e6).toFixed(1)} mi · ${likes.get(v.id)?.likes} curtidas · ${v.title}`);

  // Agrupa por nome do jogo
  type Group = { names: Set<string>; views: number; videos: TrailerVideo[] };
  const groups = new Map<string, Group>();
  let trailers = 0;
  for (const v of inRange) {
    if (ads.has(v.id)) continue;
    const names = gameNames(v.title);
    if (!names) continue;
    trailers++;
    const k = key(names[0]);
    const g = groups.get(k) ?? { names: new Set<string>(), views: 0, videos: [] };
    names.forEach((n) => g.names.add(n));
    g.views += v.views;
    g.videos.push({ id: v.id, title: v.title, views: v.views, channel: v.channel });
    groups.set(k, g);
  }
  const ranked = [...groups.values()].sort((a, b) => b.views - a.views).slice(0, MAX_NAMES);
  console.log(`${inRange.length} vídeos, ${trailers} trailers de jogo, ${groups.size} nomes; procurando os ${ranked.length} mais vistos no IGDB`);

  // 1) Nome exato (25 por consulta), comparando sem pontuação e com romanos = algarismos, inclusive nomes alternativos
  const byKey = new Map<string, Raw[]>();
  const add = (k: string, g: Raw) => byKey.set(k, [...(byKey.get(k) ?? []).filter((x) => x.id !== g.id), g]);
  const allNames = [...new Set(ranked.flatMap((g) => [...g.names]))];
  for (let i = 0; i < allNames.length; i += 25) {
    const where = allNames
      .slice(i, i + 25)
      .map((n) => `name ~ "${quote(n)}"`)
      .join(" | ");
    const found = await igdb<Raw[]>("games", `${FIELDS}; where (${where}) & game_type = ${GAME_TYPES}; limit 500;`);
    for (const g of found) add(key(g.name), g);
  }
  const matchOf = (grp: Group) => {
    for (const n of grp.names) {
      const list = byKey.get(key(n));
      if (list?.length) return best(list);
    }
    return undefined;
  };

  // 2) Quem não bateu: busca do IGDB, aceitando só nome (ou nome alternativo) igual
  let searched = 0;
  for (const grp of ranked) {
    if (searched >= MAX_SEARCH) break;
    if (matchOf(grp)) continue;
    searched++;
    const n = [...grp.names][0];
    const hits = await igdb<Raw[]>("games", `search "${quote(n)}"; ${FIELDS}; where game_type = ${GAME_TYPES}; limit 8;`);
    const want = new Set([...grp.names].map(key));
    const ok = hits.filter((h) => want.has(key(h.name)) || h.alternative_names?.some((a) => want.has(key(a.name))));
    if (ok.length) for (const n2 of grp.names) for (const h of ok) add(key(n2), h);
  }

  // Junta por jogo (dois nomes podem ser o mesmo jogo) e fica só com os de 2022 para cá ou sem data
  type Row = { game: Raw; views: number; videos: TrailerVideo[] };
  const rows = new Map<number, Row>();
  let unmatched = 0;
  let old = 0;
  const missed: string[] = [];
  for (const grp of ranked) {
    const g = matchOf(grp);
    if (!g) {
      unmatched++;
      if (missed.length < 25) missed.push(`${[...grp.names][0]} (${(grp.views / 1e6).toFixed(1)} mi)`);
      continue;
    }
    if (!recent(g)) {
      old++;
      continue;
    }
    const r = rows.get(g.id) ?? { game: g, views: 0, videos: [] };
    r.views += grp.views;
    r.videos.push(...grp.videos);
    rows.set(g.id, r);
  }
  const top = [...rows.values()].sort((a, b) => b.views - a.views).slice(0, KEEP);
  console.log(`${rows.size} jogos no IGDB (${searched} pela busca); ${old} antigos fora; ${unmatched} sem par`);
  console.log(`sem par, mais vistos: ${missed.join(", ")}`);
  console.log("top 30:");
  for (const r of top.slice(0, 30)) console.log(`  ${(r.views / 1e6).toFixed(1)} mi · ${r.videos.length} vídeos · ${r.game.name}`);
  if (DRY) return;

  const values = top.map((r) => ({
    igdbId: r.game.id,
    title: r.game.name,
    views: r.views,
    videoCount: r.videos.length,
    videos: [...r.videos].sort((a, b) => b.views - a.views).slice(0, 5),
    platforms: r.game.platforms ?? [],
    releaseDate: r.game.first_release_date ? new Date(r.game.first_release_date * 1000) : null,
    updatedAt: new Date(),
  }));
  await db.delete(trailerGames);
  for (let i = 0; i < values.length; i += 200) await db.insert(trailerGames).values(values.slice(i, i + 200));
  console.log(`gravados ${values.length} jogos`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
