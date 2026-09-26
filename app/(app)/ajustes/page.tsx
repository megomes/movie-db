/* eslint-disable @next/next/no-img-element -- avatar do Google */
import { PageHeader } from "@/components/page-header";
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
    <div>
      <PageHeader title="Ajustes" />
      <div className="space-y-8 px-4">
        <section className="flex items-center gap-3">
          <div className="h-[52px] w-[52px] overflow-hidden rounded-full bg-bg-3">
            {user.image && <img src={user.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{user.name}</p>
            <p className="truncate text-[13px] text-text-2">{user.email}</p>
          </div>
          <SignOutButton />
        </section>

        <section>
          <h2 className="text-[20px] font-semibold">Seus streamings</h2>
          <p className="mb-4 mt-1 text-[14px] text-text-2">O que já está liberado pra você ganha destaque, e o app avisa quando algo da lista chegar.</p>
          <ProviderPicker providers={list.slice(0, 48).map(({ id, name, logo }) => ({ id, name, logo }))} selected={profile?.providerIds ?? []} />
        </section>

        <section className="pb-6">
          <h2 className="text-[20px] font-semibold">Notificações</h2>
          <p className="mb-4 mt-1 text-[14px] text-text-2">Quando um item entra no seu streaming ou um jogo fica 50% mais barato na Steam.</p>
          <PushManager vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
        </section>
      </div>
    </div>
  );
}
