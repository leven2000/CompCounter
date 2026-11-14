"use client";

import { useEffect, useState } from "react";
import type { BoardData, BoardRow } from "@/lib/board";
import { brandStyle } from "@/lib/brand";
import { BrandLogo, Flag } from "@/components/bits";

const PAGE_SIZE = 9;
const ROTATE_MS = 9000;

const STATE: Record<BoardRow["state"], { label: string; className: string }> = {
  LIVE: { label: "En curso", className: "bg-emerald-500 text-black" },
  CALLED: { label: "Presentarse", className: "animate-pulse bg-amber-400 text-black" },
  NEXT: { label: "Prepararse", className: "bg-cyan-400 text-black" },
  WAITING: { label: "En espera", className: "border border-white/25 text-white/70" },
  PENDING: { label: "Por definir", className: "border border-white/15 text-white/40" },
};

function Fighter({ row, corner, showFlags }: { row: BoardRow; corner: "red" | "blue"; showFlags: boolean }) {
  const fighter = row[corner];
  return (
    <span className={`flex min-w-0 items-center gap-[0.6vw] ${corner === "red" ? "justify-end" : ""}`}>
      {corner === "blue" && showFlags && fighter?.country && (
        <Flag code={fighter.country} className="h-[2.2vh] w-[3.2vh]" />
      )}
      <span className={`truncate ${fighter ? "" : "text-white/40"}`}>{fighter?.name ?? "Por definir"}</span>
      {corner === "red" && showFlags && fighter?.country && (
        <Flag code={fighter.country} className="h-[2.2vh] w-[3.2vh]" />
      )}
    </span>
  );
}

export function Board({ slug, initial }: { slug: string; initial: BoardData }) {
  const [data, setData] = useState(initial);
  const [clock, setClock] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/board/${slug}`, { cache: "no-store" });
        const json = (await res.json()) as BoardData | null;
        if (alive && json) setData(json);
      } catch {}
    };
    const poll = setInterval(load, 4000);
    const tick = setInterval(() => {
      setClock(new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()));
    }, 1000);
    const rotate = setInterval(() => setPage((p) => p + 1), ROTATE_MS);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
      clearInterval(rotate);
    };
  }, [slug]);

  const pinned = data.rows.filter((r) => r.state === "LIVE" || r.state === "CALLED");
  const rest = data.rows.filter((r) => r.state !== "LIVE" && r.state !== "CALLED");
  const perPage = Math.max(3, PAGE_SIZE - pinned.length);
  const pages = Math.max(1, Math.ceil(rest.length / perPage));
  const current = page % pages;
  const visible = [...pinned, ...rest.slice(current * perPage, current * perPage + perPage)];

  return (
    <div
      style={brandStyle(data.brand)}
      className="flex h-dvh flex-col overflow-hidden bg-[#05070c] font-board text-white"
    >
      <header className="flex items-center gap-[1.5vw] border-b border-white/10 px-[2vw] py-[1.6vh]">
        <BrandLogo brand={data.brand} className="h-[7vh]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[4.4vh] leading-none font-semibold uppercase">{data.tournament.name}</p>
          <p className="mt-[0.6vh] text-[2.2vh] leading-none tracking-[0.25em] text-amber-300 uppercase">
            Orden de peleas
          </p>
        </div>
        <p className="tabular text-[6vh] leading-none font-medium text-amber-300">{clock}</p>
      </header>

      <div className="grid grid-cols-[7vw_6vw_1fr_19vw_10vw_12vw] gap-x-[1.2vw] border-b border-white/10 px-[2vw] py-[1vh] text-[1.9vh] tracking-[0.2em] text-white/50 uppercase">
        <span>Hora</span>
        <span>Pelea</span>
        <span className="text-center">Competidores</span>
        <span>Categoría</span>
        <span>Área</span>
        <span>Estado</span>
      </div>

      <main className="min-h-0 flex-1">
        {visible.length === 0 ? (
          <p className="flex h-full items-center justify-center text-[3vh] text-white/50 uppercase">
            No hay peleas programadas por ahora
          </p>
        ) : (
          visible.map((row, i) => (
            <div
              key={row.id}
              className={`grid h-[8.2vh] grid-cols-[7vw_6vw_1fr_19vw_10vw_12vw] items-center gap-x-[1.2vw] px-[2vw] text-[3.3vh] uppercase ${
                i % 2 === 0 ? "bg-white/[0.04]" : ""
              } ${row.state === "LIVE" ? "text-emerald-300" : row.state === "CALLED" ? "text-amber-300" : ""}`}
            >
              <span className="tabular font-medium text-amber-300">
                {row.scheduledAt != null ? new Date(row.scheduledAt).toISOString().slice(11, 16) : "--:--"}
              </span>
              <span className="tabular text-white/70">{row.number > 0 ? row.number : "—"}</span>
              <span className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-[0.8vw] font-medium">
                <Fighter row={row} corner="red" showFlags={data.brand.showFlags} />
                <span className="text-[2vh] text-white/40">vs</span>
                <Fighter row={row} corner="blue" showFlags={data.brand.showFlags} />
              </span>
              <span className="truncate text-[2.4vh] text-white/70">
                {row.categoryName}
                {row.label ? ` · ${row.label}` : ""}
              </span>
              <span className="truncate font-medium">{row.areaName ?? "—"}</span>
              <span>
                <span
                  className={`inline-block rounded-[0.6vh] px-[1.2vh] py-[0.4vh] text-[2.2vh] leading-tight font-semibold ${STATE[row.state].className}`}
                >
                  {STATE[row.state].label}
                </span>
              </span>
            </div>
          ))
        )}
      </main>

      <footer className="flex items-center justify-between border-t border-white/10 px-[2vw] py-[1vh] text-[2vh] tracking-[0.2em] text-white/50 uppercase">
        <span>
          {data.rows.length} {data.rows.length === 1 ? "pelea pendiente" : "peleas pendientes"}
        </span>
        <span>
          Página {current + 1} de {pages}
        </span>
      </footer>
    </div>
  );
}
