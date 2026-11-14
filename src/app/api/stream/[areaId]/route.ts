import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { resolveCode } from "@/lib/access";
import * as bus from "@/lib/bus";
import { buildSnapshot, publish } from "@/lib/live";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/stream/[areaId]">) {
  const { areaId } = await ctx.params;
  const code = req.nextUrl.searchParams.get("code") ?? "";

  let role: bus.LiveRole = "TV";
  let seat = 0;
  let matchId: string | null = null;

  if (code) {
    const access = await resolveCode(code);
    if (!access) return new Response("Código inválido", { status: 403 });
    const area = await db.area.findUnique({
      where: { id: areaId },
      select: { tournamentId: true, currentMatchId: true },
    });
    if (!area) return new Response("Área inexistente", { status: 404 });
    if (access.role === "TABLE") {
      if (area.tournamentId !== access.tournamentId) {
        return new Response("Código inválido", { status: 403 });
      }
      role = "TABLE";
    } else if (area.currentMatchId === access.matchId) {
      role = "JUDGE";
      seat = access.seat;
      matchId = access.matchId;
    }
  }

  const first = await buildSnapshot(areaId);
  if (!first) return new Response("Área inexistente", { status: 404 });

  const encoder = new TextEncoder();
  let clientId = 0;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    bus.removeClient(clientId);
    if (role !== "TV") void publish(areaId);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      send(JSON.stringify(first));
      clientId = bus.addClient({ areaId, role, seat, matchId, send });
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          close();
        }
      }, 20000);
      req.signal.addEventListener("abort", () => {
        close();
        try {
          controller.close();
        } catch {}
      });
      void publish(areaId);
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
