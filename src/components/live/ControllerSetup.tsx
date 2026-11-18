"use client";

import { useRef, useState } from "react";
import { useControllers } from "./useControllers";

type Area = { id: string; name: string; judges: number };

const ACTIONS = ["RED_PLUS", "RED_MINUS", "BLUE_PLUS", "BLUE_MINUS"] as const;
const DEFAULTS: Record<string, string> = { RED_PLUS: "B", RED_MINUS: "START", BLUE_PLUS: "X", BLUE_MINUS: "BACK" };

export function ControllerSetup({
  areas,
  corner1,
  corner2,
}: {
  areas: Area[];
  corner1: string;
  corner2: string;
}) {
  const state = useControllers();
  const [notice, setNotice] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);
  const run = useRef(0);

  if (!state) {
    return (
      <p className="card text-sm text-slate-600">
        Los controles solo se usan en la versión de escritorio de CompCounter.
      </p>
    );
  }
  const api = window.compcounterDesktop!.controllers;
  const label = (button: string) => state.buttons.find((b) => b.id === button)?.label ?? button;
  const actionLabel: Record<string, string> = {
    RED_PLUS: `Sumar a ${corner1}`,
    RED_MINUS: `Restar a ${corner1}`,
    BLUE_PLUS: `Sumar a ${corner2}`,
    BLUE_MINUS: `Restar a ${corner2}`,
  };
  const actionOf = (button: string) => ACTIONS.find((a) => state.mapping[a] === button);
  const connected = state.slots.filter((s) => s.connected);
  const busy = state.capture != null;

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 4000);
  };

  const assignSeats = async (area: Area, seats: number[]) => {
    const id = ++run.current;
    const used: number[] = [];
    for (const seat of seats) {
      if (run.current !== id) return;
      setWaiting(`${area.name} · Juez ${seat}: que apriete cualquier botón de su control`);
      const result = await api.assign(area.id, seat, used);
      if (run.current !== id) return;
      if (!result?.ok || result.slot == null) {
        setWaiting(null);
        flash(`No se asignó el control del Juez ${seat}: nadie apretó un botón.`);
        return;
      }
      used.push(result.slot);
    }
    setWaiting(null);
    flash(seats.length > 1 ? `Controles de ${area.name} asignados.` : "Control asignado.");
  };

  const cancel = () => {
    run.current += 1;
    setWaiting(null);
    void api.cancel();
  };

  const remap = async (action: string) => {
    const id = ++run.current;
    setWaiting(`Apretá en cualquier control el botón para «${actionLabel[action]}»`);
    const result = await api.captureButton();
    if (run.current !== id) return;
    setWaiting(null);
    if (!result?.ok || !result.button) return;
    const mapping = { ...state.mapping };
    const other = ACTIONS.find((a) => a !== action && mapping[a] === result.button);
    if (other) mapping[other] = mapping[action];
    mapping[action] = result.button;
    const saved = await api.setMapping(mapping);
    if (!saved?.ok) flash(saved?.error ?? "No se pudo guardar.");
  };

  return (
    <div className="space-y-6">
      {(waiting || notice) && (
        <div
          className={`sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow ${
            waiting ? "bg-amber-300 text-black" : "bg-slate-900 text-white"
          }`}
          role="status"
        >
          <span>{waiting ?? notice}</span>
          {waiting && (
            <button type="button" className="btn btn-sm" onClick={cancel}>
              Cancelar
            </button>
          )}
        </div>
      )}

      <section className="card">
        <h2 className="font-semibold">Controles conectados ({connected.length} de 4)</h2>
        {connected.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No hay ningún control prendido. Tienen que estar emparejados con Windows, por Bluetooth o con su
            adaptador, y prendidos. Aparecen acá solos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {connected.map((s) => {
              const area = areas.find((a) => a.id === s.areaId);
              return (
                <li key={s.slot} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="w-24 font-medium">Control {s.slot + 1}</span>
                  <span className="w-56 text-slate-600">
                    {s.seat == null
                      ? "Sin asignar"
                      : `Juez ${s.seat}${area ? ` · ${area.name}` : " · otro torneo"}`}
                    {s.suspect && <span className="ml-2 font-medium text-amber-700">verificar</span>}
                  </span>
                  <span className="flex min-h-6 flex-1 flex-wrap gap-1">
                    {s.down.map((button) => (
                      <span key={button} className="badge bg-emerald-100 text-emerald-800">
                        {label(button)}
                        {actionOf(button) ? ` → ${actionLabel[actionOf(button)!]}` : ""}
                      </span>
                    ))}
                  </span>
                  <button type="button" className="btn btn-sm" onClick={() => void api.identify(s.slot)}>
                    Hacer vibrar
                  </button>
                  {s.seat != null && (
                    <button type="button" className="btn btn-sm" onClick={() => void api.unassign(s.slot)}>
                      Quitar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Apretá un botón en un control para ver cuál es. Windows reconoce hasta 4 controles de este tipo a
          la vez.
        </p>
      </section>

      {areas.map((area) => {
        const seats = Array.from({ length: area.judges }, (_, i) => i + 1);
        return (
          <section key={area.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">
                {area.name} · {area.judges} {area.judges === 1 ? "juez" : "jueces"}
              </h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => void assignSeats(area, seats)}
              >
                Asignar todos en orden
              </button>
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {seats.map((seat) => {
                const pad = state.slots.find((s) => s.areaId === area.id && s.seat === seat);
                const ok = !!pad && pad.connected && !pad.suspect;
                return (
                  <li key={seat} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="flex w-24 items-center gap-2 font-medium">
                      <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
                      Juez {seat}
                    </span>
                    <span className="flex-1 text-slate-600">
                      {!pad
                        ? "Sin control"
                        : pad.suspect
                          ? `Control ${pad.slot + 1}: se reconectó junto con otro. Asignalo de nuevo para confirmar que es el suyo.`
                          : pad.connected
                            ? `Control ${pad.slot + 1}`
                            : `Control ${pad.slot + 1}, apagado`}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => void assignSeats(area, [seat])}
                    >
                      {pad ? "Cambiar" : "Asignar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Botones</h2>
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={() => void api.setMapping(DEFAULTS)}
          >
            Volver a los de fábrica
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Valen para todos los controles. El control vibra cuando el punto quedó registrado: si no vibra,
          no contó.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ACTIONS.map((action) => (
            <li key={action} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="flex-1 font-medium">{actionLabel[action]}</span>
              <span className="badge">{label(state.mapping[action])}</span>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void remap(action)}>
                Cambiar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">Antes de cada pelea</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Mirá en la mesa que cada juez tenga su punto verde. Los controles se apagan solos si pasan un rato sin uso.</li>
          <li>Si dos controles se apagaron a la vez, al prenderlos pueden quedar cruzados: por eso se piden asignar de nuevo.</li>
          <li>No prendas controles de repuesto durante una pelea: pueden ocupar el lugar de uno que se apagó.</li>
          <li>Los puntos solo cuentan con el round en marcha, igual que desde el celular.</li>
        </ul>
      </section>
    </div>
  );
}
