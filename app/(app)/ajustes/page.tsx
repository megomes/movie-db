import { PushManager, ProviderPicker, SignOutButton } from "@/components/settings";
import { listBrProviders } from "@/lib/sources/tmdb";
import { getProfile, requireUser } from "@/lib/session";

export const metadata = { title: "Ajustes" };

// Lista de provedores muda pouco; guarda em memória por 1 dia
let cached: { at: number; list: Awaited<ReturnType<typeof listBrProviders>> } | null = null;
async function providers() {
  if (!cached || Date.now() - cached.at > 86_400_000) cached = { at: Date.now(), list: await listBrProviders() };
  return cached.list;
}

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, list] = await Promise.all([getProfile(user.id), providers()]);

  return (
    <div className="space-y-9 px-4 pt-6">
      <h1 className="font-display text-3xl font-extrabold">Ajustes</h1>

      <section>
        <h2 className="font-display text-lg font-semibold">Seus streamings</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Marque o que você assina. O app destaca o que já está liberado pra você e avisa quando algo da lista chegar.</p>
        <ProviderPicker providers={list.slice(0, 48).map(({ id, name, logo }) => ({ id, name, logo }))} selected={profile?.providerIds ?? []} />
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Notificações</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Aviso quando um item entra no seu streaming ou um jogo entra em promoção forte na Steam.</p>
        <PushManager vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Conta</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{user.email}</p>
        <SignOutButton />
      </section>
    </div>
  );
}
