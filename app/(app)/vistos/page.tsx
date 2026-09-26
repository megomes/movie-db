import { DoneView } from "@/components/done-view";
import { listDone } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Vistos" };

export default async function VistosPage() {
  const user = await requireUser();
  return <DoneView items={await listDone(user.id)} />;
}
