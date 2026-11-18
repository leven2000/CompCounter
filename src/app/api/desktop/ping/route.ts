import { fromDesktopApp } from "@/lib/desktop-key";

export async function GET(req: Request) {
  if (!fromDesktopApp(req)) return new Response(null, { status: 404 });
  return Response.json({ ok: true });
}
