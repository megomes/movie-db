/* eslint-disable @next/next/no-img-element -- logos, fotos e fundos vêm de CDNs externos */
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, Clock, ExternalLink, FileText, Gamepad2, Star, Tag, Trophy } from "lucide-react";
import { Cover } from "@/components/cover";
import { AmbientColor, CopyButton, DoneButton, ItemMenu, ItemTags, NotesEditor, PinButton } from "@/components/item-actions";
import { Gallery, TrailerButton } from "@/components/media-gallery";
import { displayGenres } from "@/lib/genres";
import type { Availability, CastMember, Item, Provider } from "@/lib/db/schema";
import { artSrc, coverSrc } from "@/lib/img";
import { accessFor, formatMinutes, KIND_META } from "@/lib/kinds";
import { getItem, listPeople, listTags } from "@/lib/queries";
import { getProfile, requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/item/[id]">) {
  const item = await getItem((await params).id);
  return { title: item?.title ?? "Item" };
}

const compact = (n: number) => Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);

type Stat = { label: string; value: string; caption?: string; icon?: React.ReactNode; tone?: string; href?: string };

function statsFor(item: Item): Stat[] {
  const r = item.ratings ?? {};
  const s: Stat[] = [];
  if (r.imdb != null)
    s.push({
      label: "IMDb",
      value: r.imdb.toFixed(1),
      caption: r.imdbVotes ? `${compact(r.imdbVotes)} votos` : "IMDb",
      tone: "#f5c518",
      href: item.imdbId ? `https://www.imdb.com/title/${item.imdbId}/` : undefined,
    });
  if (r.rottenTomatoes != null) s.push({ label: "🍅", value: `${r.rottenTomatoes}%`, caption: "Rotten Tomatoes" });
  if (r.metacritic != null) s.push({ label: "MC", value: String(r.metacritic), caption: "Metacritic", tone: r.metacritic >= 61 ? "#67d87a" : "#ffd166" });
  if (r.imdb == null && r.tmdb != null) s.push({ label: "TMDB", value: r.tmdb.toFixed(1), caption: "TMDB", tone: "#01b4e4" });
  if (r.igdb != null) s.push({ label: "IGDB", value: String(r.igdb), caption: r.igdbCount ? `${compact(r.igdbCount)} notas` : "IGDB", tone: "#9147ff" });
  if (r.igdbCritic != null) s.push({ icon: <Trophy size={15} />, label: "", value: String(r.igdbCritic), caption: "Crítica" });
  if (r.hardcover != null)
    s.push({
      icon: <Star size={15} className="fill-current" />,
      label: "",
      value: r.hardcover.toFixed(2),
      caption: r.hardcoverCount ? `${compact(r.hardcoverCount)} leitores` : "Hardcover",
      tone: "#ffd166",
      href: item.hardcoverSlug ? `https://hardcover.app/books/${item.hardcoverSlug}` : undefined,
    });
  if (item.kind === "movie" && item.minutes) s.push({ icon: <Clock size={15} />, label: "", value: formatMinutes(item.minutes, "movie")!, caption: "Duração" });
  if (item.kind === "series" && item.seasons) s.push({ icon: <Tag size={15} />, label: "", value: String(item.seasons), caption: item.seasons > 1 ? "Temporadas" : "Temporada" });
  if (item.kind === "game" && item.minutes) s.push({ icon: <Gamepad2 size={15} />, label: "", value: formatMinutes(item.minutes, "game")!, caption: "Pra zerar" });
  if (item.kind === "book" && item.pages) s.push({ icon: <FileText size={15} />, label: "", value: String(item.pages), caption: "Páginas" });
  if (item.year) s.push({ icon: <CalendarDays size={15} />, label: "", value: String(item.year), caption: "Lançamento" });
  return s;
}

