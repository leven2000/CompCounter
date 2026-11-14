import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { Avatar, Flag, Notice } from "@/components/bits";
import { ParticipantFields } from "@/components/ParticipantFields";
import { SubmitButton } from "@/components/ui";
import { createParticipant, deleteParticipant, importParticipants, saveWeighIn } from "../../../actions";

export default async function ParticipantsPage({
  params,
  searchParams,
}: PageProps<"/panel/torneos/[id]/participantes">) {
  const { id } = await params;
  const sp = await searchParams;
  const { scope } = await requireOrganizer();
  const t = await db.tournament.findFirst({
    where: { id, AND: [scope] },
    select: {
      id: true,
      categories: { select: { id: true, name: true }, orderBy: { order: "asc" } },
      _count: { select: { participants: true } },
    },
  });
  if (!t) notFound();

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const where: Prisma.ParticipantWhereInput = { tournamentId: t.id };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { team: { contains: q, mode: "insensitive" } },
    ];
  }
  if (cat) where.entries = { some: { categoryId: cat } };

  const participants = await db.participant.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      entries: {
        include: { category: { select: { name: true, weightMin: true, weightMax: true } } },
      },
    },
  });
  const present = participants.filter((p) => p.checkedIn).length;

  return (
    <>
      <Notice sp={sp} />

      <div className="grid gap-6 lg:grid-cols-2">
        <details className="card" open={t._count.participants === 0}>
          <summary className="font-semibold">Agregar participante</summary>
          <form action={createParticipant} className="mt-4 space-y-4">
            <input type="hidden" name="tournamentId" value={t.id} />
            <ParticipantFields categories={t.categories} idPrefix="new" />
            <SubmitButton>Agregar</SubmitButton>
          </form>
        </details>

        <details className="card">
          <summary className="font-semibold">Pegar una lista</summary>
          <p className="mt-2 text-sm text-slate-500">
            Una persona por línea, separando con punto y coma, coma o tabulador (podés pegar desde una
            planilla). Columnas, en este orden:
          </p>
          <p className="mt-2 rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-600">
            Nombre; Apellido; Equipo; País; Género; Año; Nivel; Peso; Categoría
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Solo nombre y apellido son obligatorios. La categoría tiene que coincidir con el nombre exacto.
          </p>
          <form action={importParticipants} className="mt-4 space-y-3">
            <input type="hidden" name="tournamentId" value={t.id} />
            <textarea
              name="rows"
              rows={6}
              required
              aria-label="Lista de participantes"
              placeholder={"Sofía; Paz; Team Norte; Argentina; Femenino; 2001; Azul; 62.4"}
              className="input font-mono text-xs"
            />
            <SubmitButton>Importar</SubmitButton>
          </form>
        </details>
      </div>

      <div className="mt-8 mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-semibold">
          Participantes ({participants.length}){" "}
          <span className="text-sm font-normal text-slate-500">· {present} presentes</span>
        </h2>
        <form className="flex flex-wrap gap-2" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar nombre o equipo"
            aria-label="Buscar"
            className="input w-52 py-1.5"
          />
          <select name="cat" defaultValue={cat} aria-label="Categoría" className="input w-56 py-1.5">
            <option value="">Todas las categorías</option>
            {t.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn-sm">Filtrar</button>
        </form>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-slate-500">No hay participantes con ese filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Competidor</th>
                <th className="th">Equipo</th>
                <th className="th">Nivel</th>
                <th className="th">Categorías</th>
                <th className="th">Pesaje y presente</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participants.map((p) => {
                const kg = p.weighIn ?? p.weight;
                return (
                  <tr key={p.id}>
                    <td className="td">
                      <span className="flex items-center gap-2 font-medium">
                        <Avatar id={p.id} version={p.photoVersion} />
                        <Flag code={p.country} />
                        {p.lastName}, {p.firstName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {[p.gender, p.birthYear, p.weight ? `${p.weight} kg decl.` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </td>
                    <td className="td text-slate-600">{p.team ?? "—"}</td>
                    <td className="td text-slate-600">{p.level ?? "—"}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {p.entries.length === 0 && <span className="text-xs text-amber-700">Sin categoría</span>}
                        {p.entries.map((e) => {
                          const c = e.category;
                          const out =
                            kg != null &&
                            ((c.weightMax != null && kg > c.weightMax) ||
                              (c.weightMin != null && kg <= c.weightMin));
                          return (
                            <span
                              key={e.id}
                              className={`badge ${out ? "bg-red-100 text-red-800" : ""}`}
                              title={out ? "El peso no entra en esta categoría" : undefined}
                            >
                              {c.name}
                              {out ? " · fuera de peso" : ""}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="td">
                      <form action={saveWeighIn} className="flex items-center gap-2">
                        <input type="hidden" name="participantId" value={p.id} />
                        <input
                          name="weighIn"
                          inputMode="decimal"
                          defaultValue={p.weighIn ?? ""}
                          placeholder="kg"
                          aria-label={`Peso en balanza de ${p.firstName} ${p.lastName}`}
                          className="input w-20 py-1"
                        />
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          <input type="checkbox" name="checkedIn" defaultChecked={p.checkedIn} />
                          Presente
                        </label>
                        <SubmitButton className="btn btn-sm">OK</SubmitButton>
                      </form>
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-2">
                        <Link href={`/panel/torneos/${t.id}/participantes/${p.id}`} className="btn btn-sm">
                          Editar
                        </Link>
                        <form action={deleteParticipant}>
                          <input type="hidden" name="participantId" value={p.id} />
                          <SubmitButton
                            className="btn btn-sm btn-danger"
                            confirm={`¿Eliminar a ${p.firstName} ${p.lastName}?`}
                          >
                            ✕
                          </SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
