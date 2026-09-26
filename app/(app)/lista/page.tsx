import { ListBrowser } from "@/components/list-browser";
import { listActiveItems, toLite } from "@/lib/queries";
import { getProfile, requireUser } from "@/lib/session";

export const metadata = { title: "Lista" };

export default async function ListPage({ searchParams }: PageProps<"/lista">) {
  const user = await requireUser();
  const [all, profile, sp] = await Promise.all([listActiveItems(), getProfile(user.id), searchParams]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return (
    <ListBrowser
      items={all.map(toLite)}
      myProviders={profile?.providerIds ?? []}
      userId={user.id}
      initial={{ kind: one(sp.k), filter: one(sp.f), sort: one(sp.sort) }}
    />
  );
}
