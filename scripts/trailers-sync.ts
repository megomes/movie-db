/**
 * Listas do GameTrailers e da IGN no Descobrir: os jogos cujos trailers foram mais vistos em cada canal desde 2022
 * (geral, por ano do trailer e por gênero do IGDB), por plataforma. Ficam na mesma tabela das listas do Metacritic.
 *   npm run sync:trailers                        -> lista os canais com o yt-dlp (precisa estar instalado) e grava
 *   npm run sync:trailers -- --tsv=a.tsv,b.tsv   -> usa listagens já baixadas (yt-GameTrailers.tsv, yt-IGN.tsv)
 *   npm run sync:trailers -- --dry               -> só mostra o que faria
 * Do título do vídeo sai o nome do jogo ("Nome - Official ... Trailer"); trailers de filme/série e anúncios pagos ficam
 * de fora. Liga ao IGDB pelo nome (só jogos de 2022 para cá ou sem data); DLC conta para o jogo principal.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db, metacriticLists, youtubeLikes, type MetacriticEntry } from "../lib/db";
import { GENRES, MAX_GENRE, MIN_GENRE, type Tax } from "../lib/game-genres";
import { igdb } from "../lib/sources/igdb";
import { normalize } from "../lib/sources/http";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DRY = process.argv.includes("--dry");
const SINCE = Date.UTC(2022, 0, 1) / 1000;
// Quantos nomes (os mais vistos) procurar no IGDB e quantas buscas fazer quando o nome exato não bate
const MAX_NAMES = 8000;
const MAX_SEARCH = 2500;
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

// Outras formas do nome para achar no IGDB, da mais segura para a menos: sem "Remake"/"Edition"; cada jogo de um par
// ("Pokemon Scarlet and Pokemon Violet"); o nome antes dos dois-pontos (DLC/temporada -> o jogo)
const EDITION = /\s+(remake|remastered|remaster|definitive edition|deluxe edition|gold edition|complete edition|game of the year edition|goty edition|enhanced edition|director'?s cut)$/i;
function variants(names: string[]): string[][] {
  const stripped = names.map((n) => n.replace(EDITION, "").trim()).filter((n) => !names.includes(n));
  const parts = names.flatMap((n) => (/\s(and|&|\+)\s/i.test(n) ? n.split(/\s+(?:and|&|\+)\s+/i).map((x) => x.trim()) : [])).filter((x) => x.length > 2);
  const prefix = names.flatMap((n) => (n.includes(":") ? [n.slice(0, n.indexOf(":")).trim()] : [])).filter((x) => x.length > 2);
  return [names, stripped, parts, prefix].filter((v) => v.length);
}

type Raw = {
  id: number;
  name: string;
  first_release_date?: number;
  platforms?: number[];
  total_rating_count?: number;
  hypes?: number;
  game_type?: number;
  parent_game?: number;
  alternative_names?: { name: string }[];
};
const FIELDS = "fields name,first_release_date,platforms,total_rating_count,hypes,game_type,parent_game,alternative_names.name";
// Também DLC (1) e expansão (2): os trailers delas contam para o jogo principal
const MATCH_TYPES = "(0,1,2,4,8,9,10,11)";
const recentTs = (ts?: number) => !ts || ts >= SINCE;
// Mais de um jogo com o mesmo nome: jogo principal antes de DLC, o recente (ou sem data) e o mais falado
const best = (list: Raw[]) =>
  [...list].sort(
    (a, b) =>
      Number(![1, 2].includes(b.game_type ?? 0)) - Number(![1, 2].includes(a.game_type ?? 0)) ||
      Number(recentTs(b.first_release_date)) - Number(recentTs(a.first_release_date)) ||
      (b.hypes ?? 0) + (b.total_rating_count ?? 0) - ((a.hypes ?? 0) + (a.total_rating_count ?? 0)),
  )[0];
const quote = (s: string) => s.replace(/["\\]/g, "");

type Info = Tax & { id: number; name: string; first_release_date?: number; platforms?: number[] };
const DISCOVER = [
  { id: "pc", igdb: 6 },
  { id: "switch", igdb: 130 },
  { id: "android", igdb: 34 },
];
const SOURCES = [
  { id: "gametrailers", channel: "GameTrailers" },
  { id: "ign", channel: "IGN" },
];
const TOP = 150;
const PER_YEAR = 100;

async function main() {
  const tsv = arg("tsv");
  const videos: Video[] = [];
  if (tsv) {
    for (const f of tsv.split(",")) videos.push(...parse(readFileSync(f, "utf8"), basename(f).replace(/^yt-|\.tsv$/g, "")));
  } else {
    for (const s of SOURCES) {
      const v = await listChannel(s.channel);
      console.log(`${s.channel}: ${v.length} vídeos desde 2022`);
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
  const ads = new Set(
    big
      .filter((v) => {
        const x = likes.get(v.id);
        return x?.likes != null && x.likes / Math.max(1, x.views) < AD_RATIO;
      })
      .map((v) => v.id),
  );
  console.log(`anúncios pagos fora: ${ads.size}`);

  // Agrupa os trailers por nome do jogo (os dois canais juntos para procurar no IGDB uma vez só)
  type Group = { names: string[]; views: number; videos: Video[] };
  const groups = new Map<string, Group>();
  for (const v of inRange) {
    if (ads.has(v.id)) continue;
    const names = gameNames(v.title);
    if (!names) continue;
    const k = key(names[0]);
    const g = groups.get(k) ?? { names: [], views: 0, videos: [] };
    for (const n of names) if (!g.names.includes(n)) g.names.push(n);
    g.views += v.views;
    g.videos.push(v);
    groups.set(k, g);
  }
  const ranked = [...groups.values()].sort((a, b) => b.views - a.views).slice(0, MAX_NAMES);
  const trailerCount = [...groups.values()].reduce((n, g) => n + g.videos.length, 0);
  console.log(`${inRange.length} vídeos, ${trailerCount} trailers de jogo, ${groups.size} nomes; procurando os ${ranked.length} mais vistos no IGDB`);

  // 1) Nome exato (25 por consulta) de todas as formas do nome, comparando sem pontuação e com romanos = algarismos
  const byKey = new Map<string, Raw[]>();
  const add = (k: string, g: Raw) => byKey.set(k, [...(byKey.get(k) ?? []).filter((x) => x.id !== g.id), g]);
  const allNames = [...new Set(ranked.flatMap((g) => variants(g.names).flat()))];
  for (let i = 0; i < allNames.length; i += 25) {
    const where = allNames
      .slice(i, i + 25)
      .map((n) => `name ~ "${quote(n)}"`)
      .join(" | ");
    const found = await igdb<Raw[]>("games", `${FIELDS}; where (${where}) & game_type = ${MATCH_TYPES}; limit 500;`);
    for (const g of found) add(key(g.name), g);
  }
  const lookup = (names: string[]) => {
    for (const n of names) {
      const list = byKey.get(key(n));
      if (list?.length) return best(list);
    }
    return undefined;
  };
  const matchOf = (grp: Group) => {
    for (const v of variants(grp.names)) {
      const g = lookup(v);
      if (g) return g;
    }
    return undefined;
  };

  // 2) Quem não bateu: busca do IGDB pelo nome principal (e pelos sem "Remake"), aceitando só nome ou nome alternativo igual
  let searched = 0;
  for (const grp of ranked) {
    if (searched >= MAX_SEARCH) break;
    if (matchOf(grp)) continue;
    const [names, stripped = []] = variants(grp.names);
    for (const n of [...names, ...stripped].slice(0, 2)) {
      searched++;
      const hits = await igdb<Raw[]>("games", `search "${quote(n)}"; ${FIELDS}; where game_type = ${MATCH_TYPES}; limit 8;`);
      const want = key(n);
      const ok = hits.filter((h) => key(h.name) === want || h.alternative_names?.some((a) => key(a.name) === want));
      for (const h of ok) add(want, h);
      if (ok.length) break;
    }
  }

  // DLC/expansão conta para o jogo principal
  const matched = new Map<Group, number>();
  let unmatched = 0;
  let unmatchedViews = 0;
  const missed: string[] = [];
  for (const grp of ranked) {
    const g = matchOf(grp);
    if (!g) {
      unmatched++;
      unmatchedViews += grp.views;
      if (missed.length < 40) missed.push(`${grp.names[0]} (${(grp.views / 1e6).toFixed(1)} mi)`);
      continue;
    }
    matched.set(grp, [1, 2].includes(g.game_type ?? 0) && g.parent_game ? g.parent_game : g.id);
  }

  // Dados de cada jogo (nome, lançamento, plataformas, gênero) para filtrar e separar
  const ids = [...new Set(matched.values())];
  const info = new Map<number, Info>();
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await igdb<Info[]>("games", `fields name,first_release_date,platforms,genres,themes,keywords; where id = (${ids.slice(i, i + 500).join(",")}); limit 500;`);
    for (const r of rows) info.set(r.id, r);
  }
  const totalViews = ranked.reduce((n, g) => n + g.views, 0);
  console.log(
    `${matched.size} nomes ligados a ${ids.length} jogos (${searched} buscas); ${unmatched} sem par = ${((unmatchedViews / totalViews) * 100).toFixed(1)}% das visualizações`,
  );
  console.log(`sem par, mais vistos: ${missed.join(", ")}`);

  // Vídeo -> jogo (só jogos de 2022 para cá ou sem data)
  type Hit = { game: Info; video: Video };
  const hits: Hit[] = [];
  let old = 0;
  for (const [grp, id] of matched) {
    const game = info.get(id);
    if (!game) continue;
    if (!recentTs(game.first_release_date)) {
      old++;
      continue;
    }
    for (const video of grp.videos) hits.push({ game, video });
  }
  console.log(`${old} nomes de jogos antigos fora`);

  const year = new Date().getUTCFullYear();
  const lists: { id: string; source: string; platform: string; group: string; label: string; position: number; url: string; entries: MetacriticEntry[] }[] = [];
  const rank = (hs: Hit[]) => {
    const sum = new Map<number, { game: Info; views: number }>();
    for (const h of hs) {
      const r = sum.get(h.game.id) ?? { game: h.game, views: 0 };
      r.views += h.video.views;
      sum.set(h.game.id, r);
    }
    return [...sum.values()].sort((a, b) => b.views - a.views);
  };
  const toEntries = (rows: { game: Info; views: number }[]): MetacriticEntry[] =>
    rows.map((r, i) => ({
      rank: i + 1,
      title: r.game.name,
      year: r.game.first_release_date ? new Date(r.game.first_release_date * 1000).getUTCFullYear() : null,
      score: String(r.views),
      igdbId: r.game.id,
    }));
  for (const s of SOURCES) {
    const url = `https://www.youtube.com/@${s.channel}/videos`;
    for (const p of DISCOVER) {
      const mine = hits.filter((h) => h.video.channel === s.channel && h.game.platforms?.includes(p.igdb));
      const all = rank(mine);
      if (!all.length) continue;
      const base = { source: s.id, platform: p.id, url };
      lists.push({ ...base, id: `${s.id}/${p.id}/top`, group: "geral", label: "Mais vistos desde 2022", position: 0, entries: toEntries(all.slice(0, TOP)) });
      for (let y = year; y >= 2022; y--) {
        const ofYear = rank(mine.filter((h) => new Date(h.video.ts * 1000).getUTCFullYear() === y));
        if (ofYear.length) lists.push({ ...base, id: `${s.id}/${p.id}/ano-${y}`, group: "ano", label: String(y), position: 100 + (year - y), entries: toEntries(ofYear.slice(0, PER_YEAR)) });
      }
      for (const [i, [slug, label, test]] of GENRES.entries()) {
        const rows = all.filter((r) => test(r.game));
        if (rows.length >= MIN_GENRE) lists.push({ ...base, id: `${s.id}/${p.id}/genero-${slug}`, group: "genero", label, position: 200 + i, entries: toEntries(rows.slice(0, MAX_GENRE)) });
      }
      const own = lists.filter((l) => l.source === s.id && l.platform === p.id);
      console.log(`${s.id}/${p.id}: ${all.length} jogos; ${own.length} listas (${own.filter((l) => l.group === "genero").length} gêneros)`);
    }
  }
  const top = lists.find((l) => l.id === "ign/pc/top");
  if (top) console.log(`ign/pc/top: ${top.entries.slice(0, 15).map((e) => e.title).join(", ")}`);
  if (DRY) return;

  for (const l of lists) {
    const values = { ...l, updatedAt: new Date() };
    await db.insert(metacriticLists).values(values).onConflictDoUpdate({ target: metacriticLists.id, set: values });
  }
  // Listas de trailers que não saíram nesta rodada somem
  const keep = new Set(lists.map((l) => l.id));
  for (const l of await db.select({ id: metacriticLists.id }).from(metacriticLists).where(inArray(metacriticLists.source, SOURCES.map((s) => s.id)))) {
    if (!keep.has(l.id)) await db.delete(metacriticLists).where(eq(metacriticLists.id, l.id));
  }
  console.log(`gravadas ${lists.length} listas`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
