"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchView, Snapshot } from "@/lib/live";

export function useLive(areaId: string, code?: string) {
  const [state, setState] = useState<{ snap: Snapshot | null; offset: number }>({
    snap: null,
    offset: 0,
  });
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const query = code ? `?code=${encodeURIComponent(code)}` : "";
    const source = new EventSource(`/api/stream/${areaId}${query}`);
    source.onopen = () => setOnline(true);
    source.onerror = () => setOnline(false);
    source.onmessage = (event) => {
      try {
        const snap = JSON.parse(event.data) as Snapshot;
        setState({ snap, offset: snap.now - Date.now() });
        setOnline(true);
      } catch {}
    };
    return () => source.close();
  }, [areaId, code]);

  return { ...state, online };
}

export function useRemaining(clock: MatchView["clock"] | undefined, offset: number) {
  const [now, setNow] = useState(0);
  const running = !!clock?.running;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [running]);

  if (!clock) return 0;
  if (!clock.running || clock.startedAt == null || now === 0) return clock.remainingMs;
  return Math.max(0, clock.remainingMs - Math.max(0, now + offset - clock.startedAt));
}

export type ActResponse = { ok: boolean; error?: string; now?: number; network?: boolean };

export async function act(code: string, body: Record<string, unknown>): Promise<ActResponse> {
  try {
    const res = await fetch("/api/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, ...body }),
    });
    return (await res.json()) as ActResponse;
  } catch {
    return { ok: false, error: "Sin conexión", network: true };
  }
}

export function beep(frequency = 880, ms = 700) {
  try {
    const ctx = new window.AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.2;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      void ctx.close();
    }, ms);
  } catch {}
}

export function usePhaseBeep(match: MatchView | null | undefined, enabled: boolean) {
  const previous = useRef<string | null>(null);
  const key = match ? `${match.id}:${match.phase}:${match.currentRound}` : null;
  const phase = match?.phase ?? null;

  useEffect(() => {
    const before = previous.current;
    previous.current = key;
    if (!enabled || !key || !before || before === key) return;
    if (before.split(":")[0] !== key.split(":")[0]) return;
    const beforePhase = before.split(":")[1];
    if (beforePhase === "ROUND" && (phase === "REST" || phase === "ENDED")) beep(660, 1200);
    else if (beforePhase === "REST" && phase === "ROUND") beep(990, 500);
  }, [key, phase, enabled]);
}

export function phaseLabel(match: MatchView) {
  if (match.status === "DONE") return "Finalizada";
  if (match.phase === "REST") return "Descanso";
  if (match.phase === "ENDED") return "Tiempo cumplido";
  if (match.currentRound > match.rounds) return "Round extra";
  if (match.rounds === 1) return match.phase === "IDLE" ? "Por empezar" : "En combate";
  return `Round ${match.currentRound} de ${match.rounds}`;
}
