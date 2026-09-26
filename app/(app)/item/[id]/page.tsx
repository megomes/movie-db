/* eslint-disable @next/next/no-img-element -- logos e fundos vêm de CDNs externos */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Cover } from "@/components/cover";
import { ItemActions, InterestToggle, NotesEditor, PlatformToggle } from "@/components/item-actions";
import type { Availability, Item, Provider } from "@/lib/db/schema";
import { accessFor, formatMinutes, KIND_META, TIER_COLOR } from "@/lib/kinds";
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
  const meta = KIND_META[item.kind];
  const access = accessFor(item, myProviders);
  const length =
    item.kind === "book"
      ? item.pages && `${item.pages} páginas`
      : item.kind === "series"
        ? [item.seasons && `${item.seasons} temporada${item.seasons > 1 ? "s" : ""}`, item.episodes && `${item.episodes} ep.`].filter(Boolean).join(" · ")
        : item.kind === "game"
          ? item.minutes && `~${formatMinutes(item.minutes, "game")} pra zerar`
          : formatMinutes(item.minutes, item.kind);

  return (
    <article>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-72 overflow-hidden sm:h-96">
          {item.backdropUrl ? (
            <img src={item.backdropUrl} alt="" className="h-full w-full object-cover opacity-50" />
          ) : (
            <div className="h-full w-full" style={{ background: `radial-gradient(circle at 30% 0%, color-mix(in srgb, ${meta.color} 35%, transparent), transparent 70%)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/60 to-bg" />
        </div>

        <div className="relative px-4 pt-4">
          <Link href="/lista" className="inline-flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur" aria-label="Voltar">
            <ArrowLeft size={16} /> Lista
          </Link>

          <div className="mt-16 flex gap-4 sm:mt-28">
            <Cover src={item.coverUrl} title={item.title} kind={item.kind} eager className="w-32 shrink-0 shadow-2xl sm:w-44" />
            <div className="min-w-0 self-end pb-1">
              <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-bg" style={{ background: meta.color }}>
                {meta.label}
              </span>
              <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-4xl">{item.title}</h1>
              {item.originalTitle && item.originalTitle !== item.title && <p className="mt-0.5 text-sm text-muted">{item.originalTitle}</p>}
              <p className="mt-1.5 text-sm text-text/80">{[item.year, item.creators.slice(0, 2).join(", "), length].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-7 px-4 pt-6">
        <Ratings item={item} />

        <section>
          <SectionTitle>{item.kind === "game" ? "Onde jogar" : item.kind === "book" ? "Onde encontrar" : "Onde assistir no Brasil"}</SectionTitle>
          <p className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: TIER_COLOR[access.tier] }}>
            <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLOR[access.tier] }} />
            {access.label}
          </p>
          {(item.kind === "movie" || item.kind === "series") && <Providers availability={item.availability} myProviders={myProviders} />}
          {item.kind === "game" && <GameWhere item={item} />}
          {item.kind === "book" && <BookWhere item={item} />}
        </section>

        <ItemActions itemId={item.id} kind={item.kind} verb={meta.verb} />

        <section>
          <SectionTitle>Quem quer</SectionTitle>
          <InterestToggle itemId={item.id} people={people} interestedIds={item.interestedIds} userId={user.id} />
        </section>

        {(item.summary || item.overview) && (
          <section>
            <SectionTitle>Sobre</SectionTitle>
            {item.summary && <p className="mb-3 text-[15px] leading-relaxed text-text/90">{item.summary}</p>}
            {item.overview && item.overview !== item.summary && (
              <p className={`leading-relaxed ${item.summary ? "text-sm text-muted" : "text-[15px] text-text/90"}`}>{item.overview}</p>
            )}
          </section>
        )}

        {!!item.genres.length && (
          <div className="flex flex-wrap gap-1.5">
            {[item.category, ...item.genres].filter(Boolean).map((g) => (
              <span key={g} className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted ring-1 ring-line">
                {g}
              </span>
            ))}
          </div>
        )}

        <section>
          <SectionTitle>Suas notas</SectionTitle>
          <NotesEditor itemId={item.id} initial={item.notes ?? ""} />
        </section>

        {item.matchStatus !== "matched" && (
          <Link href={`/revisar#${item.id}`} className="block rounded-xl bg-warn/10 p-3 text-sm text-warn ring-1 ring-warn/30">
            Esse item ainda precisa de revisão. Confira se é o certo →
          </Link>
        )}

        <p className="pb-4 text-[11px] leading-relaxed text-muted/70">
          {item.kind === "movie" || item.kind === "series"
            ? "Disponibilidade por JustWatch via TMDB · notas via OMDb."
            : item.kind === "game"
              ? "Dados de jogos via IGDB · preço via Steam."
              : "Dados via Google Books · nota via Hardcover."}
          {item.enrichedAt && ` Atualizado em ${item.enrichedAt.toLocaleDateString("pt-BR")}.`}
        </p>
      </div>
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</h2>;
}

function Ratings({ item }: { item: Item }) {
  const r = item.ratings ?? {};
  const cells: { label: string; value: string; sub?: string; href?: string }[] = [];
  if (r.imdb != null)
    cells.push({
      label: "IMDb",
      value: r.imdb.toFixed(1),
      sub: r.imdbVotes ? `${Intl.NumberFormat("pt-BR", { notation: "compact" }).format(r.imdbVotes)} votos` : undefined,
      href: item.imdbId ? `https://www.imdb.com/title/${item.imdbId}/` : undefined,
    });
  if (r.rottenTomatoes != null) cells.push({ label: "Rotten Tomatoes", value: `${r.rottenTomatoes}%` });
  if (r.metacritic != null) cells.push({ label: "Metacritic", value: String(r.metacritic) });
  if (r.imdb == null && r.tmdb != null) cells.push({ label: "TMDB", value: r.tmdb.toFixed(1) });
  if (r.igdbCritic != null) cells.push({ label: "Crítica", value: String(r.igdbCritic) });
  if (r.igdb != null) cells.push({ label: "IGDB", value: String(r.igdb) });
  if (r.hardcover != null)
    cells.push({
      label: "Hardcover",
      value: r.hardcover.toFixed(2),
      sub: r.hardcoverCount ? `${r.hardcoverCount} notas` : undefined,
      href: item.hardcoverSlug ? `https://hardcover.app/books/${item.hardcoverSlug}` : undefined,
    });
  if (!cells.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((c) => {
        const body = (
          <>
            <p className="text-[11px] text-muted">{c.label}</p>
            <p className="font-display text-2xl font-extrabold tabular-nums text-accent">{c.value}</p>
            {c.sub && <p className="text-[10px] text-muted">{c.sub}</p>}
          </>
        );
        return c.href ? (
          <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="rounded-xl bg-surface p-3 ring-1 ring-line">
            {body}
          </a>
        ) : (
          <div key={c.label} className="rounded-xl bg-surface p-3 ring-1 ring-line">
            {body}
          </div>
        );
      })}
    </div>
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
    <div className="space-y-3">
      {groups
        .filter(([, l]) => l?.length)
        .map(([label, list]) => (
          <div key={label}>
            <p className="mb-1.5 text-xs text-muted">{label}</p>
            <div className="flex flex-wrap gap-2">
              {list!.map((p) => (
                <span
                  key={p.id}
                  title={p.name}
                  className={`flex items-center gap-2 rounded-xl bg-surface py-1 pl-1 pr-3 text-xs ring-1 ${myProviders.includes(p.id) ? "ring-ok" : "ring-line"}`}
                >
                  {p.logo && <img src={p.logo} alt="" className="h-7 w-7 rounded-lg" />}
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      {!any && <p className="text-sm text-muted">Nenhum serviço oferece no Brasil por enquanto. O app avisa quando aparecer.</p>}
      {a.link && (
        <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-info">
          Ver todas as opções <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function GameWhere({ item }: { item: Item }) {
  const p = item.steamPrice;
  return (
    <div className="space-y-3">
      <PlatformToggle itemId={item.id} current={item.myPlatforms} />
      {!!item.platforms.length && <p className="text-xs text-muted">Disponível em: {item.platforms.join(", ")}</p>}
      <div className="flex flex-wrap gap-2">
        {item.steamAppId && (
          <a href={`https://store.steampowered.com/app/${item.steamAppId}/`} target="_blank" rel="noreferrer" className="rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line">
            Steam {p?.isFree ? "· Grátis" : p?.formatted ? `· ${p.formatted}` : ""}
            {p?.discountPercent ? <span className="ml-1 font-semibold text-ok">-{p.discountPercent}%</span> : null}
          </a>
        )}
        {item.myPlatforms.includes("Switch") && (
          <a href={`https://www.nintendo.com/pt-br/search/#q=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer" className="rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line">
            eShop
          </a>
        )}
        {item.gamePass && <span className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok ring-1 ring-ok/30">Game Pass (nuvem)</span>}
      </div>
    </div>
  );
}

function BookWhere({ item }: { item: Item }) {
  const q = encodeURIComponent([item.title, item.creators[0]].filter(Boolean).join(" "));
  const links = [
    { label: "Amazon", href: `https://www.amazon.com.br/s?k=${q}&i=stripbooks` },
    { label: "Kindle", href: `https://www.amazon.com.br/s?k=${q}&i=digital-text` },
    { label: "Skoob", href: `https://www.skoob.com.br/livro/lista/busca:${q}` },
    item.googleBooksId && { label: "Google Books", href: `https://books.google.com.br/books?id=${item.googleBooksId}` },
  ].filter(Boolean) as { label: string; href: string }[];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line">
          {l.label}
        </a>
      ))}
    </div>
  );
}
