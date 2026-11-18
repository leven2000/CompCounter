import Link from "next/link";
import { DESKTOP } from "@/lib/desktop";
import { loadMesa } from "@/lib/mesa";
import { MesaConsole } from "@/components/live/MesaConsole";

export default async function MesaControlPage({ params, searchParams }: PageProps<"/mesa/[code]">) {
  const { code } = await params;
  const sp = await searchParams;
  const mesa = await loadMesa(code);
  if (!mesa) return null;

  if (mesa.areas.length === 0) {
    return (
      <p className="mx-auto max-w-xl px-6 py-16 text-center text-slate-600">
        Este torneo todavía no tiene áreas. El organizador las crea desde su panel.
      </p>
    );
  }
  const areaId = mesa.areas.find((a) => a.id === sp.area)?.id ?? mesa.areas[0].id;

  return (
    <>
      {mesa.areas.length > 1 && (
        <nav className="mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-4 pt-4">
          {mesa.areas.map((a) => (
            <Link
              key={a.id}
              href={`/mesa/${mesa.code}?area=${a.id}`}
              className={`btn btn-sm ${a.id === areaId ? "btn-dark" : ""}`}
            >
              {a.name}
            </Link>
          ))}
        </nav>
      )}
      <MesaConsole key={areaId} areaId={areaId} code={mesa.code} initialBrand={mesa.brand} desktop={DESKTOP} />
    </>
  );
}
