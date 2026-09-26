import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo";

const SIZES = new Set([96, 180, 192, 512]);

export async function GET(req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  const maskable = new URL(req.url).searchParams.has("maskable");
  return new ImageResponse(<LogoMark size={size} padded={maskable || size === 180} />, {
    width: size,
    height: size,
    headers: { "cache-control": "public, max-age=604800, immutable" },
  });
}
