"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { brandStyle, type Brand } from "@/lib/brand";
import type { MatchView, QueueItem } from "@/lib/live";
import { EVENT_LABEL, MINUS_MODE_OPTIONS } from "@/lib/labels";
import { formatClock, sanctionsSummary, type Corner } from "@/lib/rules";
import { Flag } from "@/components/bits";
import { useControllers } from "./useControllers";
import { act, phaseLabel, useLive, usePhaseBeep, useRemaining } from "./useLive";

type Send = (body: Record<string, unknown>) => void;
type JudgeCode = { seat: number; code: string; url: string; qr: string };

function Counter({
  label,
  value,
  onAdd,
  onRemove,
  note,
}: {
  label: string;
  value: number;
  onAdd: () => void;
  onRemove: () => void;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {note && <p className="text-[11px] text-slate-500">{note}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-sm w-8" onClick={onRemove} aria-label={`Quitar ${label}`}>
          −
        </button>
        <span className="tabular w-6 text-center text-lg font-bold">{value}</span>
        <button type="button" className="btn btn-sm btn-dark w-8" onClick={onAdd} aria-label={`Sumar ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

function CornerPanel({
  match,
  corner,
  brand,
  send,
}: {
  match: MatchView;
  corner: Corner;
  brand: Brand;
  send: Send;
}) {
  const side = match.sides[corner];
  const fighter = corner === "RED" ? match.red : match.blue;
  const rules = match.rules;
  const event = (type: string, value: number) => send({ action: "event", type, corner, value });
  const autoMinus = side.minusTotal - side.minus;
  const perJudge = rules.mode === "judges" ? " por juez" : "";
  const minusNote = [
    rules.minusToRival
      ? `Cada uno suma ${rules.minusValue} al rival${perJudge}`
      : `Cada uno resta ${rules.minusValue}${perJudge}`,
    autoMinus > 0 ? `${autoMinus} por advertencias` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`px-4 py-3 text-white ${corner === "RED" ? "bg-c1" : "bg-c2"}`}>
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase opacity-80">
          {corner === "RED" ? brand.c1Name : brand.c2Name}
        </p>
        <p className="flex items-center gap-2 text-lg leading-tight font-bold">
          {brand.showFlags && <Flag code={fighter?.country ?? null} />}
          {fighter?.name ?? "Por definir"}
        </p>
        {fighter?.team && <p className="text-sm opacity-85">{fighter.team}</p>}
      </div>

      <div className="space-y-3 p-4">
        {rules.mode === "operator" ? (
          <div className="flex items-center gap-4">
            <p className="tabular w-24 text-center text-6xl font-black">{side.score}</p>
            <div className="flex flex-1 flex-wrap gap-2">
              {rules.pointButtons.map((n) => (
                <div key={n} className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="btn btn-dark h-14 w-16 text-xl font-bold"
                    onClick={() => event("POINT", n)}
                  >
                    +{n}
                  </button>
                  <button type="button" className="btn btn-sm w-16" onClick={() => event("POINT", -n)}>
                    −{n}
                  </button>
                </div>
              ))}
              {rules.pointButtons.length === 0 && (
                <p className="self-center text-sm text-slate-500">Sin puntos: se define por finalización.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            <span className="tabular mr-2 text-4xl font-black text-slate-900">{match.favor[corner]}</span>
            {match.favor[corner] === 1 ? "juez a favor" : "jueces a favor"}
          </p>
        )}

        {rules.advantages && (
          <Counter
            label="Ventajas"
            value={side.advTotal}
            onAdd={() => event("ADV", 1)}
            onRemove={() => event("ADV", -1)}
          />
        )}
        {rules.penalties && (
          <Counter
            label="Penalizaciones"
            value={side.pen}
            onAdd={() => event("PEN", 1)}
            onRemove={() => event("PEN", -1)}
          />
        )}
        {rules.warnings && (
          <Counter
            label="Advertencias"
            value={side.warn}
            onAdd={() => event("WARN", 1)}
            onRemove={() => event("WARN", -1)}
          />
        )}
        {rules.minusPoints && (
          <Counter
            label="Puntos negativos"
            value={side.minusTotal}
            note={minusNote}
            onAdd={() => event("MINUS", 1)}
            onRemove={() => event("MINUS", -1)}
          />
        )}
        {rules.knockdowns && (
          <Counter
            label="Knockdowns a favor"
            value={side.kd}
            onAdd={() => event("KD", 1)}
            onRemove={() => event("KD", -1)}
          />
        )}
        {rules.exits && (
          <Counter
            label="Salidas"
            value={side.exits}
            onAdd={() => event("EXIT", 1)}
            onRemove={() => event("EXIT", -1)}
          />
        )}
        {side.dq && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            Llegó al límite de sanciones: corresponde descalificación.
          </p>
        )}
      </div>
    </section>
  );
}

function SanctionEditor({ match, live, send }: { match: MatchView; live: boolean; send: Send }) {
  const current = match.sanctions;
  const [dqAt, setDqAt] = useState(current.dqAt == null ? "" : String(current.dqAt));
  const [minusMode, setMinusMode] = useState(current.minusMode ?? "");
  const [minusValue, setMinusValue] = useState(current.minusValue == null ? "" : String(current.minusValue));

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">Sanciones de esta pelea</span>
        <span className="text-sm text-slate-500">
          {sanctionsSummary(match.rules, {
            dqAt: match.rules.dqAt,
            minusEnabled: match.rules.minusPoints,
            minusToRival: match.rules.minusToRival,
            minusValue: match.rules.minusValue,
          })}
        </span>
        {current.custom && <span className="badge bg-amber-100 text-amber-800">Propias de esta pelea</span>}
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="mesa-dqAt">
            Descalificación directa
          </label>
          <input
            id="mesa-dqAt"
            type="number"
            min={0}
            max={20}
            value={dqAt}
            onChange={(e) => setDqAt(e.target.value)}
            placeholder="Según modalidad"
            className="input"
          />
          <p className="mt-1 text-xs text-slate-500">Advertencias o penalizaciones. 0 = nunca.</p>
        </div>
        <div>
          <label className="label" htmlFor="mesa-minusMode">
            Punto negativo
          </label>
          <select
            id="mesa-minusMode"
            value={minusMode}
            onChange={(e) => setMinusMode(e.target.value)}
            className="input"
          >
            {MINUS_MODE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mesa-minusValue">
            Valor del punto negativo
          </label>
          <input
            id="mesa-minusValue"
            type="number"
            min={1}
            max={10}
            value={minusValue}
            onChange={(e) => setMinusValue(e.target.value)}
            placeholder="Según modalidad"
            className="input"
          />
          <p className="mt-1 text-xs text-slate-500">Con jueces, se aplica en cada tarjeta.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-dark"
          disabled={!live}
          onClick={() => send({ action: "rules", dqAt, minusMode, minusValue })}
        >
          Guardar para esta pelea
        </button>
        {current.custom && (
          <button type="button" className="btn" disabled={!live} onClick={() => send({ action: "rules", reset: true })}>
            Volver a las de la categoría
          </button>
        )}
        <p className="text-xs text-slate-500">Se aplica a toda la pelea, también a lo ya cargado.</p>
      </div>
    </details>
  );
}

function Queue({
  queue,
  canCall,
  send,
}: {
  queue: QueueItem[];
  canCall: boolean;
  send: Send;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Peleas en espera ({queue.length})</h2>
      {queue.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No hay peleas listas en esta área. Revisá que las categorías estén asignadas al área y con la
          llave generada.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {queue.map((q) => (
            <li key={q.id} className="flex items-center gap-3 py-2">
              <span className="tabular w-14 shrink-0 text-xs font-semibold text-slate-500">
                {q.scheduledAt != null && (
                  <span className="block text-sm text-slate-900">
                    {new Date(q.scheduledAt).toISOString().slice(11, 16)}
                  </span>
                )}
                #{q.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {q.red?.name ?? "—"} <span className="text-slate-400">vs</span> {q.blue?.name ?? "—"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {q.categoryName}
                  {q.label ? ` · ${q.label}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!canCall}
                onClick={() => send({ action: "call", matchId: q.id })}
              >
                Llamar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MesaConsole({
  areaId,
  code,
  initialBrand,
  desktop = false,
}: {
  areaId: string;
  code: string;
  initialBrand: Brand;
  desktop?: boolean;
}) {
  const { snap, offset, online } = useLive(areaId, code);
  const controllers = useControllers();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [extra, setExtra] = useState("1:00");
  const match = snap?.match ?? null;
  const brand = snap?.brand ?? initialBrand;
  const remaining = useRemaining(match?.clock, offset);
  usePhaseBeep(match, true);

  const [codes, setCodes] = useState<{ matchId: string | null; judges: JudgeCode[] }>({
    matchId: null,
    judges: [],
  });
  const matchId = match?.id ?? null;
  const usesJudges = match?.rules.mode === "judges";
  const judgeCount = snap?.area.judges ?? 0;

  useEffect(() => {
    if (!matchId || !usesJudges || desktop) return;
    let alive = true;
    const query = `code=${encodeURIComponent(code)}&areaId=${encodeURIComponent(areaId)}`;
    void fetch(`/api/mesa/judges?${query}`)
      .then((res) => res.json())
      .then((json: { matchId: string | null; judges: JudgeCode[] }) => {
        if (alive) setCodes(json);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [matchId, usesJudges, judgeCount, code, areaId, desktop]);

  const judgeCodes = codes.matchId === matchId ? codes.judges : [];

  const send = useCallback<Send>(
    (body) => {
      void act(code, { areaId, ...body }).then((res) => {
        if (!res.ok) {
          setError(res.error ?? "No se pudo completar la acción");
          setTimeout(() => setError(null), 4000);
        }
      });
    },
    [code, areaId],
  );

  const running = match?.clock.running ?? false;
  const live = match?.status === "LIVE";
  const canToggle = live && match.phase !== "ENDED";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.code !== "Space" || !canToggle) return;
      if (target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
      e.preventDefault();
      send({ action: running ? "stop" : "start" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canToggle, running, send]);

  const suggestedMethod = (m: MatchView) => {
    const reason = m.suggestion.reason;
    const found = m.rules.winMethods.find((w) => reason.startsWith(w));
    return found ?? m.rules.winMethods[0];
  };
  const chosenMethod = match ? (method ?? suggestedMethod(match)) : "";
  const canCall = !match || match.status === "DONE" || match.phase === "IDLE";

  const finish = (winner: Corner) => {
    if (!match) return;
    const name = winner === "RED" ? match.red?.name : match.blue?.name;
    if (!window.confirm(`¿Confirmás que gana ${name ?? "este competidor"} por ${chosenMethod}?`)) return;
    send({ action: "finish", winner, method: chosenMethod });
    setMethod(null);
  };

  const extraSeconds = () => {
    const parts = extra.match(/^(\d{1,2}):(\d{1,2})$/);
    return parts ? Number(parts[1]) * 60 + Number(parts[2]) : Number(extra) * 60;
  };

  return (
    <div style={brandStyle(brand)} className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 pt-4">
        <p className="text-lg font-bold">{snap?.area.name ?? "…"}</p>
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <span
            className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "animate-pulse bg-red-500"}`}
          />
          {online ? "Conectado" : "Reconectando…"}
        </span>
        <a href={`/tv/${areaId}`} target="_blank" rel="noreferrer" className="btn btn-sm ml-auto">
          Abrir TV de esta área ↗
        </a>
      </div>
      {error && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white" role="alert">
          {error}
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-4">
        {!snap ? (
          <p className="py-20 text-center text-slate-500">Conectando…</p>
        ) : !match ? (
          <>
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
              No hay pelea en el área. Llamá la próxima de la lista.
            </p>
            <Queue queue={snap.queue} canCall send={send} />
          </>
        ) : (
          <>
            <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="min-w-[14rem] flex-1">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {[match.number ? `Pelea ${match.number}` : null, match.label].filter(Boolean).join(" · ")}
                </p>
                <p className="truncate text-lg font-bold">{match.categoryName}</p>
                <p className="text-xs text-slate-500">{match.rules.name}</p>
              </div>

              <div className="text-center">
                <p
                  className={`tabular text-6xl leading-none font-black ${
                    match.phase === "REST" ? "text-amber-600" : ""
                  }`}
                >
                  {formatClock(remaining)}
                </p>
                <p className="mt-1 text-xs font-semibold tracking-widest text-slate-500 uppercase">
                  {phaseLabel(match)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canToggle}
                  onClick={() => send({ action: running ? "stop" : "start" })}
                  className={`btn h-14 w-36 text-base font-bold ${running ? "btn-dark" : "btn-primary"}`}
                >
                  {running ? "Pausar" : match.phase === "IDLE" ? "Iniciar" : "Reanudar"}
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" className="btn btn-sm" disabled={!live} onClick={() => send({ action: "adjust", deltaMs: 1000 })}>
                    +1 s
                  </button>
                  <button type="button" className="btn btn-sm" disabled={!live} onClick={() => send({ action: "adjust", deltaMs: 10000 })}>
                    +10 s
                  </button>
                  <button type="button" className="btn btn-sm" disabled={!live} onClick={() => send({ action: "adjust", deltaMs: -1000 })}>
                    −1 s
                  </button>
                  <button type="button" className="btn btn-sm" disabled={!live} onClick={() => send({ action: "adjust", deltaMs: -10000 })}>
                    −10 s
                  </button>
                </div>
                {live && (match.phase === "ROUND" || match.phase === "REST") && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      const what = match.phase === "REST" ? "el descanso" : "el round";
                      if (window.confirm(`¿Terminar ${what} ahora?`)) send({ action: "endRound" });
                    }}
                  >
                    Terminar {match.phase === "REST" ? "descanso" : "round"}
                  </button>
                )}
              </div>
              <p className="w-full text-xs text-slate-400">Barra espaciadora: iniciar o pausar el reloj.</p>
            </section>

            {match.leadReached && live && (
              <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
                Diferencia de {match.rules.leadLimit} puntos alcanzada.
              </p>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <CornerPanel match={match} corner="RED" brand={brand} send={send} />
              <CornerPanel match={match} corner="BLUE" brand={brand} send={send} />
            </div>

            <SanctionEditor
              key={[
                match.id,
                match.sanctions.custom,
                match.sanctions.dqAt,
                match.sanctions.minusMode,
                match.sanctions.minusValue,
              ].join(":")}
              match={match}
              live={live}
              send={send}
            />

            {match.rules.mode === "judges" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold">Jueces</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 uppercase">
                        <th className="py-1">Puesto</th>
                        <th className="py-1 text-center">{brand.c1Name}</th>
                        <th className="py-1 text-center">{brand.c2Name}</th>
                        <th className="py-1">Tarjeta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {match.judges.map((j) => {
                        const pad = controllers?.slots.find((s) => s.areaId === areaId && s.seat === j.seat);
                        const connected = desktop
                          ? !!pad && pad.connected && !pad.suspect
                          : snap.presence.judges.includes(j.seat);
                        const offline = !desktop
                          ? "sin conexión"
                          : !pad
                            ? "sin control"
                            : pad.suspect
                              ? "verificar control"
                              : "control apagado";
                        const fix = (corner: Corner, value: number) =>
                          send({ action: "event", type: "JUDGE", judge: j.seat, corner, value });
                        return (
                          <tr key={j.seat}>
                            <td className="py-2">
                              <span className="flex items-center gap-2 font-medium">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`}
                                />
                                Juez {j.seat}
                                {judgeCodes.find((c) => c.seat === j.seat) && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs tracking-widest">
                                    {judgeCodes.find((c) => c.seat === j.seat)?.code}
                                  </span>
                                )}
                                {desktop && connected && pad && (
                                  <span className="text-xs font-normal text-slate-500">control {pad.slot + 1}</span>
                                )}
                                {!connected && <span className="text-xs font-normal text-red-600">{offline}</span>}
                              </span>
                            </td>
                            {(["RED", "BLUE"] as Corner[]).map((corner) => (
                              <td key={corner} className="py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button type="button" className="btn btn-sm w-7" disabled={!live} onClick={() => fix(corner, -1)}>
                                    −
                                  </button>
                                  <span className="tabular w-8 text-center text-lg font-bold">
                                    {corner === "RED" ? j.red : j.blue}
                                  </span>
                                  <button type="button" className="btn btn-sm w-7" disabled={!live} onClick={() => fix(corner, 1)}>
                                    +
                                  </button>
                                </div>
                              </td>
                            ))}
                            <td className="py-2 text-sm">
                              {j.favor ? (
                                <span className={`font-semibold ${j.favor === "RED" ? "text-c1" : "text-c2"}`}>
                                  {j.favor === "RED" ? brand.c1Name : brand.c2Name}
                                  {j.red === j.blue ? (j.decision ? " (decisión)" : " (último round)") : ""}
                                </span>
                              ) : (
                                <span className="text-amber-700">
                                  {match.phase === "ENDED" ? "Empate: esperando su decisión" : "Empate"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {desktop && (
                  <p className="mt-3 text-sm text-slate-600">
                    Los jueces puntúan con sus controles.{" "}
                    <Link href={`/mesa/${code}/controles`} className="font-medium text-brand underline">
                      Asignar o revisar controles
                    </Link>
                  </p>
                )}
                {judgeCodes.length > 0 && (
                  <details className="mt-3" open={match.phase === "IDLE"}>
                    <summary className="text-sm font-medium text-slate-600">
                      Códigos y QR de los jueces para esta pelea
                    </summary>
                    <p className="mt-2 text-xs text-slate-500">
                      Valen solo para esta pelea. Cada juez escanea su QR o escribe su código en /codigo.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {judgeCodes.map((c) => (
                        <div key={c.seat} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                          <div
                            className="h-24 w-24 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                            dangerouslySetInnerHTML={{ __html: c.qr }}
                          />
                          <div>
                            <p className="text-sm font-semibold">Juez {c.seat}</p>
                            <p className="font-mono text-xl font-bold tracking-[0.2em]">{c.code}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold">Resultado</h2>
                {match.status === "DONE" ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm">
                      Ganó{" "}
                      <strong>{(match.winner === "RED" ? match.red?.name : match.blue?.name) ?? "—"}</strong> por{" "}
                      {match.winMethod}.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {snap.queue[0] && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => send({ action: "call", matchId: snap.queue[0].id })}
                        >
                          Llamar la siguiente (#{snap.queue[0].number})
                        </button>
                      )}
                      <button type="button" className="btn" onClick={() => send({ action: "clear" })}>
                        Liberar área
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          if (window.confirm("¿Reabrir esta pelea y anular el resultado?")) send({ action: "reopen" });
                        }}
                      >
                        Reabrir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-slate-600">
                      Sugerido por el sistema:{" "}
                      <strong className="text-slate-900">
                        {match.suggestion.winner
                          ? `${match.suggestion.winner === "RED" ? brand.c1Name : brand.c2Name} · ${match.suggestion.reason}`
                          : match.suggestion.reason}
                      </strong>
                    </p>
                    <div>
                      <label className="label" htmlFor="method">
                        Forma de victoria
                      </label>
                      <select
                        id="method"
                        value={chosenMethod}
                        onChange={(e) => setMethod(e.target.value)}
                        className="input"
                      >
                        {match.rules.winMethods.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="btn h-12 border-transparent bg-c1 font-bold text-white hover:bg-c1 hover:brightness-110"
                        onClick={() => finish("RED")}
                      >
                        Gana {brand.c1Name}
                      </button>
                      <button
                        type="button"
                        className="btn h-12 border-transparent bg-c2 font-bold text-white hover:bg-c2 hover:brightness-110"
                        onClick={() => finish("BLUE")}
                      >
                        Gana {brand.c2Name}
                      </button>
                    </div>
                    {match.phase === "ENDED" && (
                      <div className="flex items-end gap-2 border-t border-slate-100 pt-3">
                        <div>
                          <label className="label" htmlFor="extra">
                            Round extra (min:seg)
                          </label>
                          <input
                            id="extra"
                            value={extra}
                            onChange={(e) => setExtra(e.target.value)}
                            className="input w-28"
                          />
                        </div>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => send({ action: "extra", seconds: extraSeconds() })}
                        >
                          Agregar round extra
                        </button>
                      </div>
                    )}
                    {match.phase === "IDLE" && (
                      <button type="button" className="btn btn-sm" onClick={() => send({ action: "clear" })}>
                        Devolver a la lista de espera
                      </button>
                    )}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Últimas acciones</h2>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!live || match.log.length === 0}
                    onClick={() => send({ action: "undo" })}
                  >
                    Deshacer la última
                  </button>
                </div>
                {match.log.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Todavía no hay acciones de mesa.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {match.log.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 py-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${e.corner === "RED" ? "bg-c1" : "bg-c2"}`} />
                        <span className="flex-1">
                          {EVENT_LABEL[e.type] ?? e.type}
                          {e.judge ? ` (juez ${e.judge})` : ""}
                        </span>
                        <span className="tabular font-semibold">
                          {e.type === "DECISION" ? "" : e.value > 0 ? `+${e.value}` : e.value}
                        </span>
                        <span className="text-xs text-slate-400">R{e.round}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <Queue queue={snap.queue} canCall={canCall} send={send} />
          </>
        )}
      </main>
    </div>
  );
}
