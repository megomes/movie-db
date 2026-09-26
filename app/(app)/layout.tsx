import { AppShell } from "@/components/app-shell";
import { BacklogProvider } from "@/components/backlog-context";
import { listItems, listPeople, listShared, listTags, toLite } from "@/lib/queries";
import { getProfile, requireUser } from "@/lib/session";

// Tudo aqui depende da sessão do usuário
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [rows, profile, people, tags, shared] = await Promise.all([
    listItems(user.id),
    getProfile(user.id),
    listPeople(),
    listTags(user.id),
    listShared(user.id),
  ]);
  const items = rows.map(toLite);
  const reviewCount = rows.filter((r) => r.matchStatus !== "matched").length;

  return (
    <BacklogProvider
      items={items}
      me={{ id: user.id, name: user.name, email: user.email, image: user.image }}
      people={people.filter((p) => !p.email.endsWith(".test") || p.userId === user.id)}
      myProviders={profile?.providerIds ?? []}
      reviewCount={reviewCount}
      tags={tags}
      shared={shared}
    >
      <AppShell>{children}</AppShell>
    </BacklogProvider>
  );
}
