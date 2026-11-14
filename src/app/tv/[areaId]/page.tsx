import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { brandSelect, toBrand } from "@/lib/brand";
import { TvBoard } from "@/components/live/TvBoard";

export default async function TvAreaPage({ params }: PageProps<"/tv/[areaId]">) {
  await connection();
  const { areaId } = await params;
  const area = await db.area.findUnique({
    where: { id: areaId },
    select: { id: true, tournament: { select: { org: { select: brandSelect } } } },
  });
  if (!area) notFound();
  return <TvBoard areaId={area.id} initialBrand={toBrand(area.tournament.org)} />;
}
