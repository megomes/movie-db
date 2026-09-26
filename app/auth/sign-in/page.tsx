/* eslint-disable @next/next/no-img-element -- ícone estático */
import { GoogleButton } from "@/components/google-button";

export const metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <img src="/icons/icon-192.png" alt="" width={96} height={96} className="h-24 w-24" />
      <h1 className="mt-5 text-[24px] font-semibold">Backlog</h1>
      <p className="mt-1.5 max-w-xs text-center text-[14px] leading-[1.45] text-text-2">
        Filmes, séries, jogos e livros que você quer ver, e onde encontrar cada um no Brasil.
      </p>
      <GoogleButton />
    </main>
  );
}
