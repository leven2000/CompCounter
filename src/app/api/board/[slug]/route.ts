import type { NextRequest } from "next/server";
import { loadBoard } from "@/lib/board";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/board/[slug]">) {
  const { slug } = await ctx.params;
  const data = await loadBoard(slug);
  if (!data) return Response.json(null, { status: 404 });
  return Response.json(data);
}
