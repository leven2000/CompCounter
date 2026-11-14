"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brandStyle, type Brand } from "@/lib/brand";
import { formatClock, type Corner } from "@/lib/rules";
import { act, phaseLabel, useLive, useRemaining } from "./useLive";

type Pending = {
  clientId: string;
  matchId: string;
  corner: Corner;
  value: 1 | -1;
  ackNow: number | null;
};

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function JudgePad({
  areaId,
  code,
  seat,
  matchId,
  initialBrand,
}: {
  areaId: string;
  code: string;
  seat: number;
  matchId: string;
  initialBrand: Brand;
}) {
  const { snap, offset, online } = useLive(areaId, code);
  const [pending, setPending] = useState<Pending[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  const pendingRef = useRef<Pending[]>([]);
  const snapNow = useRef(0);

  const expired = !!snap && snap.match?.id !== matchId;
  const match = expired ? null : (snap?.match ?? null);
  const brand = snap?.brand ?? initialBrand;
  const remaining = useRemaining(match?.clock, offset);

  useEffect(() => {
    snapNow.current = snap?.now ?? 0;
  }, [snap]);

  const flush = useCallback(
    async (item: Pending) => {
      if (inFlight.current.has(item.clientId)) return;
      inFlight.current.add(item.clientId);
      const res = await act(code, {
        action: "click",
        corner: item.corner,
        value: item.value,
        clientId: item.clientId,
      });
      inFlight.current.delete(item.clientId);
      if (res.network) return;
      if (!res.ok) {
        setPending((list) => list.filter((p) => p.clientId !== item.clientId));
        setNotice(res.error ?? "No se pudo registrar");
        setTimeout(() => setNotice(null), 2500);
        return;
      }
      const ackNow = res.now ?? 0;
      setPending((list) => list.map((p) => (p.clientId === item.clientId ? { ...p, ackNow } : p)));
    },
    [code],
  );

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const timer = setInterval(() => {
      for (const p of pendingRef.current) {
        if (p.ackNow == null) void flush(p);
      }
      setPending((list) => {
        const kept = list.filter((p) => p.ackNow == null || snapNow.current < p.ackNow);
        return kept.length === list.length ? list : kept;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [flush]);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {}
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  const visible = pending.filter(
    (p) => p.matchId === match?.id && (p.ackNow == null || (snap?.now ?? 0) < p.ackNow),
  );
  const queued = pending.filter((p) => p.ackNow == null).length;
  const mine = match?.judges.find((j) => j.seat === seat);
  const tally = (corner: Corner) =>
    (corner === "RED" ? (mine?.red ?? 0) : (mine?.blue ?? 0)) +
    visible.filter((p) => p.corner === corner).reduce((acc, p) => acc + p.value, 0);

  const usesJudges = match?.rules.mode === "judges";
  const canScore = !!match && usesJudges && match.status === "LIVE" && match.phase === "ROUND";
  const mustDecide =
    !!match &&
    usesJudges &&
    match.status === "LIVE" &&
    match.phase === "ENDED" &&
    match.pendingDecisions.includes(seat);

  const tap = (corner: Corner, value: 1 | -1) => {
    if (!match || !canScore) return;
    if (value === -1 && tally(corner) <= 0) return;
    navigator.vibrate?.(value === 1 ? 25 : [15, 40, 15]);
    const item: Pending = { clientId: newId(), matchId: match.id, corner, value, ackNow: null };
    setPending((list) => [...list, item]);
    void flush(item);
  };

  const decide = (corner: Corner) => {
    void act(code, { action: "decision", corner }).then((res) => {
      if (!res.ok) {
        setNotice(res.error ?? "No se pudo registrar");
        setTimeout(() => setNotice(null), 2500);
      }
    });
  };

  let status = "Conectando…";
  if (snap) {
    if (!match) status = "Esperando la próxima pelea";
    else if (!usesJudges) status = "Esta pelea no se puntúa con jueces";
    else if (match.status === "DONE") status = "Pelea terminada";
    else if (match.phase === "IDLE") status = "Esperando el inicio";
    else if (match.phase === "REST") status = `Descanso · ${formatClock(remaining)}`;
    else if (match.phase === "ENDED") status = mustDecide ? "Empate en tu tarjeta" : "Tiempo cumplido";
    else status = `${phaseLabel(match)} · ${formatClock(remaining)}${match.clock.running ? "" : " (pausado)"}`;
  }

  if (expired) {
    return (
      <div
        style={brandStyle(brand)}
        className="flex h-dvh flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white"
      >
        <p className="rounded bg-white/10 px-2 py-0.5 text-sm font-bold">Juez {seat}</p>
        <h1 className="text-2xl font-bold">Esta pelea ya terminó</h1>
        <p className="max-w-xs text-sm text-white/70">
          El código era solo para esa pelea. Pedile a la mesa el de la próxima.
        </p>
        <a href="/codigo" className="btn btn-primary px-6 py-3 text-base">
          Ingresar otro código
        </a>
      </div>
    );
  }
  return (
    <div
      style={brandStyle(brand)}
      className="flex h-dvh touch-manipulation flex-col overflow-hidden bg-slate-950 text-white select-none"
    >
      <header className="flex items-center gap-3 px-3 py-2 text-sm">
        <span className="rounded bg-white/10 px-2 py-0.5 font-bold">Juez {seat}</span>
        <span className="min-w-0 flex-1 truncate opacity-70">
          {snap?.area.name ?? ""}
          {match ? ` · ${match.categoryName}` : ""}
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-400" : "animate-pulse bg-red-500"}`} />
          {online ? "Conectado" : "Sin conexión"}
        </span>
      </header>

      <p
        className={`px-3 py-1.5 text-center text-sm font-semibold ${
          canScore ? "bg-emerald-600" : mustDecide ? "bg-amber-500 text-slate-950" : "bg-white/10"
        }`}
      >
        {status}
        {queued > 0 ? ` · ${queued} ${queued === 1 ? "toque" : "toques"} sin enviar` : ""}
      </p>
      {notice && <p className="bg-red-600 px-3 py-1.5 text-center text-sm font-medium">{notice}</p>}

      <main className="grid min-h-0 flex-1 grid-cols-2 gap-1 p-1">
        {(["RED", "BLUE"] as Corner[]).map((corner) => {
          const fighter = corner === "RED" ? match?.red : match?.blue;
          const active = canScore || mustDecide;
          return (
            <div key={corner} className="flex min-h-0 flex-col gap-1">
              <button
                type="button"
                disabled={!active}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (mustDecide) decide(corner);
                  else tap(corner, 1);
                }}
                className={`flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg px-2 text-white transition active:brightness-125 disabled:opacity-35 ${
                  corner === "RED" ? "bg-c1" : "bg-c2"
                }`}
              >
                <span className="text-xs font-semibold tracking-[0.25em] uppercase opacity-80">
                  {corner === "RED" ? brand.c1Name : brand.c2Name}
                </span>
                <span className="mt-1 line-clamp-2 text-center text-lg leading-tight font-bold">
                  {fighter?.name ?? "—"}
                </span>
                {mustDecide ? (
                  <span className="mt-4 text-2xl font-black">Elegir ganador</span>
                ) : (
                  <span className="tabular mt-2 text-7xl leading-none font-black">{tally(corner)}</span>
                )}
              </button>
              <button
                type="button"
                disabled={!canScore || tally(corner) <= 0}
                onPointerDown={(e) => {
                  e.preventDefault();
                  tap(corner, -1);
                }}
                className="h-12 rounded-lg bg-white/10 text-sm font-semibold disabled:opacity-30"
              >
                Corregir −1
              </button>
            </div>
          );
        })}
      </main>
    </div>
  );
}
