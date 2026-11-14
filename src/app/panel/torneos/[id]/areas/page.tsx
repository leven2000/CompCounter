import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ensureMesaCode } from "@/lib/access";
import { requireOrganizer } from "@/lib/auth";
import { boardLink, mesaLink, overviewLink, tvLink } from "@/lib/access-links";
import { baseUrl } from "@/lib/server-url";
import { AccessCard } from "@/components/AccessCard";
import { Notice } from "@/components/bits";
import { SubmitButton } from "@/components/ui";
import { createArea, deleteArea, regenerateMesaCode, updateArea } from "../../../actions";

export default async function AreasPage({
  params,
  searchParams,
}: PageProps<"/panel/torneos/[id]/areas">) {
  const { id } = await params;
  const sp = await searchParams;
  const { scope } = await requireOrganizer();
  const t = await db.tournament.findFirst({
    where: { id, AND: [scope] },
    select: {
      id: true,
      slug: true,
      areas: {
        orderBy: { order: "asc" },
        include: { categories: { select: { id: true, name: true }, orderBy: { order: "asc" } } },
      },
    },
  });
  if (!t) notFound();
  const [origin, mesaCode] = await Promise.all([baseUrl(), ensureMesaCode(t.id)]);

  return (
    <>
      <Notice sp={sp} />

      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-semibold">Mesa del torneo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Un solo código para todo el torneo. Quien lo tenga puede llamar peleas, manejar el reloj,
              cargar puntos y sanciones, declarar el ganador, y ver llaves, competidores y pantallas. Si
              hay varias áreas, cada operador elige la suya al entrar.
            </p>
          </div>
          <form action={regenerateMesaCode}>
            <input type="hidden" name="tournamentId" value={t.id} />
            <SubmitButton
              className="btn btn-sm"
              confirm="El código de mesa actual deja de funcionar para todos. ¿Generar uno nuevo?"
            >
              Nuevo código de mesa
            </SubmitButton>
          </form>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AccessCard link={mesaLink(origin, mesaCode)} />
          <AccessCard link={boardLink(origin, t.slug)} />
          <AccessCard link={overviewLink(origin, t.slug)} />
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <strong>Jueces:</strong> solo existen en las peleas de kickboxing con tarjetas (ring y light
          contact). Los códigos se generan para cada pelea cuando la mesa la llama, aparecen en la pantalla
          de la mesa con su QR y dejan de servir cuando la pelea termina.
        </p>
      </section>

      <div className="mt-8 mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Áreas ({t.areas.length})</h2>
          <p className="text-sm text-slate-500">Un área es un tatami o un ring, con su propia pantalla.</p>
        </div>
        <form action={createArea} className="flex items-end gap-2">
          <input type="hidden" name="tournamentId" value={t.id} />
          <div>
            <label className="label" htmlFor="new-area">
              Nueva área
            </label>
            <input id="new-area" name="name" placeholder={`Área ${t.areas.length + 1}`} className="input w-40" />
          </div>
          <div className="w-20">
            <label className="label" htmlFor="new-judges">
              Jueces
            </label>
            <input id="new-judges" name="judges" type="number" min={1} max={7} defaultValue={3} className="input" />
          </div>
          <SubmitButton>Agregar</SubmitButton>
        </form>
      </div>

      <div className="space-y-4">
        {t.areas.map((area) => (
          <section key={area.id} className="card">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <form action={updateArea} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="areaId" value={area.id} />
                <div>
                  <label className="label" htmlFor={`name-${area.id}`}>
                    Nombre
                  </label>
                  <input id={`name-${area.id}`} name="name" defaultValue={area.name} className="input w-48" />
                </div>
                <div>
                  <label className="label" htmlFor={`judges-${area.id}`}>
                    Jueces por pelea
                  </label>
                  <input
                    id={`judges-${area.id}`}
                    name="judges"
                    type="number"
                    min={1}
                    max={7}
                    defaultValue={area.judges}
                    className="input w-24"
                  />
                </div>
                <SubmitButton className="btn">Guardar</SubmitButton>
              </form>
              <form action={deleteArea}>
                <input type="hidden" name="areaId" value={area.id} />
                <SubmitButton className="btn btn-sm btn-danger" confirm={`¿Eliminar ${area.name}?`}>
                  Eliminar
                </SubmitButton>
              </form>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              <span className="font-medium">Categorías:</span>{" "}
              {area.categories.length === 0
                ? "ninguna asignada todavía. Asignalas desde la pestaña Categorías."
                : area.categories.map((c) => c.name).join(" · ")}
            </p>
            <div className="mt-4 max-w-md">
              <AccessCard link={tvLink(origin, area.id, area.name)} />
            </div>
          </section>
        ))}
        {t.areas.length === 0 && <p className="text-sm text-slate-500">Todavía no hay áreas.</p>}
      </div>
    </>
  );
}
