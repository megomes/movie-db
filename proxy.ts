import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  matcher: [
    // Tudo, menos login, APIs públicas, assets e arquivos do PWA
    "/((?!api/auth|api/cron|auth|sem-acesso|_next/static|_next/image|icon|apple-icon|icons|covers|manifest.webmanifest|sw.js).*)",
  ],
};
