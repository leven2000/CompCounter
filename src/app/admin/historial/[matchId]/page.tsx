import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth";
import { loadMatchReport } from "@/lib/history";
import { MatchReport } from "@/components/MatchReport";

export default async function AdminMatchReportPage({ params }: PageProps<"/admin/historial/[matchId]">) {
  const { matchId } = await params;
  await requireSuperadmin();
  const data = await loadMatchReport(matchId);
  if (!data) notFound();
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <MatchReport data={data} backHref="/admin/historial" />
    </main>
  );
}
