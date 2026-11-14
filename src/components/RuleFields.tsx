import { RULESETS } from "@/lib/rules";

export const mmss = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

type Values = {
  ruleset: string;
  rounds: number;
  roundSeconds: number;
  restSeconds: number;
  format: string;
  thirdPlaceMatch: boolean;
  autoLadder: boolean;
  areaId: string | null;
};

const GROUPS = [...new Set(RULESETS.map((r) => r.group))];

export function RuleFields({
  values,
  areas = [],
  idPrefix,
  variant = "full",
}: {
  values?: Values;
  areas?: { id: string; name: string }[];
  idPrefix: string;
  variant?: "full" | "match";
}) {
  const full = variant === "full";
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">
        <label className="label" htmlFor={id("ruleset")}>
          Modalidad y reglas
        </label>
        <select
          id={id("ruleset")}
          name="ruleset"
          defaultValue={values?.ruleset ?? "kick-ring"}
          className="input"
        >
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {RULESETS.filter((r) => r.group === group).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {full && (
        <div>
          <label className="label" htmlFor={id("format")}>
            Formato de llave
          </label>
          <select
            id={id("format")}
            name="format"
            defaultValue={values?.format ?? "AUTO"}
            className="input"
          >
            <option value="AUTO">Automático</option>
            <option value="SINGLE">Eliminación simple</option>
            <option value="ROUND_ROBIN">Todos contra todos</option>
          </select>
        </div>
      )}
      {full && (
        <div>
          <label className="label" htmlFor={id("areaId")}>
            Área
          </label>
          <select
            id={id("areaId")}
            name="areaId"
            defaultValue={values?.areaId ?? ""}
            className="input"
          >
            <option value="">Sin asignar</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor={id("rounds")}>
          Rounds
        </label>
        <input
          id={id("rounds")}
          name="rounds"
          type="number"
          min={1}
          max={12}
          defaultValue={values?.rounds ?? ""}
          placeholder="Según modalidad"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor={id("roundTime")}>
          Duración (min:seg)
        </label>
        <input
          id={id("roundTime")}
          name="roundTime"
          defaultValue={values ? mmss(values.roundSeconds) : ""}
          placeholder="Según modalidad"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor={id("restTime")}>
          Descanso (min:seg)
        </label>
        <input
          id={id("restTime")}
          name="restTime"
          defaultValue={values ? mmss(values.restSeconds) : ""}
          placeholder="Según modalidad"
          className="input"
        />
      </div>
      <div className="flex flex-col justify-end gap-2 text-sm">
        {full && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="thirdPlaceMatch"
              defaultChecked={values?.thirdPlaceMatch ?? false}
            />
            Pelea por el 3er puesto
          </label>
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="autoLadder"
            defaultChecked={values?.autoLadder ?? true}
          />
          Sanciones automáticas
        </label>
      </div>
    </div>
  );
}
