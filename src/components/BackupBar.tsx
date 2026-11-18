"use client";

import { useEffect, useState } from "react";
import type { BackupStatus } from "@/types/desktop";

function ago(from: number, now: number) {
  const minutes = Math.max(0, Math.round((now - from) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

export function BackupBar() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const api = window.compcounterDesktop?.backup;
    if (!api) return;
    let alive = true;
    const refresh = () =>
      void api.status().then((value) => {
        if (!alive || !value) return;
        setStatus(value);
        setNow(Date.now());
      });
    refresh();
    const timer = setInterval(refresh, 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!status) return null;
  const api = window.compcounterDesktop!.backup;
  const apply = (value: BackupStatus | null) => {
    if (!value) return;
    setStatus(value);
    setNow(Date.now());
  };

  return (
    <footer className="border-t border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 text-xs text-slate-600">
        <span>
          <strong className="text-slate-900">Copia de seguridad:</strong>{" "}
          {status.busy
            ? "guardando…"
            : status.lastAt
              ? `la última, ${ago(status.lastAt, now)}`
              : "todavía no se hizo ninguna desde que abriste el programa"}
        </span>
        <span className="min-w-0 truncate" title={status.dir}>
          Carpeta: {status.dir}
        </span>
        {status.sameDisk && (
          <span className="text-amber-700">
            Está en el mismo disco que los datos: para estar cubierto si el disco falla, elegí un pendrive u otro disco.
          </span>
        )}
        {status.error && <span className="font-medium text-red-700">{status.error}</span>}
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => void api.now().then(apply)}>
            Hacer una ahora
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void api.openFolder()}>
            Abrir carpeta
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void api.chooseFolder().then(apply)}>
            Cambiar carpeta
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void api.restore()}>
            Restaurar…
          </button>
        </span>
      </div>
    </footer>
  );
}
