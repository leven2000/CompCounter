"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { brandStyle, type Brand } from "@/lib/brand";
import type { Snapshot } from "@/lib/live";
import { formatClock } from "@/lib/rules";
import { BrandLogo } from "@/components/bits";
import { phaseLabel, useRemaining } from "./useLive";

function AreaCard({ snap, offset, dark }: { snap: Snapshot; offset: number; dark: boolean }) {
  const match = snap.match;
  const remaining = useRemaining(match?.clock, offset);
  const operator = match?.rules.mode === "operator";
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-[1vw] border ${
        dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
      }`}
    >
      <header className="flex items-center justify-between bg-accent px-[1.2vw] py-[0.8vh] text-white">
        <span className="text-[1.5vw] font-black">{snap.area.name}</span>
        {match && (
          <span className="text-[1vw] opacity-80">
            {match.status === "DONE" ? "Finalizada" : `${phaseLabel(match)} · ${formatClock(remaining)}`}
          </span>
        )}
      </header>
      {match ? (
        <div className="px-[1.2vw] py-[1.2vh]">
          <p className="truncate text-[0.95vw] opacity-60">
            {match.categoryName}
            {match.label ? ` · ${match.label}` : ""}
          </p>
          {(["RED", "BLUE"] as const).map((corner) => {
            const fighter = corner === "RED" ? match.red : match.blue;
            const won = match.status === "DONE" && match.winner === corner;
            return (
              <div key={corner} className="mt-[0.8vh] flex items-center gap-[0.8vw]">
                <span className={`h-[3.4vh] w-[0.4vw] rounded-full ${corner === "RED" ? "bg-c1" : "bg-c2"}`} />
                <span className={`flex-1 truncate text-[1.5vw] ${won ? "font-black" : "font-semibold"}`}>
                  {fighter?.name ?? "—"}
                  {won ? " ✓" : ""}
                </span>
                <span className="tabular text-[1.8vw] font-black">
                  {operator ? match.sides[corner].score : match.favor[corner]}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-[1.2vw] py-[2vh] text-[1.1vw] opacity-60">Sin pelea en curso</p>
      )}
      <div className="mt-auto border-t border-current/10 px-[1.2vw] py-[1vh]">
        <p className="text-[0.85vw] font-semibold tracking-[0.2em] uppercase opacity-50">Siguen</p>
        {snap.queue.length === 0 ? (
          <p className="text-[1vw] opacity-50">—</p>
        ) : (
          <ul className="mt-[0.4vh] space-y-[0.3vh]">
            {snap.queue.slice(0, 4).map((q) => (
              <li key={q.id} className="flex gap-[0.6vw] text-[1.05vw]">
                <span className="tabular w-[2.6vw] shrink-0 opacity-50">#{q.number}</span>
                <span className="truncate">
                  {q.red?.name ?? "—"} <span className="opacity-50">vs</span> {q.blue?.name ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function TvOverview({
  slug,
  brand,
  tournamentName,
}: {
  slug: string;
  brand: Brand;
  tournamentName: string;
}) {
  const [data, setData] = useState<{ areas: Snapshot[]; offset: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/overview/${slug}`, { cache: "no-store" });
        const json = (await res.json()) as { areas: Snapshot[] };
        if (!alive) return;
        setData({ areas: json.areas, offset: (json.areas[0]?.now ?? Date.now()) - Date.now() });
      } catch {}
    };
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [slug]);

  const dark = brand.tvTheme !== "light";
  const count = data?.areas.length ?? 0;
  const columns = count <= 1 ? "grid-cols-1" : count <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div
      style={brandStyle(brand)}
      className={`flex h-dvh flex-col overflow-hidden ${
        dark ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-900"
      }`}
    >
      <header className="flex items-center gap-[1.5vw] px-[2vw] py-[1.5vh]">
        <BrandLogo brand={brand} className="h-[5vh]" />
        <p className="flex-1 text-[2vw] font-black">{tournamentName}</p>
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen?.()}
          className="rounded border border-current/30 px-2 py-1 text-xs opacity-60 hover:opacity-100"
        >
          Pantalla completa
        </button>
      </header>
      {!data ? (
        <p className="flex flex-1 items-center justify-center text-[1.6vw] opacity-60">Conectando…</p>
      ) : count === 0 ? (
        <p className="flex flex-1 items-center justify-center text-[1.6vw] opacity-60">
          Este torneo todavía no tiene áreas.
        </p>
      ) : (
        <main className={`grid min-h-0 flex-1 gap-[1.2vw] px-[2vw] pb-[2vh] ${columns}`}>
          {data.areas.map((snap) => (
            <AreaCard key={snap.area.id} snap={snap} offset={data.offset} dark={dark} />
          ))}
        </main>
      )}
    </div>
  );
}

export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
