import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/photo/[participantId]">) {
  const { participantId } = await ctx.params;
  const photo = await db.participantPhoto.findUnique({ where: { participantId } });
  if (!photo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
