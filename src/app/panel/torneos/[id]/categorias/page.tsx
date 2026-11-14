import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { getRuleset } from "@/lib/rules";
import { weightLabel } from "@/lib/util";
import { Notice } from "@/components/bits";
import { mmss, RuleFields } from "@/components/RuleFields";
import { AutoSubmitSelect, SubmitButton } from "@/components/ui";
import {
  assignArea,
  createCategory,
  deleteCategory,
  generateCategories,
  updateCategory,
} from "../../../actions";

const GENDERS = ["Masculino", "Femenino", "Mixto"];

export default async function CategoriesPage({
  params,
  searchParams,
}: PageProps<"/panel/torneos/[id]/categorias">) {
  const { id } = await params;
  const sp = await searchParams;
  const { scope } = await requireOrganizer();
  const t = await db.tournament.findFirst({
    where: { id, AND: [scope] },
    select: {
      id: true,
      areas: { select: { id: true, name: true }, orderBy: { order: "asc" } },
      categories: {
        orderBy: { order: "asc" },
        include: { _count: { select: { entries: true, matches: true } } },
      },
    },
  });
  if (!t) notFound();

  return (
    <>
      <Notice sp={sp} />

      <div className="grid gap-6 lg:grid-cols-2">
        <details className="card" open={t.categories.length === 0}>
          <summary className="font-semibold">Generar varias categorías de una vez</summary>
          <p className="mt-2 text-sm text-slate-500">
            Combina género, edad, cinturón o nivel y pesos. Dejá vacío lo que no uses.
          </p>
          <form action={generateCategories} className="mt-4 space-y-4">
            <input type="hidden" name="tournamentId" value={t.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="gen-prefix">
                  Prefijo del nombre
                </label>
                <input id="gen-prefix" name="prefix" placeholder="K-1, Gi, No-Gi…" className="input" />
              </div>
              <fieldset>
                <legend className="label">Género</legend>
                <div className="flex flex-wrap gap-3 pt-2 text-sm">
                  {GENDERS.map((g) => (
                    <label key={g} className="flex items-center gap-1.5">
                      <input type="checkbox" name="genders" value={g} /> {g}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="label" htmlFor="gen-ages">
                  Edades
                </label>
                <input id="gen-ages" name="ages" placeholder="Juvenil, Adulto, Master" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="gen-levels">
                  Cinturones o niveles
                </label>
                <input id="gen-levels" name="levels" placeholder="Blanco, Azul, Violeta" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="gen-weights">
                  Límites de peso en kg
                </label>
                <input id="gen-weights" name="weights" placeholder="57, 63, 69.5, 75, +75" className="input" />
              </div>
            </div>
            <RuleFields areas={t.areas} idPrefix="gen" />
            <SubmitButton>Generar categorías</SubmitButton>
          </form>
        </details>

        <details className="card">
          <summary className="font-semibold">Agregar una categoría</summary>
          <form action={createCategory} className="mt-4 space-y-4">
            <input type="hidden" name="tournamentId" value={t.id} />
            <CategoryAttributes idPrefix="new" />
            <RuleFields areas={t.areas} idPrefix="new" />
            <SubmitButton>Agregar categoría</SubmitButton>
          </form>
        </details>
      </div>

      <h2 className="mt-8 mb-3 font-semibold">Categorías ({t.categories.length})</h2>
      {t.categories.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay categorías.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
          {t.categories.map((c) => {
            const rules = getRuleset(c.ruleset);
            const weight = weightLabel(c.weightMin, c.weightMax);
            return (
              <li key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {rules.name} · {c.rounds} × {mmss(c.roundSeconds)}
                      {weight ? ` · ${weight}` : ""}
                    </p>
                  </div>
                  <span className="badge">
                    {c._count.entries} {c._count.entries === 1 ? "inscripto" : "inscriptos"}
                  </span>
                  {c._count.matches > 0 && (
                    <span className="badge bg-emerald-100 text-emerald-800">Llave armada</span>
                  )}
                  <form action={assignArea} className="w-40">
                    <input type="hidden" name="categoryId" value={c.id} />
                    <AutoSubmitSelect name="areaId" defaultValue={c.areaId ?? ""} className="input py-1.5">
                      <option value="">Sin área</option>
                      {t.areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </AutoSubmitSelect>
                  </form>
                  <form action={deleteCategory}>
                    <input type="hidden" name="categoryId" value={c.id} />
                    <SubmitButton
                      className="btn btn-sm btn-danger"
                      confirm={`¿Eliminar la categoría "${c.name}" con su llave y resultados?`}
                    >
                      Eliminar
                    </SubmitButton>
                  </form>
                </div>
                <details className="mt-2">
                  <summary className="text-sm text-slate-500 hover:text-slate-800">Editar</summary>
                  <form action={updateCategory} className="mt-3 space-y-4 rounded-lg bg-slate-50 p-4">
                    <input type="hidden" name="categoryId" value={c.id} />
                    <CategoryAttributes idPrefix={c.id} values={c} />
                    <RuleFields areas={t.areas} idPrefix={c.id} values={c} />
                    <SubmitButton>Guardar categoría</SubmitButton>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function CategoryAttributes({
  idPrefix,
  values,
}: {
  idPrefix: string;
  values?: {
    name: string;
    gender: string | null;
    ageGroup: string | null;
    level: string | null;
    weightMin: number | null;
    weightMax: number | null;
  };
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-4">
        <label className="label" htmlFor={id("name")}>
          Nombre
        </label>
        <input
          id={id("name")}
          name="name"
          required
          defaultValue={values?.name ?? ""}
          placeholder="K-1 · Masculino · Adulto · -69 kg"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor={id("gender")}>
          Género
        </label>
        <select id={id("gender")} name="gender" defaultValue={values?.gender ?? ""} className="input">
          <option value="">Sin definir</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={id("ageGroup")}>
          Edad
        </label>
        <input id={id("ageGroup")} name="ageGroup" defaultValue={values?.ageGroup ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={id("level")}>
          Cinturón o nivel
        </label>
        <input id={id("level")} name="level" defaultValue={values?.level ?? ""} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor={id("weightMin")}>
            Más de (kg)
          </label>
          <input
            id={id("weightMin")}
            name="weightMin"
            inputMode="decimal"
            defaultValue={values?.weightMin ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={id("weightMax")}>
            Hasta (kg)
          </label>
          <input
            id={id("weightMax")}
            name="weightMax"
            inputMode="decimal"
            defaultValue={values?.weightMax ?? ""}
            className="input"
          />
        </div>
      </div>
    </div>
  );
}
