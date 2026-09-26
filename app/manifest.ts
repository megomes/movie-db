import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Backlog — filmes, séries, jogos e livros",
    short_name: "Backlog",
    description: "O que você quer ver, jogar e ler, e onde encontrar no Brasil.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070707",
    theme_color: "#070707",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "E agora?", url: "/" },
      { name: "Adicionar", url: "/adicionar" },
    ],
    // Compartilhar um link (IMDb, Letterboxd, Steam...) direto para o app no Android
    share_target: {
      action: "/adicionar",
      method: "get",
      params: { title: "title", text: "text", url: "url" },
    },
  } as MetadataRoute.Manifest;
}
