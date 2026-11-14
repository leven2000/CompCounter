/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { updateBranding } from "@/app/panel/actions";
import type { Brand } from "@/lib/brand";
import { SubmitButton } from "./ui";

function ColorField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={name}
          name={name}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
        />
        <span className="font-mono text-sm text-slate-500">{value}</span>
      </div>
    </div>
  );
}

export function BrandingForm({ brand }: { brand: Brand }) {
  const [name, setName] = useState(brand.name);
  const [primary, setPrimary] = useState(brand.primary);
  const [accent, setAccent] = useState(brand.accent);
  const [theme, setTheme] = useState(brand.tvTheme);
  const [c1Name, setC1Name] = useState(brand.c1Name);
  const [c1Color, setC1Color] = useState(brand.c1Color);
  const [c2Name, setC2Name] = useState(brand.c2Name);
  const [c2Color, setC2Color] = useState(brand.c2Color);
  const [showFlags, setShowFlags] = useState(brand.showFlags);
  const [showTeams, setShowTeams] = useState(brand.showTeams);
  const dark = theme !== "light";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <form action={updateBranding} className="card space-y-6">
        <div>
          <label className="label" htmlFor="name">
            Nombre de la organización
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="logo">
            Logo (PNG, JPG o WebP, hasta 1 MB)
          </label>
          <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
          {brand.logoUrl && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="removeLogo" /> Quitar el logo actual
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField name="colorPrimary" label="Color principal" value={primary} onChange={setPrimary} />
          <ColorField name="colorAccent" label="Color de encabezados" value={accent} onChange={setAccent} />
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="label">Esquinas</legend>
          <div className="space-y-3">
            <input
              name="corner1Name"
              value={c1Name}
              onChange={(e) => setC1Name(e.target.value)}
              maxLength={16}
              aria-label="Nombre de la esquina 1"
              className="input"
            />
            <ColorField name="corner1Color" label="Color esquina 1" value={c1Color} onChange={setC1Color} />
          </div>
          <div className="space-y-3">
            <input
              name="corner2Name"
              value={c2Name}
              onChange={(e) => setC2Name(e.target.value)}
              maxLength={16}
              aria-label="Nombre de la esquina 2"
              className="input"
            />
            <ColorField name="corner2Color" label="Color esquina 2" value={c2Color} onChange={setC2Color} />
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="tvTheme">
            Pantalla de TV
          </label>
          <select
            id="tvTheme"
            name="tvTheme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="input"
          >
            <option value="dark">Fondo oscuro</option>
            <option value="light">Fondo claro</option>
          </select>
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="showFlags"
              checked={showFlags}
              onChange={(e) => setShowFlags(e.target.checked)}
            />
            Mostrar banderas de país
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="showTeams"
              checked={showTeams}
              onChange={(e) => setShowTeams(e.target.checked)}
            />
            Mostrar academia o equipo
          </label>
        </div>

        <SubmitButton>Guardar apariencia</SubmitButton>
      </form>

      <aside>
        <p className="label">Vista previa de la TV</p>
        <div
          className={`overflow-hidden rounded-xl border shadow-sm ${
            dark ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: accent, color: "#fff" }}>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" className="h-7 w-auto" />
            ) : (
              <span
                className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold"
                style={{ background: primary }}
              >
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-sm font-semibold">{name}</span>
            <span className="ml-auto text-xs opacity-70">Área 1 · Final</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr]">
            {[
              { n: c1Name, c: c1Color, who: "Sofía Paz", team: "Team Norte", score: 12 },
              null,
              { n: c2Name, c: c2Color, who: "Lucía Vera", team: "Dojo Sur", score: 9 },
            ].map((side, i) =>
              side ? (
                <div key={i} className="p-4 text-white" style={{ background: side.c }}>
                  <p className="text-[10px] font-semibold tracking-widest uppercase opacity-80">{side.n}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm leading-tight font-bold">
                    {showFlags && <img src="/flags/ar.svg" alt="" className="h-3 w-4 rounded-[1px]" />}
                    {side.who}
                  </p>
                  {showTeams && <p className="text-xs opacity-80">{side.team}</p>}
                  <p className="tabular mt-3 text-4xl font-black">{side.score}</p>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-center justify-center px-4">
                  <p className="tabular text-2xl font-bold">1:24</p>
                  <p className="text-[10px] tracking-widest uppercase opacity-60">Round 2</p>
                </div>
              ),
            )}
          </div>
        </div>
        <button type="button" className="btn btn-primary mt-4" style={{ background: primary }}>
          Así se ven los botones
        </button>
      </aside>
    </div>
  );
}
