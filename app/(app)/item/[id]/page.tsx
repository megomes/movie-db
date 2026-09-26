/* eslint-disable @next/next/no-img-element -- logos, fotos e fundos vêm de CDNs externos */
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { GlassButton } from "@/components/glass-button";
import { DoneButton, InterestToggle, ItemMenu, NotesEditor, PlatformToggle, WantButton } from "@/components/item-actions";
import type { Availability, CastMember, Item, Provider } from "@/lib/db/schema";
import { accessFor, formatMinutes, KIND_META } from "@/lib/kinds";
import { getItem, listPeople } from "@/lib/queries";
import { getProfile, requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/item/[id]">) {
  const item = await getItem((await params).id);
  return { title: item?.title ?? "Item" };
}

export default async function ItemPage({ params }: PageProps<"/item/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [item, profile, people] = await Promise.all([getItem(id), getProfile(user.id), listPeople()]);
  if (!item) notFound();
  const myProviders = profile?.providerIds ?? [];
  const access = accessFor(item, myProviders);
  const art = item.backdropUrl ?? item.coverUrl;
  const r = item.ratings ?? {};

  const length =
    item.kind === "book"
      ? item.pages && `${item.pages} páginas`
      : item.kind === "series"
        ? [item.seasons && `${item.seasons} temp.`, item.episodes && `${item.episodes} ep.`].filter(Boolean).join(" · ")
        : item.kind === "game"
          ? item.minutes && `~${formatMinutes(item.minutes, "game")} pra zerar`
          : formatMinutes(item.minutes, item.kind);

  // Nota principal em verde (como o "95% match" da referência)
  const main =
    r.imdb != null
      ? `IMDb ${r.imdb.toFixed(1)}`
      : r.igdb != null
        ? `IGDB ${r.igdb}`
        : r.hardcover != null
          ? `★ ${r.hardcover.toFixed(1)}`
          : r.tmdb != null
            ? `TMDB ${r.tmdb.toFixed(1)}`
            : null;

  const secondary = [
    r.rottenTomatoes != null && `Rotten Tomatoes ${r.rottenTomatoes}%`,
    r.metacritic != null && `Metacritic ${r.metacritic}`,
    r.igdbCritic != null && `Crítica ${r.igdbCritic}`,
    r.imdbVotes != null && `${Intl.NumberFormat("pt-BR", { notation: "compact" }).format(r.imdbVotes)} votos`,
    r.hardcoverCount != null && `${r.hardcoverCount} avaliações`,
  ].filter(Boolean) as string[];

  return (
    <article>
      {/* Preview grande, sem card */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-bg-2 sm:aspect-[21/9]">
        {art && <img src={art} alt="" className={`fade-in h-full w-full object-cover ${item.backdropUrl ? "" : "scale-110 blur-2xl brightness-50"}`} />}
        {!item.backdropUrl && item.coverUrl && (
          <img src={item.coverUrl} alt="" className="absolute bottom-6 left-1/2 h-[78%] -translate-x-1/2 rounded-lg object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-bg" />
        <div className="absolute inset-x-0 top-0 flex justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
          <GlassButton href="/lista" label="Voltar">
            <ChevronLeft size={22} />
          </GlassButton>
          <ItemMenu itemId={item.id} />
        </div>
      </div>

      <div className="space-y-6 px-4">
        <header>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-2">{KIND_META[item.kind].label}</p>
              <h1 className="mt-1 text-[24px] font-semibold leading-tight">{item.title}</h1>
              {item.originalTitle && item.originalTitle !== item.title && <p className="text-sm text-text-2">{item.originalTitle}</p>}
            </div>
            <WantButton itemId={item.id} initial={item.interestedIds.includes(user.id)} />
          </div>

          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-text-2">
            {main && <span className="font-medium text-success">{main}</span>}
            {item.year && <span>{item.year}</span>}
            {length && <span>{length}</span>}
            {item.kind === "game" && item.myPlatforms.length > 0 && <span>{item.myPlatforms.join(" · ")}</span>}
          </p>
          {secondary.length > 0 && <p className="mt-1 text-[13px] text-text-3">{secondary.join(" · ")}</p>}
          {access.tier !== "unknown" && item.kind !== "book" && (
            <p className={`mt-2 text-[14px] font-medium ${access.tier === "mine" ? "text-success" : "text-text"}`}>{access.label}</p>
          )}

          <DoneButton itemId={item.id} kind={item.kind} />
        </header>

        {(item.summary || item.overview) && (
          <section>
            <h2 className="mb-2 text-[20px] font-semibold">Sinopse</h2>
            {item.summary && <p className="text-[14px] leading-[1.5] text-text-2">{item.summary}</p>}
            {item.overview && item.overview !== item.summary && (
              <p className={`text-[14px] leading-[1.5] text-text-2 ${item.summary ? "mt-3 text-text-3" : ""}`}>{item.overview}</p>
            )}
            {(item.category || item.genres.length > 0) && (
              <p className="mt-3 text-[13px] text-text-3">{[item.category, ...item.genres].filter(Boolean).join(" · ")}</p>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[20px] font-semibold">{item.kind === "game" ? "Onde jogar" : item.kind === "book" ? "Onde encontrar" : "Onde assistir"}</h2>
          {(item.kind === "movie" || item.kind === "series") && <Providers availability={item.availability} myProviders={myProviders} />}
          {item.kind === "game" && <GameWhere item={item} />}
          {item.kind === "book" && <BookWhere item={item} />}
        </section>

        {item.cast.length > 0 && <Cast title={item.kind === "book" ? "Autoria" : "Elenco"} people={item.cast} />}
        {item.cast.length === 0 && item.creators.length > 0 && (
          <section>
            <h2 className="mb-1 text-[20px] font-semibold">{item.kind === "game" ? "Estúdio" : "Criação"}</h2>
            <p className="text-[14px] text-text-2">{item.creators.join(", ")}</p>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[20px] font-semibold">Quem quer</h2>
          <InterestToggle people={people} interestedIds={item.interestedIds} />
        </section>

        <section>
          <h2 className="mb-2 text-[20px] font-semibold">Notas</h2>
          <NotesEditor itemId={item.id} initial={item.notes ?? ""} />
        </section>

        {item.matchStatus !== "matched" && (
          <a href={`/revisar?item=${item.id}`} className="block text-sm text-text-2 underline decoration-line underline-offset-4">
            Não tenho certeza se é esse item. Conferir →
          </a>
        )}

        <p className="pb-6 text-[11px] leading-relaxed text-text-3">
          {item.kind === "movie" || item.kind === "series"
            ? "Disponibilidade por JustWatch via TMDB. Notas via OMDb."
            : item.kind === "game"
              ? "Dados via IGDB. Preço via Steam."
              : "Dados via Google Books. Nota via Hardcover."}
          {item.enrichedAt && ` Atualizado em ${item.enrichedAt.toLocaleDateString("pt-BR")}.`}
        </p>
      </div>
    </article>
  );
}

function Cast({ title, people }: { title: string; people: CastMember[] }) {
  return (
    <section>
      <h2 className="mb-3 text-[20px] font-semibold">{title}</h2>
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
        {people.map((p) => (
          <div key={`${p.name}-${p.role}`} className="w-[76px] shrink-0 text-center">
            <div className="mx-auto h-[52px] w-[52px] overflow-hidden rounded-full bg-bg-3">
              {p.photo && <img src={p.photo} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <p className="mt-1.5 truncate text-[12px] font-medium">{p.name}</p>
            {p.role && <p className="truncate text-[11px] text-text-2">{p.role}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Providers({ availability: a, myProviders }: { availability: Availability; myProviders: number[] }) {
  const groups: [string, Provider[] | undefined][] = [
    ["Streaming", a.flatrate],
    ["Grátis", [...(a.free ?? []), ...(a.ads ?? [])]],
    ["Alugar", a.rent],
    ["Comprar", a.buy],
  ];
  const any = groups.some(([, l]) => l?.length);
  return (
    <div className="space-y-4">
      {groups
        .filter(([, l]) => l?.length)
        .map(([label, list]) => (
          <div key={label}>
            <p className="mb-2 text-[13px] text-text-2">{label}</p>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {list!.map((p) => (
                <div key={p.id} className="w-14 shrink-0 text-center" title={p.name}>
                  <div className={`relative mx-auto h-12 w-12 overflow-hidden rounded-[10px] ${myProviders.includes(p.id) ? "ring-2 ring-success" : ""}`}>
                    {p.logo && <img src={p.logo} alt={p.name} className="h-full w-full object-cover" />}
                  </div>
                  <p className="mt-1 truncate text-[10px] text-text-2">{p.name}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      {!any && <p className="text-[14px] text-text-2">Nenhum serviço oferece no Brasil por enquanto. O app avisa quando aparecer.</p>}
      {a.link && (
        <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-text-2">
          Todas as opções <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function LinkPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="tap inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-[14px]">
      {children}
    </a>
  );
}

function GameWhere({ item }: { item: Item }) {
  const p = item.steamPrice;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {item.steamAppId && (
          <LinkPill href={`https://store.steampowered.com/app/${item.steamAppId}/`}>
            Steam {p?.isFree ? "· Grátis" : p?.formatted ? `· ${p.formatted}` : ""}
            {p?.discountPercent ? <span className="font-medium text-success">-{p.discountPercent}%</span> : null}
          </LinkPill>
        )}
        {item.myPlatforms.includes("Switch") && <LinkPill href={`https://www.nintendo.com/pt-br/search/#q=${encodeURIComponent(item.title)}`}>eShop</LinkPill>}
        {item.gamePass && <span className="inline-flex h-9 items-center rounded-full border border-success/50 px-4 text-[14px] text-success">Game Pass (nuvem)</span>}
      </div>
      <PlatformToggle itemId={item.id} current={item.myPlatforms} />
      {item.platforms.length > 0 && <p className="text-[13px] text-text-3">Lançado para {item.platforms.join(", ")}</p>}
    </div>
  );
}

function BookWhere({ item }: { item: Item }) {
  const q = encodeURIComponent([item.title, item.creators[0]].filter(Boolean).join(" "));
  return (
    <div className="flex flex-wrap gap-2">
      <LinkPill href={`https://www.amazon.com.br/s?k=${q}&i=stripbooks`}>Amazon</LinkPill>
      <LinkPill href={`https://www.amazon.com.br/s?k=${q}&i=digital-text`}>Kindle</LinkPill>
      <LinkPill href={`https://www.skoob.com.br/livro/lista/busca:${q}`}>Skoob</LinkPill>
      {item.hardcoverSlug && <LinkPill href={`https://hardcover.app/books/${item.hardcoverSlug}`}>Hardcover</LinkPill>}
    </div>
  );
}
