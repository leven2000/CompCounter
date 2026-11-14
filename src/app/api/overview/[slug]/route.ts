import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildSnapshot, type Snapshot } from "@/lib/live";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/overview/[slug]">) {
  const { slug } = await ctx.params;
  const tournament = await db.tournament.findUnique({
    where: { slug },
    select: { areas: { select: { id: true }, orderBy: { order: "asc" } } },
  });
  if (!tournament) return Response.json({ areas: [] }, { status: 404 });
  const snapshots = await Promise.all(tournament.areas.map((a) => buildSnapshot(a.id)));
  return Response.json({ areas: snapshots.filter((s): s is Snapshot => s !== null) });
}
