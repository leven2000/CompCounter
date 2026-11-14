import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { loadMesa } from "@/lib/mesa";
import { Avatar, Flag } from "@/components/bits";

export default async function MesaParticipantsPage({
  params,
  searchParams,
}: PageProps<"/mesa/[code]/competidores">) {
  const { code } = await params;
  const sp = await searchParams;
  const mesa = await loadMesa(code);
  if (!mesa) return null;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const where: Prisma.ParticipantWhereInput = { tournamentId: mesa.tournament.id };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { team: { contains: q, mode: "insensitive" } },
    ];
  }
  const participants = await db.participant.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { entries: { include: { category: { select: { name: true } } } } },
  });

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Competidores ({participants.length})</h1>
          <p className="mt-1 text-sm text-slate-500">
            Solo lectura. {participants.filter((p) => p.checkedIn).length} presentes.
          </p>
        </div>
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar nombre o equipo"
            aria-label="Buscar"
            className="input w-56 py-1.5"
          />
          <button className="btn btn-sm">Buscar</button>
        </form>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-slate-500">No hay competidores con ese filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Competidor</th>
                <th className="th">Equipo</th>
                <th className="th">Categorías</th>
                <th className="th">Peso</th>
                <th className="th">Presente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participants.map((p) => (
                <tr key={p.id}>
                  <td className="td">
                    <span className="flex items-center gap-2 font-medium">
                      <Avatar id={p.id} version={p.photoVersion} />
                      <Flag code={p.country} />
                      {`${p.firstName} ${p.lastName}`.trim()}
                    </span>
                  </td>
                  <td className="td text-slate-600">{p.team ?? "—"}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {p.entries.map((e) => (
                        <span key={e.id} className="badge">
                          {e.category.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="td tabular text-slate-600">
                    {p.weighIn != null ? `${p.weighIn} kg` : p.weight != null ? `${p.weight} kg decl.` : "—"}
                  </td>
                  <td className="td">{p.checkedIn ? "Sí" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
