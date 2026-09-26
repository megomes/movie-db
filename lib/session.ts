import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db, profiles } from "@/lib/db";

const allowed = () =>
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const getUser = cache(async () => {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return null;
  return { id: user.id, email: user.email.toLowerCase(), name: user.name, image: user.image ?? null };
});

// Garante login + e-mail na lista de permitidos. Usar em toda página e server action.
export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/auth/sign-in");
  if (!allowed().includes(user.email)) redirect("/sem-acesso");
  await db
    .insert(profiles)
    .values({ userId: user.id, email: user.email, name: user.name, image: user.image })
    .onConflictDoNothing();
  return user;
});

export const getProfile = cache(async (userId: string) => {
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return p ?? null;
});
