import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ensureMatchJudges, resolveCode } from "@/lib/access";
import { qrSvg } from "@/lib/access-links";
import { getRuleset } from "@/lib/rules";
import { baseUrl } from "@/lib/server-url";

export async function GET(req: NextRequest) {
  const access = await resolveCode(req.nextUrl.searchParams.get("code") ?? "");
  if (!access || access.role !== "TABLE") {
    return Response.json({ judges: [] }, { status: 403 });
  }
  const area = await db.area.findFirst({
    where: { id: req.nextUrl.searchParams.get("areaId") ?? "", tournamentId: access.tournamentId },
    select: {
      judges: true,
      currentMatch: { select: { id: true, status: true, category: { select: { ruleset: true } } } },
    },
  });
  const match = area?.currentMatch;
  if (!area || !match || getRuleset(match.category.ruleset).mode !== "judges") {
    return Response.json({ matchId: match?.id ?? null, judges: [] });
  }

  const origin = await baseUrl();
  const rows = await ensureMatchJudges(match.id, area.judges);
  const judges = await Promise.all(
    rows.map(async (row) => {
      const url = `${origin}/juez/${row.code}`;
      return { seat: row.seat, code: row.code, url, qr: await qrSvg(url) };
    }),
  );
  return Response.json({ matchId: match.id, judges });
}
