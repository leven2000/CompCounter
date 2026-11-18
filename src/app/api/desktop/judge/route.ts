import { fromDesktopApp } from "@/lib/desktop-key";
import { buildSnapshot, judgeAction, publish } from "@/lib/live";

export async function POST(req: Request) {
  if (!fromDesktopApp(req)) return new Response(null, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
  }
  const areaId = String(body.areaId ?? "");
  const seat = Math.round(Number(body.seat));
  const corner = body.corner === "BLUE" ? "BLUE" : "RED";
  const value = Number(body.value) === -1 ? -1 : 1;

  let result = await judgeAction(areaId, seat, { action: "click", corner, value, clientId: body.clientId });
  if (!result.ok && value === 1) {
    const match = (await buildSnapshot(areaId))?.match;
    if (match?.status === "LIVE" && match.phase === "ENDED" && match.pendingDecisions.includes(seat)) {
      result = await judgeAction(areaId, seat, { action: "decision", corner });
    }
  }
  if (result.ok) void publish(areaId);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
