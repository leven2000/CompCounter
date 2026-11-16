import Link from "next/link";
import { countryName } from "@/lib/countries";
import type { MatchReportData } from "@/lib/history";
import { EVENT_LABEL } from "@/lib/labels";
import { sanctionsSummary, type Corner } from "@/lib/rules";
import { Flag } from "./bits";
import { LocalTime, PrintButton } from "./client-bits";

export function MatchReport({ data, backHref }: { data: MatchReportData; backHref: string }) {
  const { match, rules, options, dqAt, score, cards, lastRound, log } = data;
  const org = match.category.tournament.org;
  const cornerName = (corner: string) => (corner === "RED" ? org.corner1Name : org.corner2Name);
  const winner: Corner = match.winnerEntryId === match.redEntryId ? "RED" : "BLUE";
  const fighters = [
    { corner: "RED" as Corner, entry: match.red },
    { corner: "BLUE" as Corner, entry: match.blue },
  ];
  const nameOf = (corner: Corner) => {
    const p = (corner === "RED" ? match.red : match.blue)?.participant;
    return p ? `${p.firstName} ${p.lastName}`.trim() : "—";
  };

  const totals: [string, number, number][] = [];
  if (rules.mode === "operator" && rules.pointButtons.length > 0) {
    totals.push(["Puntos", score.sides.RED.score, score.sides.BLUE.score]);
  }
  if (rules.advantages) totals.push(["Ventajas", score.sides.RED.advTotal, score.sides.BLUE.advTotal]);
  if (rules.penalties) totals.push(["Penalizaciones", score.sides.RED.pen, score.sides.BLUE.pen]);
  if (rules.warnings) totals.push(["Advertencias", score.sides.RED.warn, score.sides.BLUE.warn]);
  if (options.minusEnabled) {
    totals.push(["Puntos negativos", score.sides.RED.minusTotal, score.sides.BLUE.minusTotal]);
  }
  if (rules.knockdowns) totals.push(["Knockdowns a favor", score.sides.RED.kd, score.sides.BLUE.kd]);
  if (rules.exits) totals.push(["Salidas", score.sides.RED.exits, score.sides.BLUE.exits]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm text-slate-500 hover:text-slate-800">
          ← Historial
        </Link>
        <PrintButton />
      </div>

      <section className="card mt-3">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {org.name} · {match.category.tournament.name}
        </p>
        <h1 className="mt-1 text-xl font-bold">{match.category.name}</h1>
        <p className="text-sm text-slate-500">
          {[
            match.label,
            match.number ? `Pelea ${match.number}` : null,
            match.category.area?.name,
            rules.name,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Cierre: {match.finishedAt ? <LocalTime iso={match.finishedAt.toISOString()} /> : "—"}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {fighters.map(({ corner, entry }) => (
            <div
              key={corner}
              className={`rounded-lg border p-4 ${
                winner === corner ? "border-emerald-300 bg-emerald-50" : "border-slate-200"
              }`}
            >
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {cornerName(corner)}
                {winner === corner ? " · Ganador" : ""}
              </p>
              <p className="mt-1 flex items-center gap-2 text-lg font-bold">
                <Flag code={entry?.participant.country ?? null} />
                {nameOf(corner)}
              </p>
              <p className="text-sm text-slate-500">
                {[entry?.participant.team, countryName(entry?.participant.country ?? null)]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-base">
          Ganó <strong>{nameOf(winner)}</strong> por <strong>{match.winMethod ?? "—"}</strong>
          {match.resultSummary ? ` (${match.resultSummary})` : ""}.
        </p>
      </section>

      {cards.length > 0 && (
        <section className="card mt-4">
          <h2 className="font-semibold">Tarjetas de los jueces</h2>
          <p className="mt-1 text-sm text-slate-500">
            Toques por round ({org.corner1Name} – {org.corner2Name}). El total incluye knockdowns y puntos
            negativos.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="tabular w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                  <th className="py-1">Juez</th>
                  {Array.from({ length: lastRound }, (_, r) => (
                    <th key={r} className="py-1 text-center">
                      R{r + 1}
                    </th>
                  ))}
                  <th className="py-1 text-center">Total</th>
                  <th className="py-1">A favor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cards.map((card) => (
                  <tr key={card.seat}>
                    <td className="py-1.5 font-medium">Juez {card.seat}</td>
                    {card.rounds.map((r, i) => (
                      <td key={i} className="py-1.5 text-center">
                        {r.red} – {r.blue}
                      </td>
                    ))}
                    <td className="py-1.5 text-center font-bold">
                      {card.total ? `${card.total.red} – ${card.total.blue}` : "—"}
                    </td>
                    <td className="py-1.5">
                      {card.total?.favor ? cornerName(card.total.favor) : "Empate"}
                      {card.total?.decision ? " (decisión)" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totals.length > 0 && (
        <section className="card mt-4">
          <h2 className="font-semibold">Totales de mesa</h2>
          <table className="tabular mt-3 w-full max-w-md text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                <th className="py-1" />
                <th className="py-1 text-center">{org.corner1Name}</th>
                <th className="py-1 text-center">{org.corner2Name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {totals.map(([label, red, blue]) => (
                <tr key={label}>
                  <td className="py-1.5">{label}</td>
                  <td className="py-1.5 text-center font-semibold">{red}</td>
                  <td className="py-1.5 text-center font-semibold">{blue}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            {sanctionsSummary(rules, { ...options, dqAt })}
            {match.customRules ? " (reglas propias de esta pelea)" : ""}
          </p>
        </section>
      )}

      <section className="card mt-4">
        <h2 className="font-semibold">Acciones de mesa</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No se cargaron acciones de mesa.</p>
        ) : (
          <table className="tabular mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                <th className="py-1">Hora</th>
                <th className="py-1">Round</th>
                <th className="py-1">Acción</th>
                <th className="py-1">Esquina</th>
                <th className="py-1 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {log.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 text-slate-500">
                    <LocalTime iso={e.createdAt.toISOString()} mode="time" />
                  </td>
                  <td className="py-1.5">{e.round}</td>
                  <td className="py-1.5">
                    {EVENT_LABEL[e.type] ?? e.type}
                    {e.judge ? ` (juez ${e.judge})` : ""}
                  </td>
                  <td className="py-1.5">{cornerName(e.corner)}</td>
                  <td className="py-1.5 text-right font-semibold">
                    {e.type === "DECISION" ? "" : e.value > 0 ? `+${e.value}` : e.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