export default async function ItemPage({ params }: PageProps<"/item/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [item, profile, people, tags] = await Promise.all([getItem(id), getProfile(user.id), listPeople(), listTags(user.id)]);
  if (!item) notFound();
  const mine = item.ownerId === user.id;
  const owner = people.find((p) => p.userId === item.ownerId);
  const myProviders = profile?.providerIds ?? [];
  const access = accessFor(item, myProviders);
  const art = artSrc(item.backdropUrl, "lg");
  const stats = statsFor(item);
  const about = item.summary ?? item.overview;

  // Categoria do Obsidian agora é tag; aqui ficam só os gêneros das APIs
  // (sem repetir o que já aparece como tag, ex.: "Ficção" tag + "Ficção" gênero)
  const tagNames = new Set(tags.filter((t) => mine && item.tagIds.includes(t.id)).map((t) => t.name.toLowerCase()));
  const genres = displayGenres({ ...item, category: null })
    .filter((g) => !tagNames.has(g.toLowerCase()))
    .slice(0, 4);
  const coverThumb = coverSrc(item.coverUrl, "sm");

  return (
    <article className="relative">
      <AmbientColor color={item.coverColor} />

      {/* Topo: arte com máscara (sem emenda) e conteúdo alinhado ao pé */}
      <section className="relative">
        <div className={`art-mask absolute inset-x-0 top-0 h-full overflow-hidden ${art ? "min-h-[62vh] lg:min-h-[92vh]" : ""}`}>
          {art ? (
            <img src={art} alt="" className="ken-burns h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ backgroundColor: item.coverColor ?? "#101522" }}>
              {item.coverUrl && <img src={coverSrc(item.coverUrl, "sm")!} alt="" className="h-full w-full scale-125 object-cover opacity-60 blur-3xl saturate-150" />}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/40" />
          <div className="fade-left absolute inset-0 hidden lg:block" />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-4 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-6 lg:px-10 lg:pb-10 lg:pt-28">
          <Link href="/lista" className="glass tap inline-flex h-10 items-center gap-1 rounded-full pl-2.5 pr-4 text-[14px]">
            <ChevronLeft size={20} /> Voltar
          </Link>

          {/* Com arte de fundo, a capa desce pra deixar a arte aparecer; sem arte, não sobra vão vazio */}
          <div className={`flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-12 ${art ? "mt-[26vh] lg:mt-[34vh]" : "mt-6 lg:mt-8"}`}>
            <div className="w-[46%] max-w-[220px] shrink-0 lg:w-[260px] lg:max-w-none">
              <div className="rounded-3xl shadow-[0_30px_80px_rgb(0_0_0/0.65)]">
                <Cover
                  item={{ id: item.id, title: item.title, kind: item.kind, coverUrl: item.coverUrl, coverColor: item.coverColor, coverBlur: item.coverBlur }}
                  size="lg"
                  morph
                  eager
                  rounded="rounded-3xl"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              {!mine && owner && <p className="mb-2 text-[13px] font-medium text-accent-2">Do backlog de {owner.name?.split(" ")[0]}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <span className="glass rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">{KIND_META[item.kind].label}</span>
                <ItemTags itemId={item.id} kind={item.kind} title={item.title} cover={coverThumb} tagIds={mine ? item.tagIds : []} editable={mine} />
                {genres.map((g) => (
                  <span key={g} className="glass rounded-full px-3 py-1 text-[12px] text-white/80">
                    {g}
                  </span>
                ))}
              </div>
              {item.logoUrl ? (
                <>
                  <img src={item.logoUrl} alt={item.title} className="mt-5 max-h-[110px] w-auto max-w-[80%] object-contain object-left drop-shadow-[0_6px_30px_rgb(0_0_0/0.6)] lg:max-h-[150px] lg:max-w-[520px]" />
                  <h1 className="sr-only">{item.title}</h1>
                </>
              ) : (
                <h1 className="mt-4 text-[34px] font-bold leading-[1.02] tracking-tight lg:text-[58px]">{item.title}</h1>
              )}
              <p className="mt-3 text-[15px] text-white/70">
                {[item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : null, item.creators.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
              </p>

              <div className="no-scrollbar -mx-4 mt-5 flex gap-2.5 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                {stats.map((s) => {
                  const body = (
                    <>
                      <span className="flex h-5 items-center gap-1 text-[12px] font-black tracking-tight" style={{ color: s.tone ?? "rgb(255 255 255 / 0.7)" }}>
                        {s.icon}
                        {s.label}
                      </span>
                      <span className="mt-1.5 text-[19px] font-bold tabular-nums leading-none">{s.value}</span>
                      {s.caption && <span className="mt-1 whitespace-nowrap text-[10.5px] text-white/50">{s.caption}</span>}
                    </>
                  );
                  const cls = "glass flex min-w-[84px] shrink-0 flex-col items-start rounded-2xl px-3.5 py-3 transition-colors hover:bg-white/5";
                  return s.href ? (
                    <a key={s.caption} href={s.href} target="_blank" rel="noreferrer" className={cls}>
                      {body}
                    </a>
                  ) : (
                    <div key={s.caption} className={cls}>
                      {body}
                    </div>
                  );
                })}
              </div>

              {item.kind !== "book" && access.tier !== "unknown" && (
                <p className={`mt-4 flex items-center gap-2 text-[15px] font-medium ${access.tier === "mine" ? "text-success" : "text-white/85"}`}>
                  <span className={`h-2 w-2 rounded-full ${access.tier === "mine" ? "bg-success" : "bg-white/50"}`} /> {access.label}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {mine ? (
                  <>
                    <DoneButton itemId={item.id} kind={item.kind} />
                    {item.trailer && <TrailerButton videoId={item.trailer} title={item.title} />}
                    <PinButton itemId={item.id} initial={item.pinned} />
                    <ItemMenu itemId={item.id} />
                  </>
                ) : (
                  <>
                    <CopyButton itemId={item.id} kind={item.kind} title={item.title} cover={coverThumb} />
                    {item.trailer && <TrailerButton videoId={item.trailer} title={item.title} />}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-[1400px] space-y-12 px-4 pt-4 sm:px-6 lg:px-10">
        {about && (
          <section className="max-w-3xl">
            <SectionTitle>Sinopse</SectionTitle>
            <p className="text-[15px] leading-[1.7] text-white/75 lg:text-[16px]">{about}</p>
            {item.summary && item.overview && item.overview !== item.summary && (
              <details className="mt-3 text-[14px] text-white/55">
                <summary className="cursor-pointer select-none text-white/70 hover:text-white">Sinopse completa</summary>
                <p className="mt-2 leading-relaxed">{item.overview}</p>
              </details>
            )}
          </section>
        )}

        <Gallery title={item.kind === "game" ? "Screenshots" : "Cenas"} images={item.gallery} />

        <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-14">
          <div className="min-w-0 space-y-12">
            <section>
              <SectionTitle>{item.kind === "game" ? "Onde jogar" : item.kind === "book" ? "Onde encontrar" : "Assistir online"}</SectionTitle>
              {(item.kind === "movie" || item.kind === "series") && <Providers availability={item.availability} myProviders={myProviders} />}
              {item.kind === "game" && <GameWhere item={item} />}
              {item.kind === "book" && <BookWhere item={item} />}
            </section>
            {item.cast.length > 0 && <Cast title={item.kind === "book" ? "Autoria" : "Elenco"} people={item.cast} />}
          </div>

          <aside className="space-y-8">
            {mine && (
              <section>
                <SectionTitle>Suas notas</SectionTitle>
                <NotesEditor itemId={item.id} initial={item.notes ?? ""} />
              </section>
            )}
            {mine && item.matchStatus !== "matched" && (
              <Link href={`/revisar?item=${item.id}`} className="glass block rounded-2xl p-4 text-[14px] text-white/80 hover:bg-white/5">
                Não tenho certeza se é esse item. <span className="font-semibold text-accent-2">Conferir →</span>
              </Link>
            )}
            <p className="text-[11px] leading-relaxed text-white/35">
              {item.kind === "movie" || item.kind === "series"
                ? "Disponibilidade por JustWatch via TMDB. Notas via OMDb."
                : item.kind === "game"
                  ? "Dados via IGDB. Preço via Steam."
                  : "Dados via Google Books. Nota via Hardcover."}
              {item.enrichedAt && ` Atualizado em ${item.enrichedAt.toLocaleDateString("pt-BR")}.`}
            </p>
          </aside>
        </div>
      </div>
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-[22px] font-bold tracking-tight">{children}</h2>;
}

function Cast({ title, people }: { title: string; people: CastMember[] }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {people.map((p) => (
          <div key={`${p.name}-${p.role}`} className="w-[84px] shrink-0">
            <div className="h-[84px] w-[84px] overflow-hidden rounded-2xl bg-bg-3">
              {p.photo ? (
                <img src={p.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-[22px] font-bold text-white/30">{p.name[0]}</span>
              )}
            </div>
            <p className="mt-2 truncate text-[12.5px] font-semibold">{p.name}</p>
            {p.role && <p className="truncate text-[11px] text-white/50">{p.role}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProviderIcon({ p, mine, small = false }: { p: Provider; mine: boolean; small?: boolean }) {
  return (
    <div className={`shrink-0 text-center ${small ? "w-[48px] opacity-55 transition-opacity hover:opacity-100" : "w-[68px]"}`} title={p.name}>
      <div
        className={`relative mx-auto overflow-hidden shadow-lg ${small ? "h-10 w-10 rounded-xl" : "h-[60px] w-[60px] rounded-[18px]"} ${mine ? "ring-2 ring-success ring-offset-2 ring-offset-bg" : ""}`}
      >
        {p.logo && <img src={p.logo} alt={p.name} className="h-full w-full object-cover" />}
      </div>
      <p className={`mt-1.5 truncate text-white/60 ${small ? "text-[10px]" : "text-[11px]"}`}>{p.name}</p>
    </div>
  );
}

// Streaming (e grátis) em destaque; alugar/comprar menores e apagados, lado a lado
function Providers({ availability: a, myProviders }: { availability: Availability; myProviders: number[] }) {
  const main: [string, Provider[]][] = [
    ["Streaming", a.flatrate ?? []],
    ["Grátis", [...(a.free ?? []), ...(a.ads ?? [])]],
  ];
  const paid: [string, Provider[]][] = [
    ["Alugar", a.rent ?? []],
    ["Comprar", a.buy ?? []],
  ];
  const any = [...main, ...paid].some(([, l]) => l.length);
  return (
    <div className="space-y-5">
      {main
        .filter(([, l]) => l.length)
        .map(([label, list]) => (
          <div key={label}>
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-white/45">{label}</p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {list.map((p) => (
                <ProviderIcon key={p.id} p={p} mine={myProviders.includes(p.id)} />
              ))}
            </div>
          </div>
        ))}
      {paid.some(([, l]) => l.length) && (
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {paid
            .filter(([, l]) => l.length)
            .map(([label, list]) => (
              <div key={label} className="min-w-0">
                <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-white/30">{label}</p>
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                  {list.map((p) => (
                    <ProviderIcon key={p.id} p={p} mine={myProviders.includes(p.id)} small />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      {!any && <p className="glass rounded-2xl p-4 text-[14px] text-white/70">Nenhum serviço oferece no Brasil por enquanto. O app avisa quando aparecer.</p>}
      {a.link && (
        <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-white/55 hover:text-white">
          Todas as opções <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function LinkPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="glass tap inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium hover:bg-white/5">
      {children} <ExternalLink size={13} className="text-white/45" />
    </a>
  );
}

function GameWhere({ item }: { item: Item }) {
  const p = item.steamPrice;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {item.steamAppId && (
          <LinkPill href={`https://store.steampowered.com/app/${item.steamAppId}/`}>
            Steam {p?.isFree ? "· Grátis" : p?.formatted ? `· ${p.formatted}` : ""}
            {p?.discountPercent ? <span className="rounded-md bg-success px-1.5 text-[12px] font-bold text-black">-{p.discountPercent}%</span> : null}
          </LinkPill>
        )}
        {item.myPlatforms.includes("Switch") && <LinkPill href={`https://www.nintendo.com/pt-br/search/#q=${encodeURIComponent(item.title)}`}>eShop</LinkPill>}
        {item.gamePass && <span className="inline-flex h-11 items-center rounded-full bg-success/15 px-5 text-[14px] font-medium text-success">Game Pass (nuvem)</span>}
      </div>
      {item.platforms.length > 0 && <p className="text-[13px] text-white/45">Lançado para {item.platforms.join(", ")}</p>}
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
