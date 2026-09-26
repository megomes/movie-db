import { searchAll } from "@/lib/search";
import { getUser } from "@/lib/session";

// Busca como rota GET (e não server action): server actions rodam em fila, então uma busca
// ficava esperando o "adicionar" anterior terminar. Aqui roda em paralelo e dá pra cancelar.
export async function GET(req: Request) {
  if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  try {
    return Response.json(await searchAll(url.searchParams.get("kind") ?? "any", url.searchParams.get("q") ?? ""));
  } catch {
    return Response.json({ error: "A busca falhou" }, { status: 502 });
  }
}
