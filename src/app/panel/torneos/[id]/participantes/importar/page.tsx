import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";
import { loadExisting } from "@/lib/import-data";
import { RULESETS } from "@/lib/rules";
import { ImportSheet } from "@/components/ImportSheet";

export default async function ImportPage({
  params,
}: PageProps<"/panel/torneos/[id]/participantes/importar">) {
  const { id } = await params;
  const { scope } = await requireOrganizer();
  const t = await db.tournament.findFirst({
    where: { id, AND: [scope] },
    select: { id: true, areas: { select: { id: true, name: true }, orderBy: { order: "asc" } } },
  });
  if (!t) notFound();
  const existing = await loadExisting(t.id);

  return (
    <>
      <Link href={`/panel/torneos/${t.id}/participantes`} className="text-sm text-slate-500 hover:text-slate-800">
        ← Participantes
      </Link>
      <h2 className="mt-2 text-lg font-semibold">Cargar competidores desde un Excel</h2>
      <p className="mt-1 mb-6 max-w-3xl text-sm text-slate-500">
        Subí la planilla de inscriptos y se crean solos los competidores, las categorías y las escuelas. Antes
        de guardar ves qué se va a cargar. Podés subir varias planillas o la misma corregida: quien ya está
        cargado no se duplica.
      </p>
      <ImportSheet
        tournamentId={t.id}
        existing={existing}
        areas={t.areas}
        rulesets={RULESETS.map((r) => ({ id: r.id, name: r.name, group: r.group }))}
        countries={COUNTRIES}
      />
    </>
  );
}
