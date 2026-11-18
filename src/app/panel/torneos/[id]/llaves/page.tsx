import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { defaultLeaves } from "@/lib/bracket-core";
import { Notice } from "@/components/bits";
import { CategoryBracket } from "@/components/Bracket";
import { SubmitButton } from "@/components/ui";
import {
  buildBracket,
  clearOne,
  generateAll,
  generateOne,
  mergeCategories,
  saveBracketSettings,
  swapEntries,
} from "../../../actions";

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
      bracketFormat: true,
      roundRobinMax: true,
      thirdPlaceMatch: true,
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
  const mergeable = t.categories.filter((c) => !c.matches.some((m) => m.status === "LIVE" || m.status === "DONE"));

  return (
    <>
      <Notice sp={sp} />
      <form action={generateAll} className="card mb-4">
        <input type="hidden" name="tournamentId" value={t.id} />
        <h2 className="font-semibold">Cómo se generan las llaves</h2>
        <p className="mt-1 text-sm text-slate-500">
          Vale para todo el torneo. La llave separa a los competidores de la misma academia y respeta las
          cabezas de serie. Cada categoría puede usar otro formato desde su propia llave.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="bracket-format">
              Formato
            </label>
            <select id="bracket-format" name="format" defaultValue={t.bracketFormat} className="input w-64 py-1.5">
              <option value="AUTO">Automático, según los inscriptos</option>
              <option value="SINGLE">Siempre eliminación directa</option>
              <option value="ROUND_ROBIN">Siempre todos contra todos</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bracket-rr">
              En automático, todos contra todos hasta
            </label>
            <select id="bracket-rr" name="roundRobinMax" defaultValue={t.roundRobinMax} className="input w-64 py-1.5">
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} inscriptos
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="thirdPlaceMatch" defaultChecked={t.thirdPlaceMatch} />
            Pelea por el 3er puesto
          </label>
          <span className="ml-auto flex flex-wrap gap-2">
            <SubmitButton className="btn" formAction={saveBracketSettings}>
              Guardar formato
            </SubmitButton>
            <SubmitButton className="btn btn-primary">
              {pending === 1 ? "Generar la que falta" : pending > 1 ? `Generar las ${pending} que faltan` : "Generar las que faltan"}
            </SubmitButton>
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Todos contra todos se usa hasta 8 inscriptos; con más, la llave sale por eliminación directa.
        </p>
      </form>

      {mergeable.length >= 2 && (
        <details className="card mb-4">
          <summary className="font-semibold">Fusionar dos categorías en una sola llave</summary>
          <form action={mergeCategories} className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="merge-target">
                Sumar a
              </label>
              <select id="merge-target" name="targetId" className="input w-72 py-1.5">
                {mergeable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.entries.length})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="merge-source">
                los inscriptos de
              </label>
              <select id="merge-source" name="sourceId" defaultValue="" className="input w-72 py-1.5">
                <option value="">Elegí la otra categoría</option>
                {mergeable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.entries.length})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="merge-name">
                Nombre de la categoría fusionada
              </label>
              <input id="merge-name" name="name" maxLength={120} placeholder="Si lo dejás vacío, se unen los dos nombres" className="input w-72 py-1.5" />
            </div>
            <SubmitButton
              className="btn btn-sm"
              confirm="¿Fusionar las dos categorías? La segunda desaparece y se borran las llaves de las dos. No se puede deshacer."
            >
              Fusionar
            </SubmitButton>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Solo entre categorías de la misma disciplina y sin peleas jugadas. La segunda categoría deja de
            existir y sus inscriptos pasan a la primera.
          </p>
        </details>
      )}

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
            const fullName = (e: (typeof c.entries)[number]) =>
              `${e.participant.firstName} ${e.participant.lastName}`.trim();
            const firstRound = c.matches.filter((m) => m.round === 1 && m.label !== "3er puesto");
            const leaves =
              c.bracketFormat === "SINGLE" && firstRound.length > 0
                ? firstRound.flatMap((m) => [m.redEntryId, m.blueEntryId])
                : defaultLeaves(c.entries.map((e) => e.id));
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

                <div className="mt-4 flex flex-wrap items-end gap-2">
                  {!locked && (
                    <form action={generateOne} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="categoryId" value={c.id} />
                      <div>
                        <label className="label" htmlFor={`f-${c.id}`}>
                          Formato de esta llave
                        </label>
                        <select id={`f-${c.id}`} name="format" defaultValue={c.format} className="input w-56 py-1.5">
                          <option value="AUTO">El del torneo</option>
                          <option value="SINGLE">Eliminación directa</option>
                          <option value="ROUND_ROBIN">Todos contra todos</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 pb-2 text-sm">
                        <input
                          type="checkbox"
                          name="thirdPlaceMatch"
                          defaultChecked={c.thirdPlaceMatch || t.thirdPlaceMatch}
                          disabled={t.thirdPlaceMatch}
                        />
                        3er puesto
                      </label>
                      <SubmitButton
                        className="btn btn-sm"
                        confirm={c.matches.length > 0 ? "¿Volver a sortear esta llave?" : undefined}
                      >
                        {c.matches.length > 0 ? "Volver a sortear" : "Generar llave"}
                      </SubmitButton>
                    </form>
                  )}
                  {c.matches.length > 0 && !locked && (
                    <form action={clearOne}>
                      <input type="hidden" name="categoryId" value={c.id} />
                      <SubmitButton className="btn btn-sm btn-danger" confirm="¿Borrar esta llave?">
                        Borrar llave
                      </SubmitButton>
                    </form>
                  )}
                  {locked && (
                    <span className="self-center text-xs text-slate-500">
                      Ya tiene peleas jugadas: no se puede volver a sortear ni armar a mano.
                    </span>
                  )}
                </div>

                {!locked && c.entries.length >= 2 && (
                  <details className="mt-3 rounded-lg bg-slate-50 p-3">
                    <summary className="text-sm font-medium">Armar la llave a mano</summary>
                    <form action={buildBracket} className="mt-3">
                      <input type="hidden" name="categoryId" value={c.id} />
                      <input type="hidden" name="size" value={leaves.length} />
                      <p className="text-xs text-slate-500">
                        Elegí quién va en cada lugar de la primera ronda. Un solo competidor en una pelea es
                        pase libre. Los ganadores de las peleas 1 y 2 se cruzan, los de la 3 y la 4 también, y
                        así hasta la final. Queda por eliminación directa.
                      </p>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {Array.from({ length: leaves.length / 2 }, (_, pair) => (
                          <div key={pair} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="w-16 text-xs font-semibold uppercase text-slate-500">Pelea {pair + 1}</span>
                            {[0, 1].map((side) => (
                              <select
                                key={side}
                                name={`leaf-${pair * 2 + side}`}
                                defaultValue={leaves[pair * 2 + side] ?? ""}
                                aria-label={`Pelea ${pair + 1}, ${side === 0 ? "primer" : "segundo"} lugar`}
                                className="input w-52 py-1.5"
                              >
                                <option value="">Pase libre</option>
                                {c.entries.map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {fullName(e)}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <SubmitButton
                          className="btn btn-sm"
                          confirm={c.matches.length > 0 ? "¿Reemplazar la llave actual por esta?" : undefined}
                        >
                          Guardar llave a mano
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                )}

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
                            {fullName(e)}
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
                            {fullName(e)}
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
