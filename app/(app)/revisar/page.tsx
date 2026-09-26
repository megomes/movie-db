import { eq } from "drizzle-orm";
import { ReviewCard } from "@/components/review-card";
import { db, items } from "@/lib/db";
import { listReviewItems } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Revisar" };

export default async function ReviewPage({ searchParams }: PageProps<"/revisar">) {
  await requireUser();
  const { item: only } = await searchParams;
  const rows =
    typeof only === "string" && /^[0-9a-f-]{36}$/i.test(only)
      ? await db.select().from(items).where(eq(items.id, only))
      : await listReviewItems();

  return (
    <div className="px-4 pt-6">
      <h1 className="font-display text-3xl font-extrabold">{typeof only === "string" ? "Trocar item" : "Revisar"}</h1>
      <p className="mt-1 text-sm text-muted">
        {typeof only === "string"
          ? "Escolha a versão certa ou busque outra."
          : rows.length
            ? `${rows.length} itens em que eu não tive certeza. Confirme, escolha outro ou remova.`
            : "Tudo revisado. 🎉"}
      </p>
      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <ReviewCard
            key={r.id}
            item={{
              id: r.id,
              kind: r.kind,
              title: r.title,
              year: r.year,
              coverUrl: r.coverUrl,
              creators: r.creators,
              matchStatus: r.matchStatus,
              searchQuery: r.searchQuery ?? r.title,
              candidates: r.candidates,
              sourcePath: r.sourcePath,
            }}
            single={typeof only === "string"}
          />
        ))}
      </div>
    </div>
  );
}
