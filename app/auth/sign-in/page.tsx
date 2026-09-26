/* eslint-disable @next/next/no-img-element -- ícone estático */
import { GoogleButton } from "@/components/google-button";

export const metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[380px] w-[380px] rounded-full bg-emerald-500/10 blur-[110px]" />
      <div className="rise relative flex flex-col items-center">
        <img src="/icons/icon-512.png" alt="" width={148} height={148} className="h-36 w-36 drop-shadow-[0_24px_60px_rgb(47_123_255/0.45)]" />
        <h1 className="mt-6 text-[44px] font-bold leading-none tracking-tight">Backlog</h1>
        <p className="mt-3 max-w-xs text-center text-[15px] leading-relaxed text-text-2">
          Filmes, séries, jogos e livros que você quer ver — e onde encontrar cada um no Brasil.
        </p>
        <GoogleButton />
      </div>
    </main>
  );
}
