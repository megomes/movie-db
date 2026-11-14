import "server-only";
import { sleep } from "./http";

// Listas públicas do Metacritic (as páginas /browse que qualquer pessoa abre no navegador; o robots.txt permite).
// Só o nome, a posição, a data e a nota: capa, screenshots e o resto vêm do IGDB.

export type MetacriticRow = { rank: number; title: string; year: number | null; score: string };

const BASE = "https://www.metacritic.com/browse/game";
const UA = "BacklogApp/1.0 (personal backlog)";

const decode = (s: string) =>
  s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

// Cada card: "N. | Nome | Mmm D, AAAA | ... | 97 | Metascore" (ou "9.6 | User Score")
function parse(html: string): MetacriticRow[] {
  const out: MetacriticRow[] = [];
  for (const chunk of html.split('data-testid="product-title"').slice(1)) {
    const text = decode(chunk.slice(0, 8000).replace(/<[^>]+>/g, "|").replace(/\s+/g, " "));
    const head = text.match(/\|\s*(\d+)\.\s*\|+\s*([^|]+?)\s*\|/);
    if (!head) continue;
    const date = text.match(/\|\s*[A-Z][a-z]{2} \d{1,2}, (\d{4})\s*\|/);
    const score = text.match(/\|\s*(\d{1,3}(?:\.\d)?|tbd)\s*\|[|\s]*(?:Metascore|User Score)/);
    out.push({ rank: Number(head[1]), title: head[2], year: date ? Number(date[1]) : null, score: score?.[1] ?? "" });
  }
  return out;
}

export const metacriticUrl = (path: string, query = "", page = 1) => {
  const q = new URLSearchParams(query);
  if (page > 1) q.set("page", String(page));
  const qs = q.toString();
  return `${BASE}/${path}/${qs ? `?${qs}` : ""}`;
};

/** Uma página de lista do Metacritic (50 jogos) e o total de resultados do filtro */
export async function getMetacriticPage(path: string, query = "", page = 1): Promise<{ rows: MetacriticRow[]; total: number }> {
  const res = await fetch(metacriticUrl(path, query, page), { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`Metacritic ${res.status} em ${path}?${query}`);
  const html = await res.text();
  const total = Number(html.match(/([\d,]+) results/)?.[1]?.replace(/,/g, "") ?? 0);
  return { rows: parse(html), total };
}

/** Várias páginas seguidas, com pausa entre elas */
export async function getMetacriticList(path: string, query = "", pages = 1): Promise<MetacriticRow[]> {
  const rows: MetacriticRow[] = [];
  for (let page = 1; page <= pages; page++) {
    if (page > 1) await sleep(900);
    const { rows: r, total } = await getMetacriticPage(path, query, page);
    rows.push(...r);
    if (rows.length >= total) break;
  }
  return rows;
}
