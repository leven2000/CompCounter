/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, type CSSProperties } from "react";
import { brandStyle, type Brand } from "@/lib/brand";
import type { MatchView, QueueItem, Snapshot } from "@/lib/live";
import { formatClock, type Corner } from "@/lib/rules";
import { BrandLogo, Flag } from "@/components/bits";
import { phaseLabel, useLive, usePhaseBeep, useRemaining } from "./useLive";

type BoardProps = { snap: Snapshot; match: MatchView; brand: Brand; remaining: number };

function clockParts(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 100));
  return {
    main: `${Math.floor(t / 600)}:${String(Math.floor((t % 600) / 10)).padStart(2, "0")}`,
    tenth: t % 10,
  };
}

function roundText(match: MatchView) {
  if (match.phase === "REST") return "Descanso";
  if (match.phase === "ENDED") return "Tiempo cumplido";
  if (match.currentRound > match.rounds) return "Round extra";
  return `Round ${match.currentRound}/${match.rounds}`;
}

function winnerName(match: MatchView) {
  return (match.winner === "RED" ? match.red?.name : match.blue?.name) ?? "—";
}

function KickCorner({ match, corner, brand }: { match: MatchView; corner: Corner; brand: Brand }) {
  const fighter = corner === "RED" ? match.red : match.blue;
  const side = match.sides[corner];
  const right = corner === "BLUE";
  const color = corner === "RED" ? "text-c1" : "text-c2";
  const big = match.rules.mode === "judges" ? match.favor[corner] : side.score;
  const dimmed = match.status === "DONE" && match.winner !== corner;

  const stats: [string, number][] = [];
  if (match.rules.exits) stats.push(["EX", side.exits]);
  if (match.rules.warnings) stats.push(["WA", side.warn]);
  if (match.rules.minusPoints) stats.push(["MP", side.minusTotal]);
  if (match.rules.knockdowns) stats.push(["KD", side.kd]);
  if (right) stats.reverse();

  const label = fighter?.countryCode ?? (corner === "RED" ? brand.c1Name : brand.c2Name);
  const info = [
    fighter?.name ?? "Por definir",
    brand.showTeams ? fighter?.team : null,
    fighter?.countryName,
  ].filter((line): line is string => !!line);
  while (info.length < 3) info.push(" ");

  return (
    <div className={`flex min-w-0 flex-col ${right ? "items-end" : "items-start"} ${dimmed ? "opacity-30" : ""}`}>
      <div className="w-full text-center text-[1.35vw] leading-tight font-bold uppercase">
        {info.map((line, i) => (
          <p key={i} className={`truncate ${i > 0 ? "opacity-90" : ""}`}>
            {line}
          </p>
        ))}
      </div>
      <div className={`mt-[1.2vh] flex items-center gap-[1.2vw] ${right ? "flex-row-reverse" : ""}`}>
        {fighter?.photoUrl && (
          <img src={fighter.photoUrl} alt="" className="h-[5.2vw] w-[5.2vw] rounded-full object-cover" />
        )}
        {brand.showFlags && fighter?.country && <Flag code={fighter.country} className="h-[4.4vw] w-[6.6vw]" />}
        <span className={`text-[5.2vw] leading-none font-black uppercase ${color}`}>{label}</span>
      </div>
      <div className={`mt-auto flex flex-col ${right ? "items-end" : "items-start"} px-[2vw]`}>
        <span className={`tabular text-[15vw] leading-[0.95] font-black ${color}`}>{big}</span>
        <div className="mt-[0.5vh] flex gap-[1.6vw]">
          {stats.map(([name, value]) => (
            <div key={name} className="flex flex-col items-center">
              <span className={`text-[2.1vw] leading-none font-black ${color}`}>{name}</span>
              <span
                className={`tabular mt-[0.6vh] text-[2.1vw] leading-none font-black ${
                  value > 0 ? "text-[var(--tv-clock)]" : "opacity-30"
                }`}
              >
                {value > 0 ? value : "–"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JudgeBars({ match }: { match: MatchView }) {
  return (
    <div className="relative flex w-[30vw] flex-col gap-[1vh] py-[0.8vh]">
      <span className="absolute inset-y-0 left-1/2 w-[0.4vw] -translate-x-1/2 rounded-full bg-[var(--tv-fg)]" />
      {match.judges.map((j) => {
        const diff = j.red - j.blue;
        const blocks = Array.from({ length: Math.min(8, Math.abs(diff)) });
        return (
          <div key={j.seat} className="grid h-[3.4vh] grid-cols-2 gap-[1vw]">
            <div className="flex justify-end gap-[0.3vw]">
              {diff > 0 && blocks.map((_, i) => <span key={i} className="w-[1.5vw] rounded-[0.25vw] bg-c1" />)}
            </div>
            <div className="flex justify-start gap-[0.3vw]">
              {diff < 0 && blocks.map((_, i) => <span key={i} className="w-[1.5vw] rounded-[0.25vw] bg-c2" />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KickBoard({ snap, match, brand, remaining }: BoardProps) {
  const clock = clockParts(remaining);
  const done = match.status === "DONE";
  const judges = match.rules.mode === "judges";

  return (
    <div className="flex min-h-0 flex-1 flex-col px-[2vw] pt-[1.2vh] pb-[1.6vh]">
      <p className="truncate text-center text-[1.5vw] font-bold text-[var(--tv-clock)]">
        {[snap.area.name, match.categoryName].join(" - ")}
        {match.label ? ` | ${match.label.toUpperCase()}` : ""}
      </p>

      <div className="mt-[1vh] grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] gap-[1vw]">
        <KickCorner match={match} corner="RED" brand={brand} />

        <div className="flex flex-col items-center">
          <BrandLogo brand={brand} className="h-[14vh]" />
          <div className="flex flex-1 flex-col items-center justify-center gap-[2vh]">
            {done ? (
              <div className="text-center">
                <p className="text-[1.8vw] font-black tracking-[0.3em] text-[var(--tv-clock)] uppercase">
                  Ganador
                </p>
                <p
                  className={`mt-[1vh] rounded-[0.8vw] px-[2vw] py-[1.2vh] text-[3.6vw] leading-tight font-black text-white ${
                    match.winner === "RED" ? "bg-c1" : "bg-c2"
                  }`}
                >
                  {winnerName(match)}
                </p>
                <p className="mt-[1.2vh] text-[2.2vw] font-black">{match.winMethod}</p>
              </div>
            ) : (
              <>
                {judges && <JudgeBars match={match} />}
                <p
                  className={`tabular leading-none font-black ${
                    match.phase === "REST" ? "text-cyan-400" : "text-[var(--tv-clock)]"
                  } ${match.phase === "ROUND" && !match.clock.running ? "opacity-60" : ""}`}
                >
                  <span className="text-[10.5vw]">{clock.main}</span>
                  <span className="text-[4.8vw]">.{clock.tenth}</span>
                </p>
              </>
            )}
          </div>
        </div>

        <KickCorner match={match} corner="BLUE" brand={brand} />
      </div>

      <div className="mt-[1vh] flex flex-wrap items-center justify-center gap-[1.2vw]">
        <span className="text-[2.6vw] leading-none font-black">{done ? "Finalizada" : roundText(match)}</span>
        {judges &&
          match.judges.map((j) => (
            <span
              key={j.seat}
              className={`tabular rounded-[0.4vw] px-[0.9vw] py-[0.5vh] text-[2.1vw] leading-none font-black ${
                j.red > j.blue
                  ? "bg-c1 text-white"
                  : j.blue > j.red
                    ? "bg-c2 text-white"
                    : "bg-slate-300 text-slate-900"
              }`}
            >
              J{j.seat} {j.red}:{j.blue}
            </span>
          ))}
      </div>
    </div>
  );
}

function nameSize(name: string) {
  if (name.length <= 14) return "text-[11vh]";
  if (name.length <= 22) return "text-[9vh]";
  return "text-[7vh]";
}

function RowsCorner({ match, corner, brand }: { match: MatchView; corner: Corner; brand: Brand }) {
  const fighter = corner === "RED" ? match.red : match.blue;
  const side = match.sides[corner];
  const done = match.status === "DONE";
  const won = done && match.winner === corner;
  const name = fighter?.name ?? "Por definir";

  const stats: [string, number][] = [];
  if (match.rules.advantages) stats.push(["Ventajas", side.advTotal]);
  if (match.rules.penalties) stats.push(["Penaliz.", side.pen]);
  if (match.rules.warnings) stats.push(["Advert.", side.warn]);
  if (match.rules.minusPoints) stats.push(["Negativos", side.minusTotal]);

  return (
    <div
      className={`flex min-h-0 flex-1 items-stretch border-b border-[var(--tv-line)] ${
        done && !won ? "opacity-35" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center px-[2.5vw]">
        <p className="flex items-center gap-[1.6vw]">
          {fighter?.photoUrl && (
            <img src={fighter.photoUrl} alt="" className="h-[13vh] w-[13vh] shrink-0 rounded-full object-cover" />
          )}
          {brand.showFlags && fighter?.country && (
            <Flag code={fighter.country} className="h-[8.5vh] w-[12.5vh]" />
          )}
          <span className={`truncate leading-none font-medium uppercase ${nameSize(name)}`}>{name}</span>
          {won && (
            <span className="shrink-0 rounded-[0.6vh] bg-[var(--tv-clock)] px-[1.2vh] py-[0.5vh] text-[3vh] leading-none font-semibold text-black uppercase">
              Ganador
            </span>
          )}
        </p>
        {brand.showTeams && (
          <p className="mt-[1.2vh] truncate text-[3.8vh] leading-none text-[var(--tv-dim)] uppercase">
            {fighter?.team ?? " "}
          </p>
        )}
      </div>

      {stats.length > 0 && (
        <div className="flex shrink-0 flex-col items-center justify-center gap-[1vh] px-[1.8vw]">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-[1.7vh] leading-none tracking-wider text-[var(--tv-dim)] uppercase">
                {label}
              </span>
              <span
                className={`tabular text-[8vh] leading-[1.05] font-medium ${
                  value > 0 ? "" : "text-[var(--tv-dim)]"
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {match.rules.pointButtons.length > 0 && (
        <div
          className={`flex aspect-square h-full shrink-0 items-center justify-center text-white ${
            corner === "RED" ? "bg-c1" : "bg-c2"
          }`}
        >
          <span className="tabular text-[27vh] leading-none font-semibold">{side.score}</span>
        </div>
      )}
    </div>
  );
}

function RowsBoard({ snap, match, brand, remaining }: BoardProps) {
  const done = match.status === "DONE";
  const showPhase = match.rounds > 1 || match.phase === "REST" || match.phase === "ENDED";
  const heading = match.label ?? snap.area.name;
  const detail = [match.number ? `Pelea ${match.number}` : null, snap.area.name]
    .filter((part): part is string => !!part && part.toLowerCase() !== heading.toLowerCase())
    .join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col font-board">
      <RowsCorner match={match} corner="RED" brand={brand} />
      <RowsCorner match={match} corner="BLUE" brand={brand} />
      <div className="flex h-[27vh] shrink-0 items-center gap-[2vw] bg-[var(--tv-panel)] px-[2.5vw]">
        <BrandLogo brand={brand} className="h-[10vh]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[3.2vh] leading-tight uppercase">
            <span className="text-[var(--tv-clock)]">
              {done ? `Ganó por ${match.winMethod ?? ""}` : heading}
            </span>
            <span className="ml-[1vw] text-[var(--tv-dim)]">{done ? winnerName(match) : detail}</span>
          </p>
          <p className="truncate text-[6vh] leading-tight uppercase">{match.categoryName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          {showPhase && !done && (
            <span className="text-[3vh] leading-none tracking-widest text-[var(--tv-dim)] uppercase">
              {phaseLabel(match)}
            </span>
          )}
          <span
            className={`tabular text-[21vh] leading-none font-medium ${
              match.clock.running
                ? match.phase === "REST"
                  ? "text-cyan-400"
                  : "text-[var(--tv-clock)]"
                : "text-[var(--tv-dim)]"
            }`}
          >
            {formatClock(remaining).padStart(5, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}

function Upcoming({ queue }: { queue: QueueItem[] }) {
  return (
    <div className="w-full max-w-[72vw]">
      <p className="mb-[1.5vh] text-[1.4vw] font-semibold tracking-[0.3em] text-[var(--tv-dim)] uppercase">
        Próximas peleas
      </p>
      <ul className="space-y-[1.2vh]">
        {queue.slice(0, 5).map((q) => (
          <li
            key={q.id}
            className="flex items-center gap-[2vw] rounded-[0.8vw] border border-[var(--tv-line)] px-[2vw] py-[1.4vh] text-[1.9vw]"
          >
            <span className="tabular w-[8vw] shrink-0 text-[1.3vw] font-semibold text-[var(--tv-dim)]">
              Pelea {q.number}
            </span>
            <span className="flex-1 truncate text-right font-bold">{q.red?.name ?? "—"}</span>
            <span className="text-[1.2vw] text-[var(--tv-dim)]">vs</span>
            <span className="flex-1 truncate font-bold">{q.blue?.name ?? "—"}</span>
            <span className="w-[22vw] shrink-0 truncate text-right text-[1.2vw] text-[var(--tv-dim)]">
              {q.categoryName}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TvBoard({ areaId, initialBrand }: { areaId: string; initialBrand: Brand }) {
  const { snap, offset, online } = useLive(areaId);
  const [sound, setSound] = useState(false);
  const match = snap?.match ?? null;
  const brand = snap?.brand ?? initialBrand;
  const remaining = useRemaining(match?.clock, offset);
  usePhaseBeep(match, sound);

  const dark = brand.tvTheme !== "light";
  const rows = match?.rules.board === "rows";
  const palette = dark
    ? {
        "--tv-bg": rows ? "#1b1b1e" : "#000000",
        "--tv-fg": "#ffffff",
        "--tv-dim": "rgba(255,255,255,0.5)",
        "--tv-line": "rgba(255,255,255,0.12)",
        "--tv-panel": "#26262a",
        "--tv-clock": "#fde047",
      }
    : {
        "--tv-bg": "#f8fafc",
        "--tv-fg": "#0f172a",
        "--tv-dim": "rgba(15,23,42,0.5)",
        "--tv-line": "rgba(15,23,42,0.15)",
        "--tv-panel": "#e2e8f0",
        "--tv-clock": "#b45309",
      };

  return (
    <div
      style={{ ...brandStyle(brand), ...palette } as CSSProperties}
      className="relative flex h-dvh flex-col overflow-hidden bg-[var(--tv-bg)] text-[var(--tv-fg)]"
    >
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-20 transition-opacity hover:opacity-100">
        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          className="rounded border border-current/40 bg-[var(--tv-bg)] px-2 py-1 text-xs"
        >
          {sound ? "Sonido sí" : "Sonido no"}
        </button>
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen?.()}
          className="rounded border border-current/40 bg-[var(--tv-bg)] px-2 py-1 text-xs"
        >
          Pantalla completa
        </button>
      </div>
      {snap && !online && (
        <span className="absolute top-2 left-2 z-10 animate-pulse rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">
          Reconectando…
        </span>
      )}

      {!snap ? (
        <main className="flex flex-1 items-center justify-center text-[2vw] text-[var(--tv-dim)]">
          Conectando…
        </main>
      ) : !match ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-[4vw]">
          <BrandLogo brand={brand} className="h-[14vh]" />
          <p className="text-center text-[3vw] leading-tight font-black">
            {snap.tournament.name}
            <span className="block text-[1.8vw] font-semibold text-[var(--tv-dim)]">{snap.area.name}</span>
          </p>
          {snap.queue.length > 0 ? (
            <Upcoming queue={snap.queue} />
          ) : (
            <p className="text-[1.6vw] text-[var(--tv-dim)]">No hay peleas en espera en esta área.</p>
          )}
        </main>
      ) : rows ? (
        <RowsBoard snap={snap} match={match} brand={brand} remaining={remaining} />
      ) : (
        <KickBoard snap={snap} match={match} brand={brand} remaining={remaining} />
      )}
    </div>
  );
}
