import { ProfileHeader } from "@/components/profile-view";
import { PushManager, ProviderPicker } from "@/components/settings";
import { TagManager } from "@/components/tag-manager";
import { listBrProviders } from "@/lib/sources/tmdb";
import { getProfile, requireUser } from "@/lib/session";

export const metadata = { title: "Perfil" };

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
    <div className="mx-auto max-w-[1100px] space-y-12 px-4 pb-10 pt-[calc(env(safe-area-inset-top)+20px)] sm:px-6 lg:px-10 lg:pt-28">
      <ProfileHeader />

      <section id="tags" className="scroll-mt-24">
        <h2 className="text-[22px] font-bold tracking-tight">Tags</h2>
        <p className="mb-5 mt-1 text-[14px] text-text-2">Suas categorias por divisão (ex.: consoles nos jogos, tipos de livro). Ao adicionar algo, o app sempre pergunta a tag.</p>
        <TagManager />
      </section>

      <section>
        <h2 className="text-[22px] font-bold tracking-tight">Seus streamings</h2>
        <p className="mb-5 mt-1 text-[14px] text-text-2">O que já está liberado pra você ganha destaque, e o app avisa quando algo do backlog chegar.</p>
        <ProviderPicker providers={list.slice(0, 48).map(({ id, name, logo }) => ({ id, name, logo }))} selected={profile?.providerIds ?? []} />
      </section>

      <section>
        <h2 className="text-[22px] font-bold tracking-tight">Notificações</h2>
        <p className="mb-5 mt-1 text-[14px] text-text-2">Quando um item entra no seu streaming ou um jogo fica 50% mais barato na Steam.</p>
        <PushManager vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      </section>
    </div>
  );
}
