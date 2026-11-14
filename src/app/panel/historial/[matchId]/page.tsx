import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { loadMatchReport } from "@/lib/history";
import { MatchReport } from "@/components/MatchReport";

export default async function OrganizerMatchReportPage({
  params,
}: PageProps<"/panel/historial/[matchId]">) {
  const { matchId } = await params;
  const { scope } = await requireOrganizer();
  const data = await loadMatchReport(matchId, scope);
  if (!data) notFound();
  return <MatchReport data={data} backHref="/panel/historial" />;
}
