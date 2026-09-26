import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Backlog — filmes, séries, jogos e livros",
    short_name: "Backlog",
    description: "O que você quer ver, jogar e ler, e onde encontrar no Brasil.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0b10",
    theme_color: "#0c0b10",
    lang: "pt-BR",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
