import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/logo/[orgId]">) {
  const { orgId } = await ctx.params;
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { logo: true, logoType: true },
  });
  if (!org?.logo || !org.logoType) return new Response(null, { status: 404 });
  return new Response(Buffer.from(org.logo), {
    headers: {
      "Content-Type": org.logoType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
