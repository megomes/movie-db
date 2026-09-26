import { BottomNav } from "@/components/bottom-nav";
import { countReview } from "@/lib/queries";
import { requireUser } from "@/lib/session";

// Tudo aqui depende da sessão do usuário
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  const reviewCount = await countReview();
  return (
    <>
      <main className="mx-auto w-full max-w-5xl pb-nav pt-[env(safe-area-inset-top)]">{children}</main>
      <BottomNav reviewCount={reviewCount} />
    </>
  );
}
