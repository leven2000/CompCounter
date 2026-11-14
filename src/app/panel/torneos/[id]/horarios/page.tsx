import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { Notice } from "@/components/bits";
import { SubmitButton } from "@/components/ui";
import { clearSchedule, scheduleArea, setMatchTime } from "../../../actions";

const person = { select: { firstName: true, lastName: true } } as const;
const fullName = (p?: { firstName: string; lastName: string } | null) =>
  p ? `${p.firstName} ${p.lastName}`.trim() : "Por definir";
const inputValue = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : "");

const STATUS: Record<string, string> = {
  PENDING: "Por definir",
  READY: "En espera",
  LIVE: "En la mesa",
  DONE: "Terminada",
};

export default async function SchedulePage({
  params,
  searchParams,
}: PageProps<"/panel/torneos/[id]/horarios">) {
  const { id } = await params;
  const sp = await searchParams;
  const { scope } = await requireOrganizer();
  const t = await db.tournament.findFirst({
    where: { id, AND: [scope] },
    select: {
      id: true,
      date: true,
      areas: { select: { id: true, name: true }, orderBy: { order: "asc" } },
    },
  });
  if (!t) notFound();

  const matches = await db.match.findMany({
    where: { category: { tournamentId: t.id }, status: { not: "BYE" } },
    include: {
      category: { select: { name: true, areaId: true } },
      red: { include: { participant: person } },
      blue: { include: { participant: person } },
    },
    orderBy: [
      { scheduledAt: { sort: "asc", nulls: "last" } },
      { depth: "desc" },
      { category: { order: "asc" } },
      { round: "asc" },
      { position: "asc" },
    ],
  });
  const defaultStart = `${(t.date ?? new Date()).toISOString().slice(0, 10)}T09:00`;
  const unassigned = matches.filter((m) => !m.category.areaId).length;

  return (
    <>
      <Notice sp={sp} />
      <p className="mb-6 max-w-3xl text-sm text-slate-500">
        Los horarios son la hora del lugar del torneo. Podés calcularlos de una vez por área: se toma el
        orden de la llave y la duración de cada categoría (rounds, descansos y el cambio entre peleas).
        Después corregí a mano la pelea que quieras. Aparecen en la mesa y en la cartelera, y ordenan la
        lista de espera.
      </p>

      {t.areas.length === 0 && <p className="text-sm text-slate-500">Primero creá un área.</p>}
      {unassigned > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Hay {unassigned} peleas de categorías sin área asignada. Asignales un área en la pestaña
          Categorías para poder programarlas.
        </p>
      )}

      <div className="space-y-6">
        {t.areas.map((area) => {
          const rows = matches.filter((m) => m.category.areaId === area.id);
          return (
            <section key={area.id} className="card">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-semibold">
                  {area.name} <span className="font-normal text-slate-500">· {rows.length} peleas</span>
                </h2>
                <div className="flex flex-wrap items-end gap-2">
                  <form action={scheduleArea} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="areaId" value={area.id} />
                    <div>
                      <label className="label" htmlFor={`start-${area.id}`}>
                        Empieza
                      </label>
                      <input
                        id={`start-${area.id}`}
                        name="start"
                        type="datetime-local"
                        defaultValue={defaultStart}
                        required
                        className="input"
                      />
                    </div>
                    <div className="w-32">
                      <label className="label" htmlFor={`gap-${area.id}`}>
                        Cambio (min)
                      </label>
                      <input
                        id={`gap-${area.id}`}
                        name="gap"
                        type="number"
                        min={0}
                        max={60}
                        defaultValue={2}
                        className="input"
                      />
                    </div>
                    <SubmitButton
                      confirm={
                        rows.some((m) => m.scheduledAt) ? "Se van a recalcular los horarios de esta área." : undefined
                      }
                    >
                      Calcular horarios
                    </SubmitButton>
                  </form>
                  <form action={clearSchedule}>
                    <input type="hidden" name="areaId" value={area.id} />
                    <SubmitButton className="btn" confirm={`¿Borrar los horarios de ${area.name}?`}>
                      Borrar
                    </SubmitButton>
                  </form>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No hay peleas: asigná categorías a esta área y generá sus llaves.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="th">Horario</th>
                        <th className="th">Pelea</th>
                        <th className="th">Competidores</th>
                        <th className="th">Categoría</th>
                        <th className="th">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((m) => (
                        <tr key={m.id} className={m.status === "DONE" ? "opacity-50" : undefined}>
                          <td className="td">
                            <form action={setMatchTime} className="flex items-center gap-2">
                              <input type="hidden" name="matchId" value={m.id} />
                              <input
                                name="time"
                                type="datetime-local"
                                defaultValue={inputValue(m.scheduledAt)}
                                aria-label={`Horario de la pelea ${m.number}`}
                                className="input w-52 py-1"
                              />
                              <SubmitButton className="btn btn-sm">OK</SubmitButton>
                            </form>
                          </td>
                          <td className="td tabular text-slate-600">#{m.number}</td>
                          <td className="td font-medium">
                            {fullName(m.red?.participant)} <span className="text-slate-400">vs</span>{" "}
                            {fullName(m.blue?.participant)}
                          </td>
                          <td className="td text-slate-600">
                            {m.category.name}
                            {m.label ? ` · ${m.label}` : ""}
                          </td>
                          <td className="td text-slate-600">{STATUS[m.status] ?? m.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
