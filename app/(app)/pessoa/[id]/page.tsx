import { notFound } from "next/navigation";
import { ListBrowser } from "@/components/list-browser";
import { listItems, listPeople, toLite } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Backlog" };

// Backlog de outra pessoa, só leitura
export default async function PersonPage({ params }: PageProps<"/pessoa/[id]">) {
  await requireUser();
  const { id } = await params;
  const person = (await listPeople()).find((p) => p.userId === id);
  if (!person) notFound();
  const rows = await listItems(id);
  return <ListBrowser items={rows.map(toLite)} owner={{ name: person.name }} />;
}
