import { COUNTRIES } from "@/lib/countries";

type Values = {
  firstName: string;
  lastName: string;
  team: string | null;
  country: string | null;
  gender: string | null;
  birthYear: number | null;
  level: string | null;
  weight: number | null;
};

export function ParticipantFields({
  values,
  categories,
  selected = [],
  idPrefix,
}: {
  values?: Values;
  categories: { id: string; name: string }[];
  selected?: string[];
  idPrefix: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor={id("firstName")}>
            Nombre
          </label>
          <input id={id("firstName")} name="firstName" required defaultValue={values?.firstName ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={id("lastName")}>
            Apellido
          </label>
          <input id={id("lastName")} name="lastName" required defaultValue={values?.lastName ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={id("team")}>
            Academia o equipo
          </label>
          <input id={id("team")} name="team" defaultValue={values?.team ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={id("country")}>
            País
          </label>
          <select id={id("country")} name="country" defaultValue={values?.country ?? "AR"} className="input">
            <option value="">Sin bandera</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id("gender")}>
            Género
          </label>
          <select id={id("gender")} name="gender" defaultValue={values?.gender ?? ""} className="input">
            <option value="">Sin definir</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id("birthYear")}>
            Año de nacimiento
          </label>
          <input
            id={id("birthYear")}
            name="birthYear"
            inputMode="numeric"
            defaultValue={values?.birthYear ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={id("level")}>
            Cinturón o nivel
          </label>
          <input id={id("level")} name="level" defaultValue={values?.level ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={id("weight")}>
            Peso declarado (kg)
          </label>
          <input
            id={id("weight")}
            name="weight"
            inputMode="decimal"
            defaultValue={values?.weight ?? ""}
            className="input"
          />
        </div>
      </div>
      <fieldset>
        <legend className="label">Categorías en las que compite</legend>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-500">Primero creá categorías en la pestaña Categorías.</p>
        ) : (
          <div className="grid max-h-56 gap-x-6 gap-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={selected.includes(c.id)} />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
