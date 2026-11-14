import { db } from "@/lib/db";
import { loadMesa } from "@/lib/mesa";
import { CategoryBracket } from "@/components/Bracket";
import { AutoRefresh } from "@/components/live/TvOverview";

export default async function MesaBracketsPage({ params }: PageProps<"/mesa/[code]/llaves">) {
  const { code } = await params;
  const mesa = await loadMesa(code);
  if (!mesa) return null;
  const categories = await db.category.findMany({
    where: { tournamentId: mesa.tournament.id },
    orderBy: { order: "asc" },
    include: {
      area: { select: { name: true } },
      entries: { include: { participant: true } },
      matches: { orderBy: [{ round: "asc" }, { position: "asc" }] },
    },
  });

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <AutoRefresh seconds={20} />
      <h1 className="text-xl font-bold">Llaves</h1>
      <p className="mt-1 mb-4 text-sm text-slate-500">
        Solo lectura. Para volver a sortear o intercambiar competidores, el organizador lo hace desde su
        panel.
      </p>
      {categories.length === 0 ? (
        <p className="text-sm text-slate-500">No hay categorías.</p>
      ) : (
        <div className="space-y-3">
          {categories.map((c) => {
            const playable = c.matches.filter((m) => m.status !== "BYE");
            const played = playable.filter((m) => m.status === "DONE").length;
            return (
              <details key={c.id} className="card" open={categories.length <= 2}>
                <summary className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{c.name}</span>
                  <span className="badge">{c.entries.length} inscriptos</span>
                  {c.area && <span className="badge">{c.area.name}</span>}
                  {playable.length > 0 && (
                    <span className="badge bg-sky-100 text-sky-800">
                      {played} de {playable.length} peleas
                    </span>
                  )}
                </summary>
                <div className="mt-4">
                  <CategoryBracket
                    format={c.bracketFormat}
                    entries={c.entries}
                    matches={c.matches}
                    options={mesa.brand}
                  />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </main>
  );
}
