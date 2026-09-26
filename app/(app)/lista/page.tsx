import { ListBrowser } from "@/components/list-browser";
import { listActiveItems, toLite } from "@/lib/queries";
import { getProfile, requireUser } from "@/lib/session";

export const metadata = { title: "Lista" };

export default async function ListPage() {
  const user = await requireUser();
  const [all, profile] = await Promise.all([listActiveItems(), getProfile(user.id)]);
  return <ListBrowser items={all.map(toLite)} myProviders={profile?.providerIds ?? []} userId={user.id} />;
}
