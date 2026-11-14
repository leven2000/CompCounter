import Link from "next/link";
import type { HistoryData } from "@/lib/history";
import { formatDate } from "@/lib/util";
import { LocalTime } from "./client-bits";

type Person = { firstName: string; lastName: string };
const fullName = (p?: Person | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : "—");

export function HistoryView({
  data,
  basePath,
  filters,
  orgs,
}: {
  data: HistoryData;
  basePath: string;
  filters: { q: string; t: string; org: string };
  orgs?: { id: string; name: string }[];
}) {
  const showOrg = !!orgs;
  const withOrg = (params: Record<string, string>) => {
    const search = new URLSearchParams({ ...(filters.org ? { org: filters.org } : {}), ...params });
    const text = search.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  const selected = data.tournaments.find((t) => t.id === filters.t);

  return (
    <>
      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        {orgs && (
          <div className="w-full sm:w-56">
            <label className="label" htmlFor="org">
              Organizador
            </label>
            <select id="org" name="org" defaultValue={filters.org} className="input">
              <option value="">Todos</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="w-full sm:w-64">
          <label className="label" htmlFor="t">
            Torneo
          </label>
          <select id="t" name="t" defaultValue={filters.t} className="input">
            <option value="">Todos</option>
            {data.tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {showOrg ? ` · ${t.org.name}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <label className="label" htmlFor="q">
            Competidor o equipo
          </label>
          <input id="q" name="q" defaultValue={filters.q} placeholder="Buscar" className="input" />
        </div>
        <button className="btn btn-primary">Filtrar</button>
        {(filters.q || filters.t || filters.org) && (
          <Link href={basePath} className="btn">
            Limpiar
          </Link>
        )}
      </form>

      <h2 className="mt-8 mb-3 font-semibold">Torneos ({data.tournaments.length})</h2>
      {data.tournaments.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay torneos.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Torneo</th>
                {showOrg && <th className="th">Organizador</th>}
                <th className="th">Fecha</th>
                <th className="th text-right">Categorías</th>
                <th className="th text-right">Participantes</th>
                <th className="th text-right">Peleas terminadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.tournaments.map((t) => (
                <tr key={t.id} className={t.id === filters.t ? "bg-slate-50" : undefined}>
                  <td className="td">
                    <Link href={withOrg({ t: t.id })} className="font-medium text-brand hover:underline">
                      {t.name}
                    </Link>
                    {t.quick && <span className="badge ml-2">Sin llave</span>}
                  </td>
                  {showOrg && <td className="td text-slate-600">{t.org.name}</td>}
                  <td className="td text-slate-600">{t.quick ? "—" : formatDate(t.date)}</td>
                  <td className="td tabular text-right">{t.quick ? "—" : t._count.categories}</td>
                  <td className="td tabular text-right">{t._count.participants}</td>
                  <td className="td tabular text-right font-semibold">{t.fights}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 mb-3 font-semibold">
        Peleas terminadas ({data.matches.length}
        {data.matches.length === 200 ? ", las últimas 200" : ""}){selected ? ` · ${selected.name}` : ""}
      </h2>
      {data.matches.length === 0 ? (
        <p className="text-sm text-slate-500">No hay peleas terminadas con ese filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Cierre</th>
                <th className="th">Torneo y categoría</th>
                <th className="th">Competidores</th>
                <th className="th">Resultado</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.matches.map((m) => {
                const redWon = m.winnerEntryId === m.redEntryId;
                return (
                  <tr key={m.id}>
                    <td className="td whitespace-nowrap text-slate-600">
                      {m.finishedAt ? <LocalTime iso={m.finishedAt.toISOString()} /> : "—"}
                    </td>
                    <td className="td">
                      <span className="font-medium">{m.category.tournament.name}</span>
                      {showOrg && (
                        <span className="text-slate-500"> · {m.category.tournament.org.name}</span>
                      )}
                      <span className="block text-xs text-slate-500">
                        {m.category.name}
                        {m.label ? ` · ${m.label}` : ""}
                      </span>
                    </td>
                    <td className="td">
                      <span className={redWon ? "font-bold" : "text-slate-500"}>
                        {fullName(m.red?.participant)}
                        {redWon ? " ✓" : ""}
                      </span>
                      <span className="text-slate-400"> vs </span>
                      <span className={redWon ? "text-slate-500" : "font-bold"}>
                        {fullName(m.blue?.participant)}
                        {redWon ? "" : " ✓"}
                      </span>
                    </td>
                    <td className="td">
                      {m.winMethod ?? "—"}
                      {m.resultSummary && <span className="text-slate-500"> · {m.resultSummary}</span>}
                    </td>
                    <td className="td text-right">
                      <Link href={`${basePath}/${m.id}`} className="btn btn-sm">
                        Ver acta
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
