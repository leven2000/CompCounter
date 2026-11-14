import { db } from "@/lib/db";
import { resolveCode } from "@/lib/access";
import { judgeAction, publish, tableAction, type ActionResult } from "@/lib/live";

const reply = (result: ActionResult, status: number) =>
  Response.json({ ...result, now: Date.now() }, { status });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply({ ok: false, error: "Solicitud inválida" }, 400);
  }

  const access = await resolveCode(String(body.code ?? ""));
  if (!access) return reply({ ok: false, error: "Código inválido" }, 403);

  let areaId: string;
  let result: ActionResult;

  if (access.role === "TABLE") {
    const area = await db.area.findFirst({
      where: { id: String(body.areaId ?? ""), tournamentId: access.tournamentId },
      select: { id: true },
    });
    if (!area) return reply({ ok: false, error: "Área inválida" }, 400);
    areaId = area.id;
    result = await tableAction(areaId, body);
  } else {
    const area = await db.area.findFirst({
      where: { currentMatchId: access.matchId },
      select: { id: true },
    });
    if (!area) {
      return reply({ ok: false, error: "Esa pelea ya no está en la mesa. Pedí el código de la próxima." }, 409);
    }
    areaId = area.id;
    result = await judgeAction(areaId, access.seat, body);
  }

  if (result.ok) void publish(areaId);
  return reply(result, result.ok ? 200 : 409);
}
