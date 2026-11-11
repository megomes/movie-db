import { redirect } from "next/navigation";

// Endereço antigo: o Descobrir agora tem várias plataformas
export default async function OldDiscoverPage({ searchParams }: PageProps<"/switch/descobrir">) {
  const { lista } = await searchParams;
  redirect(`/descobrir?plataforma=switch${typeof lista === "string" ? `&lista=${encodeURIComponent(lista)}` : ""}`);
}
