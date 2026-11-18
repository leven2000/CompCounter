import { notFound } from "next/navigation";
import { DESKTOP } from "@/lib/desktop";
import { loadMesa } from "@/lib/mesa";
import { ControllerSetup } from "@/components/live/ControllerSetup";

export default async function MesaControllersPage({ params }: PageProps<"/mesa/[code]/controles">) {
  const { code } = await params;
  if (!DESKTOP) notFound();
  const mesa = await loadMesa(code);
  if (!mesa) return null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold">Controles de los jueces</h1>
      <p className="mt-1 mb-6 max-w-3xl text-sm text-slate-500">
        Cada juez puntúa con un control inalámbrico tipo Xbox emparejado con esta computadora. Asigná un
        control a cada juez al empezar la jornada: la asignación no se guarda al cerrar el programa.
      </p>
      <ControllerSetup areas={mesa.areas} corner1={mesa.brand.c1Name} corner2={mesa.brand.c2Name} />
    </main>
  );
}
