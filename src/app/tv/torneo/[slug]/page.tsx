import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { brandSelect, toBrand } from "@/lib/brand";
import { TvOverview } from "@/components/live/TvOverview";

export default async function TvTournamentPage({ params }: PageProps<"/tv/torneo/[slug]">) {
  await connection();
  const { slug } = await params;
  const t = await db.tournament.findUnique({
    where: { slug },
    select: { name: true, slug: true, org: { select: brandSelect } },
  });
  if (!t) notFound();
  return <TvOverview slug={t.slug} brand={toBrand(t.org)} tournamentName={t.name} />;
}
