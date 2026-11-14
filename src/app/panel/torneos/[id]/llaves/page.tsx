import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { Notice } from "@/components/bits";
import { CategoryBracket } from "@/components/Bracket";
import { SubmitButton } from "@/components/ui";
import { clearOne, generateAll, generateOne, swapEntries } from "../../../actions";

export default async function BracketsPage({
  params,
  searchParams,
}: PageProps<"/panel/torneos/[id]/llaves">) {
  const { id } = await params;
  const sp = await searchParams;
  const { scope } = await requireOrganizer();
  const t = await db.tournament.findFirst({
    where: { id, AND: [scope] },
    select: {
      id: true,
      org: { select: { showFlags: true, showTeams: true } },
      categories: {
        orderBy: { order: "asc" },
        include: {
          area: { select: { name: true } },
          entries: { include: { participant: true } },
          matches: { orderBy: [{ round: "asc" }, { position: "asc" }] },
        },
      },
    },
  });
  if (!t) notFound();
  const openId = typeof sp.c === "string" ? sp.c : null;
  const pending = t.categories.filter((c) => c.matches.length === 0 && c.entries.length >= 2).length;

  return (
    <>
      <Notice sp={sp} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          La llave separa a los competidores de la misma academia y respeta las cabezas de serie. Con 2 o
          3 inscriptos, el formato automático es todos contra todos.
        </p>
        <form action={generateAll}>
          <input type="hidden" name="tournamentId" value={t.id} />
          <SubmitButton className="btn btn-primary">
            {pending === 1 ? "Generar la que falta" : pending > 1 ? `Generar las ${pending} que faltan` : "Generar las que faltan"}
          </SubmitButton>
        </form>
      </div>

      {t.categories.length === 0 ? (
        <p className="text-sm text-slate-500">Primero creá categorías.</p>
      ) : (
        <div className="space-y-3">
          {t.categories.map((c) => {
            const playable = c.matches.filter((m) => m.status !== "BYE");
            const played = playable.filter((m) => m.status === "DONE").length;
            const locked = c.matches.some((m) => m.status === "LIVE" || m.status === "DONE");
            const inBracket = new Set(c.matches.flatMap((m) => [m.redEntryId, m.blueEntryId]));
            const outside = c.matches.length > 0 ? c.entries.filter((e) => !inBracket.has(e.id)).length : 0;
            return (
              <details
                key={c.id}
                className="card"
                open={openId === c.id || (openId === null && t.categories.length <= 3)}
              >
                <summary className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{c.name}</span>
                  <span className="badge">{c.entries.length} inscriptos</span>
                  {c.area && <span className="badge">{c.area.name}</span>}
                  {c.matches.length === 0 ? (
                    <span className="badge bg-amber-100 text-amber-800">Sin llave</span>
                  ) : played === playable.length && playable.length > 0 ? (
                    <span className="badge bg-emerald-100 text-emerald-800">Terminada</span>
                  ) : (
                    <span className="badge bg-sky-100 text-sky-800">
                      {played} de {playable.length} peleas
                    </span>
                  )}
                  {outside > 0 && (
                    <span className="badge bg-red-100 text-red-800">
                      {outside} {outside === 1 ? "inscripto" : "inscriptos"} fuera de la llave
                    </span>
                  )}
                </summary>

                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={generateOne}>
                    <input type="hidden" name="categoryId" value={c.id} />
                    <SubmitButton
                      className="btn btn-sm"
                      confirm={c.matches.length > 0 ? "¿Volver a sortear esta llave?" : undefined}
                    >
                      {c.matches.length > 0 ? "Volver a sortear" : "Generar llave"}
                    </SubmitButton>
                  </form>
                  {c.matches.length > 0 && (
                    <form action={clearOne}>
                      <input type="hidden" name="categoryId" value={c.id} />
                      <SubmitButton className="btn btn-sm btn-danger" confirm="¿Borrar esta llave?">
                        Borrar llave
                      </SubmitButton>
                    </form>
                  )}
                  {locked && (
                    <span className="self-center text-xs text-slate-500">
                      Ya tiene peleas jugadas: no se puede volver a sortear.
                    </span>
                  )}
                </div>

                {c.matches.length > 0 && c.entries.length >= 2 && (
                  <form
                    action={swapEntries}
                    className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3"
                  >
                    <input type="hidden" name="categoryId" value={c.id} />
                    <div>
                      <label className="label" htmlFor={`a-${c.id}`}>
                        Intercambiar a
                      </label>
                      <select id={`a-${c.id}`} name="entryA" className="input w-56 py-1.5">
                        {c.entries.map((e) => (
                          <option key={e.id} value={e.id}>
                            {`${e.participant.firstName} ${e.participant.lastName}`.trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`b-${c.id}`}>
                        con
                      </label>
                      <select id={`b-${c.id}`} name="entryB" className="input w-56 py-1.5">
                        {c.entries.map((e) => (
                          <option key={e.id} value={e.id}>
                            {`${e.participant.firstName} ${e.participant.lastName}`.trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <SubmitButton className="btn btn-sm">Intercambiar lugares</SubmitButton>
                    <span className="text-xs text-slate-500">
                      Solo entre competidores que todavía no pelearon.
                    </span>
                  </form>
                )}

                <div className="mt-4">
                  <CategoryBracket
                    format={c.bracketFormat}
                    entries={c.entries}
                    matches={c.matches}
                    options={t.org}
                  />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
