import type { Candidate, NewItem } from "@/lib/db/schema";
import { fetchJson, similarity, sleep } from "./http";

type Volume = {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    language?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: Partial<Record<"smallThumbnail" | "thumbnail" | "small" | "medium" | "large" | "extraLarge", string>>;
  };
};

// Google Books reclama de rajadas (429); espaça as chamadas
let lastGb = 0;
async function gbFetch<T>(p: string) {
  const wait = lastGb + 350 - Date.now();
  lastGb = Math.max(Date.now(), lastGb + 350);
  if (wait > 0) await sleep(wait);
  const url = `https://www.googleapis.com/books/v1/${p}${p.includes("?") ? "&" : "?"}key=${process.env.GOOGLE_BOOKS_API_KEY}`;
  return fetchJson<T>(url, undefined, 5);
}

const httpsImg = (u?: string) => (u ? u.replace(/^http:/, "https:").replace("&edge=curl", "") : null);

function coverOf(v: Volume) {
  const l = v.volumeInfo.imageLinks;
  if (!l) return null;
  const best = l.extraLarge ?? l.large ?? l.medium ?? l.small;
  if (best) return httpsImg(best);
  // thumbnail é 128px; zoom=0 não é garantido, então pede largura maior via fife
  return l.thumbnail ? `https://books.google.com/books/publisher/content/images/frontcover/${v.id}?fife=w480-h720&source=gbs_api` : null;
}

const yearOf = (d?: string) => (d ? Number(d.slice(0, 4)) || null : null);

export async function searchBooks(query: string, author?: string): Promise<Candidate[]> {
  const q = author ? `intitle:${query} inauthor:${author}` : query;
  let d = await gbFetch<{ items?: Volume[] }>(`volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books`);
  if (!d.items?.length && author) {
    d = await gbFetch<{ items?: Volume[] }>(`volumes?q=${encodeURIComponent(`${query} ${author}`)}&maxResults=10&printType=books`);
  }
  // Google às vezes repete o mesmo volume
  const items = [...new Map((d.items ?? []).map((v) => [v.id, v])).values()];
  // Prefere edições em português
  items.sort((a, b) => Number(b.volumeInfo.language === "pt") - Number(a.volumeInfo.language === "pt"));
  return items.map((v) => ({
    externalId: v.id,
    title: v.volumeInfo.title,
    year: yearOf(v.volumeInfo.publishedDate),
    cover: httpsImg(v.volumeInfo.imageLinks?.thumbnail),
    subtitle: ["Livro", v.volumeInfo.authors?.join(", ")].filter(Boolean).join(" · "),
  }));
}

// Hardcover: 60 req/min
let lastHc = 0;
async function hardcoverSearch(title: string, author?: string | null) {
  const wait = lastHc + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastHc = Date.now();
  type Doc = {
    slug: string;
    title: string;
    alternative_titles?: string[];
    author_names?: string[];
    rating?: number;
    ratings_count?: number;
    pages?: number;
    release_year?: number;
    image?: { url?: string };
    contributions?: { author?: { name: string; image?: { url?: string } | null } }[];
  };
  const res = await fetchJson<{ data?: { search?: { results?: { hits?: { document: Doc }[] } } } }>(
    "https://api.hardcover.app/v1/graphql",
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.HARDCOVER_API_TOKEN}` },
      body: JSON.stringify({
        query: "query($q:String!){ search(query:$q, query_type:\"Book\", per_page:5){ results } }",
        variables: { q: [title, author].filter(Boolean).join(" ") },
      }),
    },
  );
  const hits = res.data?.search?.results?.hits?.map((h) => h.document) ?? [];
  const best = hits
    .map((d) => {
      const titleSim = Math.max(similarity(title, d.title), ...(d.alternative_titles ?? []).map((t) => similarity(title, t)));
      const authorSim = author ? Math.max(0, ...(d.author_names ?? []).map((a) => similarity(author, a))) : 0.5;
      return { d, s: titleSim + authorSim };
    })
    .sort((a, b) => b.s - a.s)[0];
  return best && best.s >= 1 ? best.d : null;
}

export async function getBookDetails(googleId: string, hint?: { author?: string | null }): Promise<Partial<NewItem>> {
  const v = await gbFetch<Volume>(`volumes/${googleId}`);
  const info = v.volumeInfo;
  const authors = info.authors ?? (hint?.author ? [hint.author] : []);
  const isbn =
    info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ??
    info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ??
    null;

  let hc: Awaited<ReturnType<typeof hardcoverSearch>> = null;
  try {
    hc = await hardcoverSearch(info.title, authors[0]);
  } catch {
    // Hardcover é opcional
  }

  const pages = info.pageCount || hc?.pages || null;
  const description = info.description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? null;

  return {
    kind: "book",
    googleBooksId: v.id,
    hardcoverSlug: hc?.slug ?? null,
    isbn,
    title: info.title,
    originalTitle: hc && hc.title !== info.title ? hc.title : null,
    year: hc?.release_year ?? yearOf(info.publishedDate),
    coverUrl: coverOf(v) ?? hc?.image?.url ?? null,
    overview: description,
    genres: (info.categories ?? []).flatMap((c) => c.split(" / ")).slice(0, 3),
    creators: authors,
    cast: (hc?.contributions ?? [])
      .filter((c) => c.author)
      .slice(0, 4)
      .map((c) => ({ name: c.author!.name, role: "Autor", photo: c.author!.image?.url ?? null })),
    pages,
    minutes: pages ? Math.round(pages * 1.2) : null,
    ratings: {
      hardcover: hc?.rating ? Math.round(hc.rating * 100) / 100 : null,
      hardcoverCount: hc?.ratings_count ?? null,
    },
  };
}
