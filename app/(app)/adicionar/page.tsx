import { AddSearch } from "@/components/add-search";
import { PageHeader } from "@/components/page-header";
import { COLLECTIONS, FELIPE } from "@/lib/collections";
import { KINDS } from "@/lib/kinds";

export const metadata = { title: "Adicionar" };

// Também recebe o share target do PWA: /adicionar?title=...&text=...&url=...
export default async function AddPage({ searchParams }: PageProps<"/adicionar">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const shared = [one(sp.title), one(sp.text), one(sp.url)].join(" ");
  const imdbId = shared.match(/imdb\.com\/(?:[a-z-]+\/)?title\/(tt\d+)/i)?.[1] ?? null;
  const steamTitle = shared.match(/store\.steampowered\.com\/app\/\d+\/([^/?\s]+)/i)?.[1]?.replace(/_/g, " ") ?? null;
  // Tira URLs e sufixos comuns ("- IMDb", "| Letterboxd") do texto compartilhado
  const initialQuery =
    one(sp.q) ||
    steamTitle ||
    shared
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s*[-|–]\s*(IMDb|Letterboxd|Steam|Rotten Tomatoes|Goodreads|Skoob|Amazon.*)\s*$/i, "")
      .replace(/\s*\(\d{4}\)\s*/, " ")
      .trim();
  const k = KINDS.find((x) => x === one(sp.k));
  const initialKind = steamTitle ? "game" : (k ?? "any");
  // ?para=felipe: adiciona na lista compartilhada em vez do backlog pessoal
  const collection = one(sp.para) === "felipe" ? FELIPE : undefined;

  return (
    <div className="mx-auto max-w-[1400px]">
      {collection ? (
        <PageHeader title={COLLECTIONS[collection].title} subtitle="Busque no Google Books. O que entrar aparece pra todo mundo." />
      ) : (
        <PageHeader title="Adicionar" subtitle="Filmes, séries, jogos e livros numa busca só." />
      )}
      <div className="px-4 sm:px-6 lg:px-10">
        <AddSearch initialQuery={initialQuery} initialKind={collection ? "book" : initialKind} imdbId={collection ? null : imdbId} collection={collection} />
      </div>
    </div>
  );
}
