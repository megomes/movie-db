import { and, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { ReviewStack } from "@/components/review-stack";
import { COLLECTIONS } from "@/lib/collections";
import { db, items } from "@/lib/db";
import { listReviewItems } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Revisar" };

export default async function ReviewPage({ searchParams }: PageProps<"/revisar">) {
  const user = await requireUser();
  const { item: only } = await searchParams;
  const single = typeof only === "string" && /^[0-9a-f-]{36}$/i.test(only);
  const rows = single
    ? await db.select().from(items).where(and(eq(items.id, only), inArray(items.ownerId, [user.id, ...Object.keys(COLLECTIONS)])))
    : await listReviewItems(user.id);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={single ? "Trocar item" : "Revisar"}
        subtitle={single ? "Escolha a versão certa ou busque outra." : rows.length ? "Itens do Obsidian em que eu não tive certeza." : undefined}
      />
      <div className="px-4">
        <ReviewStack
          single={single}
          items={rows.map((r) => ({
            id: r.id,
            kind: r.kind,
            title: r.title,
            year: r.year,
            coverUrl: r.coverUrl,
            coverColor: r.coverColor,
            coverBlur: r.coverBlur,
            creators: r.creators,
            matchStatus: single ? "needs_review" : r.matchStatus,
            searchQuery: r.searchQuery ?? r.title,
            candidates: r.candidates,
          }))}
        />
      </div>
    </div>
  );
}
