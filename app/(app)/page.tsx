import Link from "next/link";
import { Rail } from "@/components/rail";
import { Tonight } from "@/components/tonight";
import { accessFor } from "@/lib/kinds";
import { listActiveItems, toLite, type LiteItem } from "@/lib/queries";
import { getProfile, requireUser } from "@/lib/session";

export const metadata = { title: "Início" };

const byScore = (a: LiteItem, b: LiteItem) => (b.score ?? 0) - (a.score ?? 0);

// Sorteio inicial feito no servidor (evita diferença de hidratação); prioriza quem tem arte
function initialDraw(items: LiteItem[], n: number) {
  const pool = items.filter((i) => i.coverUrl && (i.score ?? 0) >= 7);
  const src = pool.length >= n ? pool : items;
  return [...src].sort(() => Math.random() - 0.5).slice(0, n).map((i) => i.id);
}

export default async function Home() {
  const user = await requireUser();
  const [all, profile] = await Promise.all([listActiveItems(), getProfile(user.id)]);
  const items = all.map(toLite);
  const myProviders = profile?.providerIds ?? [];

  const mine = items.filter((i) => (i.kind === "movie" || i.kind === "series") && accessFor(i, myProviders).tier === "mine").sort(byScore);

  return (
    <div>
      <Tonight items={items} myProviders={myProviders} userId={user.id} userImage={user.image} initialIds={initialDraw(items, 9)} />

      <div className="mt-8 space-y-7">
        <Rail
          title="No seu streaming"
          href="/lista?f=mine"
          items={mine}
          myProviders={myProviders}
          empty={
            myProviders.length ? null : (
              <Link href="/ajustes" className="underline decoration-line underline-offset-4">
                Marque os serviços que você assina
              </Link>
            )
          }
        />
        <Rail title="Cabe numa noite" href="/lista?k=movie&sort=short" items={items.filter((i) => i.kind === "movie" && i.minutes && i.minutes <= 120).sort(byScore)} myProviders={myProviders} />
        <Rail title="Filmes" href="/lista?k=movie" items={items.filter((i) => i.kind === "movie").sort(byScore)} myProviders={myProviders} />
        <Rail title="Séries" href="/lista?k=series" items={items.filter((i) => i.kind === "series").sort(byScore)} myProviders={myProviders} />
        <Rail title="Jogos pra um fim de semana" href="/lista?k=game&sort=short" items={items.filter((i) => i.kind === "game" && i.minutes && i.minutes <= 720).sort(byScore)} myProviders={myProviders} />
        <Rail title="Switch" href="/lista?k=game&f=switch" items={items.filter((i) => i.kind === "game" && i.myPlatforms.includes("Switch")).sort(byScore)} myProviders={myProviders} />
        <Rail title="Em promoção na Steam" href="/lista?k=game&f=sale" items={items.filter((i) => (i.steamPrice?.discountPercent ?? 0) > 0).sort((a, b) => (b.steamPrice?.discountPercent ?? 0) - (a.steamPrice?.discountPercent ?? 0))} myProviders={myProviders} />
        <Rail title="Livros" href="/lista?k=book" items={items.filter((i) => i.kind === "book").sort(byScore)} myProviders={myProviders} />
        <Rail title="Livros curtos" href="/lista?k=book&sort=short" items={items.filter((i) => i.kind === "book" && i.pages && i.pages <= 250).sort(byScore)} myProviders={myProviders} />
        <Rail title="Adicionados recentemente" href="/lista?sort=recent" items={items.slice(0, 20)} myProviders={myProviders} />
      </div>
    </div>
  );
}
