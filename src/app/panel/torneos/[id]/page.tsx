import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { DESKTOP } from "@/lib/desktop";
import { Notice } from "@/components/bits";
import { SubmitButton } from "@/components/ui";
import {
  addTournamentMember,
  deleteTournament,
  removeTournamentMember,
  updateTournament,
} from "../../actions";

export default async function TournamentSummary({
  params,
  searchParams,
}: PageProps<"/panel/torneos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { orgId, scope, acting } = await requireOrganizer();
  const t = await db.tournament.findFirst({
    where: { id, AND: [scope] },
    include: {
      org: { select: { name: true } },
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, email: true } } },
      },
      _count: { select: { categories: true, participants: true, areas: true } },
    },
  });
  if (!t) notFound();
  const owner = t.orgId === orgId;

  const [brackets, played, total] = await Promise.all([
    db.category.count({ where: { tournamentId: t.id, matches: { some: {} } } }),
    db.match.count({ where: { category: { tournamentId: t.id }, status: "DONE" } }),
    db.match.count({ where: { category: { tournamentId: t.id }, status: { not: "BYE" } } }),
  ]);
  const base = `/panel/torneos/${t.id}`;

  const steps = [
    {
      href: `${base}/categorias`,
      title: "Categorías",
      detail: `${t._count.categories} creadas`,
      done: t._count.categories > 0,
      hint: "Modalidad, peso, cinturón o nivel, edad y género. También se crean solas al subir un Excel.",
    },
    {
      href: `${base}/participantes`,
      title: "Participantes",
      detail: `${t._count.participants} cargados`,
      done: t._count.participants > 0,
      hint: "Subí un Excel, cargalos a mano o pegá una lista. Después registrás el pesaje.",
    },
    {
      href: `${base}/llaves`,
      title: "Llaves",
      detail: `${brackets} de ${t._count.categories} generadas`,
      done: brackets > 0,
      hint: "Se arman solas, separando competidores de la misma academia.",
    },
    {
      href: `${base}/horarios`,
      title: "Horarios",
      detail: "Opcional",
      done: false,
      hint: "Calculá la hora de cada pelea por área y corregila a mano.",
    },
    {
      href: `${base}/areas`,
      title: "Áreas, mesa y TV",
      detail: `${t._count.areas} ${t._count.areas === 1 ? "área" : "áreas"}`,
      done: t._count.areas > 0,
      hint: "Asigná categorías a cada área, pasá el código de mesa y abrí las pantallas.",
    },
  ];

  return (
    <>
      <Notice sp={sp} />
      {!owner && (
        <p className="mb-6 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Este torneo es de <strong>{t.org.name}</strong> y te lo compartieron para administrarlo. Podés
          modificar todo menos eliminarlo o cambiar quién lo administra.
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="font-semibold">Pasos para armar el torneo</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className="card flex items-center gap-4 transition hover:border-slate-400">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      s.done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-slate-500">{s.hint}</p>
                  </div>
                  <span className="badge shrink-0">{s.detail}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-slate-500">
            Peleas jugadas: <strong className="text-slate-800">{played}</strong> de {total}
          </p>

          <div className={DESKTOP ? "hidden" : "card mt-8"}>
            <h2 className="font-semibold">Organizadores del torneo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dueño: <strong className="text-slate-800">{t.org.name}</strong>. Además del dueño, estas
              cuentas pueden administrar este torneo desde su propio panel.
            </p>
            {t.members.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Todavía no se agregó a nadie.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                {t.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{m.user.name}</p>
                      <p className="text-sm text-slate-500">{m.user.email}</p>
                    </div>
                    {owner && (
                      <form action={removeTournamentMember}>
                        <input type="hidden" name="tournamentId" value={t.id} />
                        <input type="hidden" name="memberId" value={m.id} />
                        <SubmitButton
                          className="btn btn-sm btn-danger"
                          confirm={`¿Quitarle a ${m.user.name} el acceso a este torneo?`}
                        >
                          Quitar
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {owner && (
              <form action={addTournamentMember} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <input type="hidden" name="tournamentId" value={t.id} />
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-56 flex-1">
                    <label className="label" htmlFor="member-email">
                      Email de la cuenta
                    </label>
                    <input id="member-email" name="email" type="email" required className="input" autoComplete="off" />
                  </div>
                  <SubmitButton>Agregar organizador</SubmitButton>
                </div>
                {acting ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="member-name">
                        Nombre (solo si la cuenta no existe)
                      </label>
                      <input id="member-name" name="name" className="input" />
                    </div>
                    <div>
                      <label className="label" htmlFor="member-password">
                        Contraseña inicial (solo si la cuenta no existe)
                      </label>
                      <input
                        id="member-password"
                        name="password"
                        type="password"
                        minLength={8}
                        autoComplete="new-password"
                        className="input"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Tiene que ser una cuenta que ya exista. Las cuentas nuevas las crea el administrador de
                    la plataforma.
                  </p>
                )}
              </form>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <form action={updateTournament} className="card space-y-4">
            <h2 className="font-semibold">Datos del torneo</h2>
            <input type="hidden" name="tournamentId" value={t.id} />
            <div>
              <label className="label" htmlFor="name">
                Nombre
              </label>
              <input id="name" name="name" defaultValue={t.name} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="date">
                Fecha
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={t.date ? t.date.toISOString().slice(0, 10) : ""}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="location">
                Lugar
              </label>
              <input id="location" name="location" defaultValue={t.location ?? ""} className="input" />
            </div>
            <label className={DESKTOP ? "hidden" : "flex items-center gap-2 text-sm"}>
              <input type="checkbox" name="published" defaultChecked={t.published} />
              Mostrar en el listado público de torneos
            </label>
            <SubmitButton>Guardar</SubmitButton>
          </form>

          {owner && (
            <form action={deleteTournament} className="card">
              <h2 className="font-semibold text-red-700">Eliminar torneo</h2>
              <p className="mt-1 mb-3 text-sm text-slate-500">
                Borra categorías, participantes, llaves y resultados.
              </p>
              <input type="hidden" name="tournamentId" value={t.id} />
              <SubmitButton
                className="btn btn-danger"
                confirm={`¿Eliminar "${t.name}" con todo su contenido? No se puede deshacer.`}
              >
                Eliminar
              </SubmitButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
