import Link from "next/link";
import { Settings2 } from "lucide-react";
import { ItemCard } from "@/components/item-card";
import { Tonight } from "@/components/tonight";
import { accessFor } from "@/lib/kinds";
import { listActiveItems, toLite, type LiteItem } from "@/lib/queries";
import { getProfile, requireUser } from "@/lib/session";

export const metadata = { title: "E agora?" };

type Shelf = { title: string; hint?: string; items: LiteItem[] };

const byScore = (a: LiteItem, b: LiteItem) => (b.score ?? 0) - (a.score ?? 0);

export default async function Home() {
  const user = await requireUser();
  const [all, profile] = await Promise.all([listActiveItems(), getProfile(user.id)]);
  const items = all.map(toLite);
  const myProviders = profile?.providerIds ?? [];

  const av = items.filter((i) => i.kind === "movie" || i.kind === "series");
  const shelves: Shelf[] = [
    {
      title: "Nos seus streamings agora",
      hint: myProviders.length ? undefined : "Marque seus streamings em Ajustes",
      items: av.filter((i) => accessFor(i, myProviders).tier === "mine").sort(byScore),
    },
    { title: "Cabe numa noite", hint: "Filmes de até 2h", items: items.filter((i) => i.kind === "movie" && i.minutes && i.minutes <= 120).sort(byScore) },
    { title: "Jogos pra zerar num fim de semana", hint: "Até 12h de campanha", items: items.filter((i) => i.kind === "game" && i.minutes && i.minutes <= 720).sort(byScore) },
    { title: "Os mais bem avaliados", items: [...items].filter((i) => i.score != null).sort(byScore).slice(0, 20) },
    { title: "Livros curtos", hint: "Até 250 páginas", items: items.filter((i) => i.kind === "book" && i.pages && i.pages <= 250).sort(byScore) },
    { title: "Jogos em promoção na Steam", items: items.filter((i) => i.kind === "game" && (i.steamPrice?.discountPercent ?? 0) > 0).sort((a, b) => (b.steamPrice?.discountPercent ?? 0) - (a.steamPrice?.discountPercent ?? 0)) },
    { title: "Recém-adicionados", items: items.slice(0, 20) },
  ];

  return (
    <div className="px-4 pt-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold">E agora?</h1>
          <p className="mt-1 text-sm text-muted">
            {items.length} coisas esperando por você, {user.name?.split(" ")[0] ?? ""}.
          </p>
        </div>
        {!myProviders.length && (
          <Link href="/ajustes" className="mt-2 flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-muted ring-1 ring-line">
            <Settings2 size={14} /> Seus streamings
          </Link>
        )}
      </header>

      <Tonight items={items} myProviders={myProviders} userId={user.id} />

      <div className="mt-10 space-y-9">
        {shelves
          .filter((s) => s.items.length || s.hint)
          .map((s) => (
            <section key={s.title}>
              <div className="mb-3">
                <h2 className="font-display text-lg font-semibold leading-tight">{s.title}</h2>
                {s.hint && <p className="mt-0.5 text-xs text-muted">{s.hint}</p>}
              </div>
              {s.items.length ? (
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                  {s.items.slice(0, 24).map((i) => (
                    <div key={i.id} className="w-[31%] shrink-0 sm:w-36">
                      <ItemCard item={i} myProviders={myProviders} showKind />
                    </div>
                  ))}
                </div>
              ) : (
                <Link href="/ajustes" className="block rounded-xl border border-dashed border-line p-4 text-sm text-muted">
                  Escolha os serviços que você assina para ver o que já está liberado pra você.
                </Link>
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
