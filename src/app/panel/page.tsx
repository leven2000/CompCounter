import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { formatDate } from "@/lib/util";
import { Notice } from "@/components/bits";
import { SubmitButton } from "@/components/ui";
import { createDemoTournament, createTournament } from "./actions";

const listSelect = {
  id: true,
  name: true,
  date: true,
  location: true,
  published: true,
  org: { select: { name: true } },
  _count: { select: { categories: true, participants: true } },
} as const;

type Row = {
  id: string;
  name: string;
  date: Date | null;
  location: string | null;
  published: boolean;
  org: { name: string };
  _count: { categories: number; participants: number };
};

function TournamentList({ rows, shared }: { rows: Row[]; shared?: boolean }) {
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((t) => (
        <li key={t.id}>
          <Link
            href={`/panel/torneos/${t.id}`}
            className="card flex flex-wrap items-center justify-between gap-4 transition hover:border-slate-400"
          >
            <div>
              <p className="font-semibold">{t.name}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {formatDate(t.date)}
                {t.location ? ` · ${t.location}` : ""}
                {shared ? ` · de ${t.org.name}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="badge">{t._count.categories} categorías</span>
              <span className="badge">{t._count.participants} participantes</span>
              {!t.published && <span className="badge bg-amber-100 text-amber-800">Oculto</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function PanelHome({ searchParams }: PageProps<"/panel">) {
  const { user, orgId, acting } = await requireOrganizer();
  const sp = await searchParams;
  const order = [{ date: "desc" as const }, { createdAt: "desc" as const }];
  const [tournaments, shared] = await Promise.all([
    db.tournament.findMany({ where: { orgId, quick: false }, orderBy: order, select: listSelect }),
    acting
      ? Promise.resolve([])
      : db.tournament.findMany({
          where: { quick: false, orgId: { not: orgId }, members: { some: { userId: user.id } } },
          orderBy: order,
          select: listSelect,
        }),
  ]);

  return (
    <>
      <Notice sp={sp} />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <h1 className="text-xl font-bold">Torneos</h1>
          {tournaments.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Todavía no creaste ninguno. Empezá con el formulario de al lado o creá el torneo demo.
            </p>
          ) : (
            <TournamentList rows={tournaments} />
          )}

          {shared.length > 0 && (
            <>
              <h2 className="mt-10 text-lg font-bold">Compartidos con vos</h2>
              <p className="text-sm text-slate-500">Torneos de otros organizadores que podés administrar.</p>
              <TournamentList rows={shared} shared />
            </>
          )}
        </section>

        <aside className="space-y-6">
          <div className="card h-fit">
            <h2 className="font-semibold">Nuevo torneo</h2>
            <form action={createTournament} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="name">
                  Nombre
                </label>
                <input id="name" name="name" required className="input" placeholder="Copa Apertura 2027" />
              </div>
              <div>
                <label className="label" htmlFor="date">
                  Fecha
                </label>
                <input id="date" name="date" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="location">
                  Lugar
                </label>
                <input id="location" name="location" className="input" placeholder="Club, ciudad" />
              </div>
              <SubmitButton className="btn btn-primary w-full">Crear torneo</SubmitButton>
            </form>
          </div>

          <form action={createDemoTournament} className="card h-fit">
            <h2 className="font-semibold">Torneo demo</h2>
            <p className="mt-1 mb-3 text-sm text-slate-500">
              Crea un torneo completo para mostrar el sistema: kickboxing de ring, light contact, point
              fighting, jiu-jitsu y grappling, con 47 competidores, llaves, horarios, tres áreas y algunas
              peleas ya jugadas.
            </p>
            <SubmitButton className="btn w-full">Crear torneo demo</SubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
