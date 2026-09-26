import { SignOutButton } from "@/components/settings";

export const metadata = { title: "Sem acesso" };

export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl font-extrabold">Lista fechada</h1>
      <p className="max-w-xs text-sm text-muted">Esse Backlog é só para algumas pessoas. Se você deveria ter acesso, peça para incluírem seu e-mail.</p>
      <SignOutButton />
    </main>
  );
}
