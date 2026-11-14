import { podium, standings } from "@/lib/results";
import { Flag } from "./bits";

type Entry = {
  id: string;
  participant: { firstName: string; lastName: string; team: string | null; country: string | null };
};

type Match = {
  id: string;
  round: number;
  position: number;
  depth: number;
  label: string | null;
  number: number;
  status: string;
  redEntryId: string | null;
  blueEntryId: string | null;
  winnerEntryId: string | null;
  winMethod: string | null;
};

type Options = { showFlags: boolean; showTeams: boolean };

function Slot({
  entry,
  corner,
  match,
  options,
}: {
  entry: Entry | undefined;
  corner: "c1" | "c2";
  match: Match;
  options: Options;
}) {
  const decided = match.status === "DONE" || match.status === "BYE";
  const won = decided && !!entry && match.winnerEntryId === entry.id;
  const lost = decided && !!entry && match.winnerEntryId !== entry.id;
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 ${lost ? "opacity-45" : ""}`}>
      <span className={`h-6 w-1 shrink-0 rounded-full ${corner === "c1" ? "bg-c1" : "bg-c2"}`} />
      {entry ? (
        <>
          {options.showFlags && <Flag code={entry.participant.country} className="h-3 w-[18px]" />}
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${won ? "font-bold" : "font-medium"}`}>
              {entry.participant.firstName} {entry.participant.lastName}
            </span>
            {options.showTeams && entry.participant.team && (
              <span className="block truncate text-[11px] text-slate-500">{entry.participant.team}</span>
            )}
          </span>
          {won && <span className="text-xs font-bold text-emerald-600">✓</span>}
        </>
      ) : (
        <span className="text-sm text-slate-400 italic">
          {match.status === "BYE" ? "Pase libre" : "Por definir"}
        </span>
      )}
    </div>
  );
}

function MatchCard({
  match,
  entries,
  options,
}: {
  match: Match;
  entries: Map<string, Entry>;
  options: Options;
}) {
  const live = match.status === "LIVE";
  return (
    <div
      className={`w-56 overflow-hidden rounded-lg border bg-white text-slate-900 shadow-sm ${
        live ? "border-brand ring-2 ring-brand/30" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between bg-slate-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
        <span>{match.number > 0 ? `Pelea ${match.number}` : "—"}</span>
        <span className={live ? "text-brand" : ""}>
          {live ? "En curso" : match.status === "DONE" ? (match.winMethod ?? "") : ""}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        <Slot entry={entries.get(match.redEntryId ?? "")} corner="c1" match={match} options={options} />
        <Slot entry={entries.get(match.blueEntryId ?? "")} corner="c2" match={match} options={options} />
      </div>
    </div>
  );
}

export function CategoryBracket({
  format,
  entries,
  matches,
  options,
}: {
  format: string | null;
  entries: Entry[];
  matches: Match[];
  options: Options;
}) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const name = (id: string | null) => {
    const e = id ? byId.get(id) : undefined;
    return e ? `${e.participant.firstName} ${e.participant.lastName}` : "—";
  };
  const result = podium(
    format,
    entries.map((e) => e.id),
    matches,
  );

  if (matches.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {entries.length === 1
          ? `Un solo inscripto: ${name(entries[0].id)} gana la categoría sin pelear.`
          : "Todavía no se generó la llave."}
      </p>
    );
  }

  const podiumBlock = result.complete && (
    <div className="mb-4 flex flex-wrap gap-2 text-sm">
      <span className="badge bg-yellow-100 text-yellow-900">🥇 {name(result.gold)}</span>
      {result.silver && <span className="badge bg-slate-200 text-slate-800">🥈 {name(result.silver)}</span>}
      {result.bronze.map((id) => (
        <span key={id} className="badge bg-orange-100 text-orange-900">
          🥉 {name(id)}
        </span>
      ))}
    </div>
  );

  if (format === "ROUND_ROBIN") {
    const table = standings(
      entries.map((e) => e.id),
      matches,
    );
    return (
      <div>
        {podiumBlock}
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-wrap gap-3">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} entries={byId} options={options} />
            ))}
          </div>
          <table className="h-fit w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                <th className="py-1">Posiciones</th>
                <th className="py-1 text-center">PJ</th>
                <th className="py-1 text-center">G</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={row.entryId} className="border-b border-slate-100">
                  <td className="py-1.5">
                    {i + 1}. {name(row.entryId)}
                  </td>
                  <td className="py-1.5 text-center">{row.played}</td>
                  <td className="py-1.5 text-center font-semibold">{row.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const main = matches.filter((m) => m.label !== "3er puesto");
  const third = matches.find((m) => m.label === "3er puesto");
  const rounds = [...new Set(main.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div>
      {podiumBlock}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-6">
          {rounds.map((round) => {
            const column = main.filter((m) => m.round === round).sort((a, b) => a.position - b.position);
            return (
              <div key={round} className="flex flex-col">
                <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {column[0]?.label}
                </p>
                <div className="flex flex-1 flex-col justify-around gap-3">
                  {column.map((m) => (
                    <MatchCard key={m.id} match={m} entries={byId} options={options} />
                  ))}
                </div>
              </div>
            );
          })}
          {third && (
            <div className="flex flex-col">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">3er puesto</p>
              <MatchCard match={third} entries={byId} options={options} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
