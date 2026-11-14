import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/auth";
import { loadHistory } from "@/lib/history";
import { HistoryView } from "@/components/HistoryView";

export default async function AdminHistoryPage({ searchParams }: PageProps<"/admin/historial">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const t = typeof sp.t === "string" ? sp.t : "";
  const org = typeof sp.org === "string" ? sp.org : "";

  const [orgs, data] = await Promise.all([
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    loadHistory({ scope: org ? { orgId: org } : undefined, tournamentId: t || undefined, q }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-xl font-bold">Historial de todos los organizadores</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Torneos y peleas terminadas de toda la plataforma. Filtrá por organizador para ver solo el suyo.
      </p>
      <HistoryView data={data} basePath="/admin/historial" filters={{ q, t, org }} orgs={orgs} />
    </main>
  );
}
