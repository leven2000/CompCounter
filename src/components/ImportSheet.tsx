"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { importSheet } from "@/app/panel/actions";
import {
  buildPlan,
  detectColumns,
  extractRows,
  FIELDS,
  parseBirthYear,
  sanitizeRows,
  type Existing,
  type Field,
  type Mapping,
} from "@/lib/import";
import { MAX_FILE_BYTES, readTable, SheetError, type Sheet } from "@/lib/sheet";

type Layout = { headerRow: number; mapping: Mapping };

const NAME_FIELDS: (Field | "")[] = ["firstName", "lastName", "fullName", "lastFirst"];
const MAX_PAYLOAD = 1_500_000;

function columnName(index: number) {
  let name = "";
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) name = String.fromCharCode(65 + (n % 26)) + name;
  return name;
}

function weightNote(min: number | null, max: number | null) {
  if (min != null && max != null) return `${min}–${max} kg`;
  if (max != null) return `hasta ${max} kg`;
  if (min != null) return `más de ${min} kg`;
  return "";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ImportSheet({
  tournamentId,
  existing,
  areas,
  rulesets,
  countries,
}: {
  tournamentId: string;
  existing: Existing;
  areas: { id: string; name: string }[];
  rulesets: { id: string; name: string; group: string }[];
  countries: { code: string; name: string }[];
}) {
  const [file, setFile] = useState<{ name: string; sheets: Sheet[] } | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [layout, setLayout] = useState<Layout>({ headerRow: -1, mapping: [] });
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [areaId, setAreaId] = useState(areas.length === 1 ? areas[0].id : "");
  const [country, setCountry] = useState("AR");
  const [fileError, setFileError] = useState("");
  const [state, action, pending] = useActionState(importSheet, null);

  const sheet = file?.sheets[sheetIndex] ?? null;
  const rows = useMemo(
    () => (sheet ? (sanitizeRows(extractRows(sheet.rows, layout.headerRow, layout.mapping)) ?? []) : []),
    [sheet, layout],
  );
  const plan = useMemo(() => buildPlan(rows, choices, existing), [rows, choices, existing]);
  const payload = useMemo(
    () =>
      JSON.stringify({
        rows,
        choices: Object.fromEntries(plan.disciplines.map((d) => [d.key, d.ruleset])),
        areaId,
        country,
      }),
    [rows, plan, areaId, country],
  );
  const enrolled = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of existing.people) for (const id of p.categoryIds) count.set(id, (count.get(id) ?? 0) + 1);
    return count;
  }, [existing]);

  async function choose(picked: File | undefined) {
    if (!picked) return;
    setFileError("");
    try {
      if (picked.size > MAX_FILE_BYTES) throw new SheetError("El archivo pesa más de 10 MB.");
      const sheets = readTable(picked.name, new Uint8Array(await picked.arrayBuffer()));
      const layouts = sheets.map((s) => detectColumns(s.rows));
      let index = layouts.findIndex((l) => l.headerRow >= 0);
      if (index < 0) index = Math.max(0, sheets.findIndex((s) => s.rows.length > 0));
      setFile({ name: picked.name, sheets });
      setSheetIndex(index);
      setLayout(layouts[index]);
      setChoices({});
    } catch (error) {
      setFile(null);
      setFileError(error instanceof SheetError ? error.message : "No se pudo leer el archivo.");
    }
  }

  function changeSheet(index: number) {
    if (!file) return;
    setSheetIndex(index);
    setLayout(detectColumns(file.sheets[index].rows));
    setChoices({});
  }

  const assign = (column: number, field: Field | "") =>
    setLayout((current) => ({
      ...current,
      mapping: current.mapping.map((f, i) => (i === column ? field : field && f === field ? "" : f)),
    }));

  const titles = sheet && layout.headerRow >= 0 ? (sheet.rows[layout.headerRow] ?? []) : [];
  const sample = sheet
    ? sheet.rows
        .slice(layout.headerRow + 1)
        .filter((r) => r.length > 0)
        .slice(0, 4)
    : [];
  const hasName = layout.mapping.some((f) => NAME_FIELDS.includes(f));
  const blockers = [...plan.blockers];
  if (payload.length > MAX_PAYLOAD) blockers.push("La planilla es muy pesada para cargarla de una vez. Partila en dos.");
  const nothingNew = plan.stats.newPeople === 0 && plan.stats.entries === 0;
  const rulesetName = (id: string) => rulesets.find((r) => r.id === id)?.name ?? "Sin elegir";
  const groups = [...new Set(rulesets.map((r) => r.group))];

  return (
    <div className="space-y-6">
      <section className="card">
        <h3 className="font-semibold">1. Elegí la planilla</h3>
        <p className="mt-1 text-sm text-slate-500">
          Sirve un Excel (.xlsx) o un CSV. Tiene que tener una fila por competidor con su nombre, y
          conviene que traiga escuela, disciplina y categoría. Las columnas pueden estar en cualquier orden.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.csv,.txt,.tsv"
            aria-label="Planilla de competidores"
            className="input max-w-md file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium"
            onChange={(e) => void choose(e.currentTarget.files?.[0])}
          />
          <a href="/plantilla-competidores.xlsx" download className="btn btn-sm">
            Descargar planilla modelo
          </a>
        </div>
        {fileError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {fileError}
          </p>
        )}
        {file && sheet && (
          <div className="mt-4 flex flex-wrap items-end gap-4 text-sm text-slate-600">
            <p>
              <strong className="text-slate-900">{file.name}</strong> · {plural(rows.length, "fila con datos", "filas con datos")}
            </p>
            {file.sheets.length > 1 && (
              <div>
                <label className="label" htmlFor="import-sheet">
                  Hoja
                </label>
                <select
                  id="import-sheet"
                  className="input w-56 py-1.5"
                  value={sheetIndex}
                  onChange={(e) => changeSheet(Number(e.currentTarget.value))}
                >
                  {file.sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} ({s.rows.length} filas)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </section>

      {sheet && (
        <section className="card">
          <h3 className="font-semibold">2. Revisá qué hay en cada columna</h3>
          <p className="mt-1 text-sm text-slate-500">
            {layout.headerRow >= 0
              ? "Lo detecté por los títulos. Corregí lo que esté mal."
              : "No reconocí los títulos. Indicá qué hay en cada columna."}{" "}
            Lo que quede en «No usar» se ignora.
          </p>
          <div className="mt-3 w-44">
            <label className="label" htmlFor="import-header">
              Fila de los títulos
            </label>
            <select
              id="import-header"
              className="input py-1.5"
              value={layout.headerRow}
              onChange={(e) => {
                const headerRow = Number(e.currentTarget.value);
                setLayout((current) => ({ ...current, headerRow }));
              }}
            >
              <option value={-1}>No tiene títulos</option>
              {Array.from({ length: Math.min(25, sheet.rows.length) }, (_, i) => (
                <option key={i} value={i}>
                  Fila {i + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {layout.mapping.map((field, i) => (
                    <th key={i} className="th min-w-40 align-top normal-case">
                      <select
                        aria-label={`Contenido de la columna ${columnName(i)}`}
                        className={`input py-1 text-xs font-medium ${field ? "" : "text-slate-400"}`}
                        value={field}
                        onChange={(e) => assign(i, e.currentTarget.value as Field | "")}
                      >
                        <option value="">No usar</option>
                        {FIELDS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block truncate font-normal tracking-normal text-slate-500">
                        {titles[i] || `Columna ${columnName(i)}`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sample.map((cells, r) => (
                  <tr key={r}>
                    {layout.mapping.map((field, i) => (
                      <td key={i} className={`td max-w-56 truncate ${field ? "" : "text-slate-400"}`}>
                        {field === "birth" ? (parseBirthYear(cells[i] ?? "") ?? cells[i]) : (cells[i] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasName && (
            <p className="mt-3 text-sm text-amber-700">Falta indicar qué columna tiene el nombre del competidor.</p>
          )}
        </section>
      )}

      {sheet && plan.disciplines.length > 0 && (
        <section className="card">
          <h3 className="font-semibold">3. Disciplinas</h3>
          <p className="mt-1 text-sm text-slate-500">
            Cada disciplina de la planilla usa una modalidad del sistema, que define el reloj, el puntaje y las
            sanciones de sus categorías. Revisalas: después se cambia categoría por categoría. Si una misma
            disciplina aparece escrita de dos formas, corregila en la planilla y volvé a elegirla.
          </p>
          <ul className="mt-4 space-y-2">
            {plan.disciplines.map((d) => (
              <li key={d.key} className="flex flex-wrap items-center gap-3">
                <span className="w-56 truncate text-sm font-medium">
                  {d.label || "Filas sin disciplina"}{" "}
                  <span className="font-normal text-slate-500">· {plural(d.rows, "fila", "filas")}</span>
                </span>
                <select
                  aria-label={`Modalidad para ${d.label || "las filas sin disciplina"}`}
                  className={`input w-80 py-1.5 ${d.needed && !d.ruleset ? "border-red-400 bg-red-50" : ""}`}
                  value={d.ruleset}
                  disabled={!d.needed}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setChoices((current) => ({ ...current, [d.key]: value }));
                  }}
                >
                  <option value="">Elegir modalidad…</option>
                  {groups.map((group) => (
                    <optgroup key={group} label={group}>
                      {rulesets
                        .filter((r) => r.group === group)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                {!d.needed && <span className="text-xs text-slate-500">Sus categorías ya existen en el torneo.</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet && plan.people.length > 0 && (
        <section className="card">
          <h3 className="font-semibold">{plan.disciplines.length > 0 ? "4" : "3"}. Qué se va a cargar</h3>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Competidores nuevos", plan.stats.newPeople],
              ["Ya estaban cargados", plan.stats.knownPeople],
              ["Categorías nuevas", plan.stats.newCategories],
              ["Inscripciones nuevas", plan.stats.entries],
              ["Escuelas", plan.teams.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="import-area">
                Área de las categorías nuevas
              </label>
              <select id="import-area" className="input" value={areaId} onChange={(e) => setAreaId(e.currentTarget.value)}>
                <option value="">Sin área (la asignás después)</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="import-country">
                País de quien no lo tenga en la planilla
              </label>
              <select id="import-country" className="input" value={country} onChange={(e) => setCountry(e.currentTarget.value)}>
                <option value="">Sin bandera</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {plan.categories.length > 0 && (
            <>
              <h4 className="mt-6 text-sm font-semibold">Categorías ({plan.categories.length})</h4>
              <p className="text-sm text-slate-500">
                Si dos renglones son la misma categoría escrita distinto, corregí la planilla y volvé a elegirla:
                todavía no se guardó nada.
              </p>
              <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[640px]">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="th">Categoría</th>
                      <th className="th">Modalidad</th>
                      <th className="th">En la planilla</th>
                      <th className="th">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plan.categories.map((c) => {
                      const total = (c.existingId ? (enrolled.get(c.existingId) ?? 0) : 0) + c.added;
                      const traits = [c.existingId ? "" : (c.gender ?? ""), c.existingId ? "" : weightNote(c.weightMin, c.weightMax)]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <tr key={c.key}>
                          <td className="td">
                            <span className="font-medium">{c.name}</span>
                            {traits && <span className="block text-xs text-slate-500">{traits}</span>}
                          </td>
                          <td className="td text-slate-600">{rulesetName(c.ruleset)}</td>
                          <td className="td">{c.rows}</td>
                          <td className="td">
                            <div className="flex flex-wrap gap-1">
                              <span className={`badge ${c.existingId ? "" : "bg-emerald-100 text-emerald-800"}`}>
                                {c.existingId ? "Ya existe" : "Nueva"}
                              </span>
                              {total === 1 && <span className="badge bg-amber-100 text-amber-800">Un solo inscripto</span>}
                              {c.hasBracket && c.added > 0 && (
                                <span className="badge bg-amber-100 text-amber-800">
                                  Llave ya armada: los nuevos quedan afuera hasta rehacerla
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {plan.teams.length > 0 && (
            <>
              <h4 className="mt-6 text-sm font-semibold">Escuelas ({plan.teams.length})</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.teams.slice(0, 60).map((team) => (
                  <span key={team.name} className="badge">
                    {team.name} · {team.people}
                  </span>
                ))}
                {plan.teams.length > 60 && <span className="badge">y {plan.teams.length - 60} más</span>}
              </div>
            </>
          )}

          {plan.issues.length > 0 && (
            <>
              <h4 className="mt-6 text-sm font-semibold">Filas para revisar ({plan.issues.length})</h4>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm text-amber-800">
                {plan.issues.slice(0, 100).map((issue, i) => (
                  <li key={i}>
                    Fila {issue.line}: {issue.text}
                  </li>
                ))}
                {plan.issues.length > 100 && <li>Y {plan.issues.length - 100} más.</li>}
              </ul>
            </>
          )}
        </section>
      )}

      {sheet && (
        <section className="space-y-3">
          {blockers.map((text) => (
            <p key={text} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {text}
            </p>
          ))}
          {state?.error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {state.error}
            </p>
          )}
          {blockers.length === 0 && nothingNew && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Todo lo de esta planilla ya está cargado en el torneo.
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || blockers.length > 0 || nothingNew}
            onClick={() =>
              startTransition(() => {
                const data = new FormData();
                data.set("tournamentId", tournamentId);
                data.set("payload", payload);
                action(data);
              })
            }
          >
            {pending ? "Cargando…" : "Cargar en el torneo"}
          </button>
        </section>
      )}
    </div>
  );
}
