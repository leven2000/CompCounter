import { requireOrganizer } from "@/lib/auth";
import { loadHistory } from "@/lib/history";
import { HistoryView } from "@/components/HistoryView";

export default async function OrganizerHistoryPage({ searchParams }: PageProps<"/panel/historial">) {
  const { scope } = await requireOrganizer();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const t = typeof sp.t === "string" ? sp.t : "";
  const data = await loadHistory({ scope, tournamentId: t || undefined, q });

  return (
    <>
      <h1 className="text-xl font-bold">Historial</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Todos tus torneos y cada pelea terminada, incluidos los combates sueltos, con su acta.
      </p>
      <HistoryView data={data} basePath="/panel/historial" filters={{ q, t, org: "" }} />
    </>
  );
}
