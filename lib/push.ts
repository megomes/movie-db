import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, pushSubscriptions } from "@/lib/db";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  // Contato para os serviços de push: "mailto:voce@exemplo.com" ou uma URL https
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string; image?: string | null };

export async function notifyUser(userId: string, payload: PushPayload) {
  if (!configure()) return { sent: 0 };
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // Inscrição expirada
        if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
      }
    }),
  );
  return { sent };
}
