import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { Avatar, Notice } from "@/components/bits";
import { ParticipantFields } from "@/components/ParticipantFields";
import { SubmitButton } from "@/components/ui";
import { updateParticipant } from "../../../../actions";

export default async function EditParticipantPage({
  params,
  searchParams,
}: PageProps<"/panel/torneos/[id]/participantes/[pid]">) {
  const { id, pid } = await params;
  const sp = await searchParams;
  const { scope } = await requireOrganizer();
  const p = await db.participant.findFirst({
    where: { id: pid, tournamentId: id, tournament: scope },
    include: { entries: { include: { category: { select: { name: true } } } } },
  });
  if (!p) notFound();
  const categories = await db.category.findMany({
    where: { tournamentId: id },
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });
  const back = `/panel/torneos/${id}/participantes`;

  return (
    <div className="max-w-4xl">
      <Link href={back} className="text-sm text-slate-500 hover:text-slate-800">
        ← Participantes
      </Link>
      <h2 className="mt-1 mb-4 text-lg font-semibold">
        {p.firstName} {p.lastName}
      </h2>
      <Notice sp={sp} />
      <form action={updateParticipant} className="card space-y-6">
        <input type="hidden" name="participantId" value={p.id} />
        <ParticipantFields
          values={p}
          categories={categories}
          selected={p.entries.map((e) => e.categoryId)}
          idPrefix="edit"
        />
        <div>
          <label className="label" htmlFor="photo">
            Foto (PNG, JPG o WebP, hasta 1 MB)
          </label>
          <div className="flex items-center gap-3">
            <Avatar id={p.id} version={p.photoVersion} className="h-14 w-14" />
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="input"
            />
          </div>
          {p.photoVersion > 0 && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="removePhoto" /> Quitar la foto actual
            </label>
          )}
        </div>
        {p.entries.length > 0 && (
          <fieldset>
            <legend className="label">Cabeza de serie</legend>
            <p className="mb-2 text-sm text-slate-500">
              Opcional. El 1 y el 2 quedan en mitades opuestas de la llave. Vacío significa sorteo.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {p.entries.map((e) => (
                <label key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{e.category.name}</span>
                  <input
                    name={`seed-${e.id}`}
                    inputMode="numeric"
                    defaultValue={e.seed ?? ""}
                    placeholder="—"
                    className="input w-20 py-1"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex gap-2">
          <SubmitButton>Guardar</SubmitButton>
          <Link href={back} className="btn">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
