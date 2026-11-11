/* eslint-disable @next/next/no-img-element -- artes e logos vêm do CDN do IGDB */
import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CalendarDays, ExternalLink, Gamepad2, HardDrive, Trophy } from "lucide-react";
import { Cover } from "@/components/cover";
import { BackButton, GameBacklogButton } from "@/components/game-actions";
import { Gallery, TrailerButton } from "@/components/media-gallery";
import { displayGenres } from "@/lib/genres";
import { artSrc } from "@/lib/img";
import { formatMinutes, formatSize } from "@/lib/kinds";
import { backlogByIgdb, listSwitchGames, switchTagId } from "@/lib/queries";
import { getIgdbDetails } from "@/lib/sources/igdb";
import { requireUser } from "@/lib/session";

// Detalhes de um jogo do IGDB que ainda não está no backlog (Descobrir, Meu Switch)
const getGame = unstable_cache(async (id: number) => getIgdbDetails(id).catch(() => null), ["igdb-game-v1"], { revalidate: 60 * 60 * 24 });

const parseId = (raw: string) => (/^\d+$/.test(raw) ? Number(raw) : null);

export async function generateMetadata({ params }: PageProps<"/jogo/[igdbId]">) {
  const id = parseId((await params).igdbId);
  const game = id ? await getGame(id) : null;
  return { title: game?.title ?? "Jogo" };
}

const compact = (n: number) => Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);

export default async function GamePage({ params }: PageProps<"/jogo/[igdbId]">) {
  const user = await requireUser();
  const id = parseId((await params).igdbId);
  if (!id) notFound();

  // Já está no backlog: a página completa do item é melhor
  const backlog = await backlogByIgdb(user.id, [id]);
  if (backlog[id]) redirect(`/item/${backlog[id].id}`);

  const [game, installed, tagId] = await Promise.all([getGame(id), listSwitchGames(user.id), switchTagId(user.id)]);
  if (!game?.title) notFound();
  const onSwitch = installed.find((g) => g.igdbId === id);
  const art = artSrc(game.backdropUrl, "lg");
  const r = game.ratings ?? {};
  const genres = displayGenres({ kind: "game", genres: game.genres ?? [], category: null }).slice(0, 4);
  const playTime = formatMinutes(game.minutes, "game");

  const stats = [
    r.igdb != null && { tone: "#9147ff", label: "IGDB", value: String(r.igdb), caption: r.igdbCount ? `${compact(r.igdbCount)} notas` : "IGDB" },
    r.igdbCritic != null && { icon: <Trophy size={15} />, value: String(r.igdbCritic), caption: "Crítica" },
    playTime && { icon: <Gamepad2 size={15} />, value: playTime, caption: "Pra zerar" },
    game.year && { icon: <CalendarDays size={15} />, value: String(game.year), caption: "Lançamento" },
    onSwitch && { icon: <HardDrive size={15} />, value: formatSize(onSwitch.sizeMb), caption: "No seu Switch", tone: "var(--success)" },
  ].filter(Boolean) as { tone?: string; label?: string; icon?: React.ReactNode; value: string; caption: string }[];

  return (
    <article className="relative">
      <section className="relative">
        <div className={`art-mask absolute inset-x-0 top-0 h-full overflow-hidden ${art ? "min-h-[62vh] lg:min-h-[92vh]" : ""}`}>
          {art ? <img src={art} alt="" className="ken-burns h-full w-full object-cover" /> : <div className="h-full w-full bg-[#101522]" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/40" />
          <div className="fade-left absolute inset-0 hidden lg:block" />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-4 pb-6 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-6 lg:px-10 lg:pb-10 lg:pt-28">
          <BackButton fallback="/switch/descobrir" />

          <div className={`flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-12 ${art ? "mt-[26vh] lg:mt-[34vh]" : "mt-6 lg:mt-8"}`}>
            <div className="w-[46%] max-w-[220px] shrink-0 lg:w-[260px] lg:max-w-none">
              <div className="rounded-3xl shadow-[0_30px_80px_rgb(0_0_0/0.65)]">
                <Cover item={{ id: String(id), title: game.title, kind: "game", coverUrl: game.coverUrl ?? null }} size="lg" eager rounded="rounded-3xl" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="glass rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">Jogo</span>
                {onSwitch && <span className="rounded-full bg-success/90 px-3 py-1 text-[12px] font-semibold text-black">Instalado no Switch</span>}
                {genres.map((g) => (
                  <span key={g} className="glass rounded-full px-3 py-1 text-[12px] text-white/80">
                    {g}
                  </span>
                ))}
              </div>
              {game.logoUrl ? (
                <>
                  <img src={game.logoUrl} alt={game.title} className="mt-5 max-h-[110px] w-auto max-w-[80%] object-contain object-left drop-shadow-[0_6px_30px_rgb(0_0_0/0.6)] lg:max-h-[150px] lg:max-w-[520px]" />
                  <h1 className="sr-only">{game.title}</h1>
                </>
              ) : (
                <h1 className="mt-4 text-[34px] font-bold leading-[1.02] tracking-tight lg:text-[58px]">{game.title}</h1>
              )}
              {!!game.creators?.length && <p className="mt-3 text-[15px] text-white/70">{game.creators.join(", ")}</p>}

              <div className="no-scrollbar -mx-4 mt-5 flex gap-2.5 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                {stats.map((s) => (
                  <div key={s.caption} className="glass flex min-w-[84px] shrink-0 flex-col items-start rounded-2xl px-3.5 py-3">
                    <span className="flex h-5 items-center gap-1 text-[12px] font-black tracking-tight" style={{ color: s.tone ?? "rgb(255 255 255 / 0.7)" }}>
                      {s.icon}
                      {s.label}
                    </span>
                    <span className="mt-1.5 text-[19px] font-bold tabular-nums leading-none">{s.value}</span>
                    <span className="mt-1 whitespace-nowrap text-[10.5px] text-white/50">{s.caption}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <GameBacklogButton igdbId={id} switchTagId={tagId} />
                {game.trailer && <TrailerButton videoId={game.trailer} title={game.title} />}
                <a
                  href={`https://www.nintendo.com/pt-br/search/#q=${encodeURIComponent(game.title)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="glass tap inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium hover:bg-white/5"
                >
                  eShop <ExternalLink size={13} className="text-white/45" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-[1400px] space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-10">
        {game.overview && (
          <section className="max-w-3xl">
            <h2 className="mb-4 text-[22px] font-bold tracking-tight">Sinopse</h2>
            <p className="text-[15px] leading-[1.7] text-white/75 lg:text-[16px]">{game.overview}</p>
          </section>
        )}
        <Gallery title="Screenshots" images={game.gallery ?? []} />
        {!!game.platforms?.length && <p className="text-[13px] text-white/45">Lançado para {game.platforms.join(", ")}. Dados via IGDB.</p>}
      </div>
    </article>
  );
}
