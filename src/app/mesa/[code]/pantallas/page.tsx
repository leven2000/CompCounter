import { boardLink, overviewLink, tvLink, type AccessLink } from "@/lib/access-links";
import { DESKTOP } from "@/lib/desktop";
import { loadMesa } from "@/lib/mesa";
import { baseUrl } from "@/lib/server-url";
import { AccessCard } from "@/components/AccessCard";

export default async function MesaScreensPage({ params }: PageProps<"/mesa/[code]/pantallas">) {
  const { code } = await params;
  const mesa = await loadMesa(code);
  if (!mesa) return null;
  const origin = await baseUrl();

  const links: AccessLink[] = [
    boardLink(origin, mesa.tournament.slug),
    overviewLink(origin, mesa.tournament.slug),
    ...mesa.areas.map((a) => tvLink(origin, a.id, a.name)),
  ];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold">Pantallas</h1>
      <p className="mt-1 mb-4 max-w-2xl text-sm text-slate-500">
        {DESKTOP
          ? "Cada pantalla se abre en su propia ventana. Si hay un televisor o proyector conectado a esta computadora, se abre ahí en pantalla completa. F11 entra y sale de pantalla completa."
          : "Abrí cada link en el navegador del televisor y ponelo en pantalla completa. Estos links son solo para mirar: no muestran ni necesitan el código de mesa."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => (
          <AccessCard key={link.id} link={link} desktop={DESKTOP} />
        ))}
      </div>
    </main>
  );
}
