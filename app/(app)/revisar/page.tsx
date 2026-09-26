import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { ReviewCard } from "@/components/review-card";
import { db, items } from "@/lib/db";
import { listReviewItems } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Revisar" };

export default async function ReviewPage({ searchParams }: PageProps<"/revisar">) {
  await requireUser();
  const { item: only } = await searchParams;
  const single = typeof only === "string" && /^[0-9a-f-]{36}$/i.test(only);
  const rows = single ? await db.select().from(items).where(eq(items.id, only)) : await listReviewItems();

  return (
    <div>
      <PageHeader
        title={single ? "Trocar item" : "Revisar"}
        subtitle={
          single
            ? "Escolha a versão certa ou busque outra."
            : rows.length
              ? `${rows.length} itens em que não tive certeza.`
              : "Tudo revisado."
        }
      />
      <div className="divide-y divide-line border-t border-line">
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
            single={single}
          />
        ))}
      </div>
    </div>
  );
}
