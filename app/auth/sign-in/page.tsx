/* eslint-disable @next/next/no-img-element -- ícone estático e pôsteres da TMDB */
import { Dices, HeartHandshake, Tv } from "lucide-react";
import { GoogleButton } from "@/components/google-button";
import { trendingPosters } from "@/lib/sources/tmdb";

export const metadata = { title: "Entrar" };

const FEATURES = [
  { icon: Tv, title: "Onde assistir no Brasil", text: "Seus streamings, Game Pass e promoções" },
  { icon: Dices, title: "Sorteio pra indecisão", text: "Pelo tempo que você tem hoje" },
  { icon: HeartHandshake, title: "Juntos", text: "O que vocês dois querem ver" },
];

export default async function SignInPage() {
  const posters = await trendingPosters();
  // Colunas do mural, cada uma com um pedaço diferente da lista
  const cols = Array.from({ length: 7 }, (_, c) => posters.filter((_, i) => i % 7 === c));

  return (
    <main className="relative flex min-h-dvh items-end justify-center overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[42vh] sm:items-center sm:px-5 sm:py-10">
      {/* Mural de pôsteres em alta, inclinado, rolando devagar */}
      {posters.length > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 flex w-[190vw] -translate-x-1/2 -translate-y-1/2 -rotate-[10deg] gap-3 sm:w-[140vw] lg:w-[120vw] lg:gap-4">
            {cols.map((col, c) => (
              <div key={c} className={`wall-col flex min-w-0 flex-1 flex-col gap-3 lg:gap-4 ${c % 2 ? "wall-down" : ""}`} style={{ animationDuration: `${70 + (c % 3) * 14}s` }}>
                {[...col, ...col].map((src, i) => (
                  <img key={i} src={src} alt="" className="aspect-[2/3] w-full rounded-xl object-cover opacity-60 lg:rounded-2xl" />
                ))}
              </div>
            ))}
          </div>
          {/* Celular: pôsteres aparecem no topo; telas maiores: vinheta em volta do cartão */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(6_8_13/0.25)_0%,rgb(6_8_13/0.7)_38%,rgb(6_8_13/0.97)_60%)] sm:bg-[radial-gradient(ellipse_at_center,rgb(6_8_13/0.55)_0%,rgb(6_8_13/0.88)_55%,rgb(6_8_13/0.97)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg to-transparent" />
        </div>
      )}
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25 blur-[130px]" />

      <div className="rise relative w-full max-w-[420px]">
        <div className="glass-strong relative rounded-[34px] px-6 pb-7 pt-16 text-center sm:pt-9 shadow-[0_40px_120px_rgb(0_0_0/0.6)] sm:px-9">
          <img src="/icons/icon-512.png" alt="" width={112} height={112} className="absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_18px_44px_rgb(47_123_255/0.55)] sm:static sm:mx-auto sm:h-28 sm:w-28 sm:translate-x-0 sm:translate-y-0" />
          <h1 className="text-[40px] sm:mt-5 font-bold leading-none tracking-tight">Backlog</h1>
          <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-relaxed text-text-2">Filmes, séries, jogos e livros que você quer ver, num lugar só.</p>

          <GoogleButton />

          <ul className="mt-8 space-y-1 border-t border-white/10 pt-6 text-left">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3.5 rounded-2xl px-2 py-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-accent-2">
                  <Icon size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">{title}</span>
                  <span className="block text-[12.5px] text-text-2">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-5 text-center text-[12px] text-white/40">Acesso só para convidados.</p>
      </div>
    </main>
  );
}
