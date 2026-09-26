import sharp from "sharp";
import { coverSrc } from "@/lib/img";

export type CoverInfo = { color: string; blur: string };

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

// Baixa a capa pequena e extrai cor dominante + miniatura borrada. Retorna null se a imagem
// for inválida (erro, "imagem indisponível" do Google, arquivo minúsculo).
export async function analyzeCover(url: string | null | undefined): Promise<CoverInfo | null> {
  const src = coverSrc(url, "sm");
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // "Imagem indisponível" do Google é minúscula; pixel art legítima (ex.: Undertale) também é leve
    if (buf.length < (src.includes("books.google.") ? 6000 : 800)) return null;
    const img = sharp(buf);
    const meta = await img.metadata();
    if (!meta.width || meta.width < 60) return null;
    const { dominant } = await img.stats();
    // Escurece um pouco a cor para funcionar como luz ambiente sobre fundo preto
    const color = `#${hex(dominant.r * 0.85)}${hex(dominant.g * 0.85)}${hex(dominant.b * 0.85)}`;
    const tiny = await sharp(buf).resize(12, 18, { fit: "cover" }).webp({ quality: 45 }).toBuffer();
    return { color, blur: `data:image/webp;base64,${tiny.toString("base64")}` };
  } catch {
    return null;
  }
}

// Capa alternativa para livros quando a do Google não presta
export async function fallbackBookCover(isbn: string | null, hardcoverImage?: string | null) {
  if (isbn) {
    const ol = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    const info = await analyzeCover(ol);
    if (info) return { url: ol.replace("?default=false", ""), info };
  }
  if (hardcoverImage) {
    const info = await analyzeCover(hardcoverImage);
    if (info) return { url: hardcoverImage, info };
  }
  return null;
}
