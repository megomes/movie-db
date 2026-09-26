import { LogoMark } from "@/components/logo";
import { GoogleButton } from "@/components/google-button";

export const metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <LogoMark size={88} />
      <h1 className="mt-6 font-display text-4xl font-extrabold">Backlog</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-muted">Filmes, séries, jogos e livros que você quer ver, e onde encontrar cada um no Brasil.</p>
      <GoogleButton />
    </main>
  );
}
