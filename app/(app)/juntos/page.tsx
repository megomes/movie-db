import { JuntosView } from "@/components/juntos-view";
import { listItems, listShared, toLite } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Juntos" };

export default async function JuntosPage() {
  const user = await requireUser();
  const shared = await listShared(user.id);
  // Pra cada pessoa: o que ela quer ver e você ainda não tem (melhores notas primeiro)
  const others = await Promise.all(
    shared.map(async (p) => {
      const theirs = await listItems(p.userId);
      const onlyTheirs = theirs
        .filter((i) => !p.theirIds.includes(i.id))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 24)
        .map(toLite);
      return { userId: p.userId, onlyTheirs };
    }),
  );
  return <JuntosView discover={Object.fromEntries(others.map((o) => [o.userId, o.onlyTheirs]))} />;
}
