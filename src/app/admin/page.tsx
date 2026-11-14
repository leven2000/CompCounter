import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/auth";
import { Notice } from "@/components/bits";
import { SubmitButton } from "@/components/ui";
import {
  createOrganizer,
  deleteOrganization,
  enterOrganization,
  resetPassword,
  setUserActive,
} from "./actions";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const orgs = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      users: { select: { id: true, email: true, name: true, active: true } },
      _count: { select: { tournaments: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <Notice sp={sp} />

      <section className="card">
        <h2 className="font-semibold">Nuevo organizador</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cada organizador tiene su propia organización, con sus torneos y su
          apariencia.
        </p>
        <form
          action={createOrganizer}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="label" htmlFor="orgName">
              Organización
            </label>
            <input
              id="orgName"
              name="orgName"
              required
              className="input"
              placeholder="Liga del Sur"
            />
          </div>
          <div>
            <label className="label" htmlFor="name">
              Nombre del responsable
            </label>
            <input id="name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña inicial
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="input"
              autoComplete="new-password"
            />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Crear organizador</SubmitButton>
          </div>
        </form>
      </section>

      <h2 className="mt-10 mb-3 font-semibold">
        Organizadores ({orgs.length})
      </h2>
      {orgs.length === 0 ? (
        <p className="text-sm text-slate-500">
          Todavía no diste de alta a nadie.
        </p>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div key={org.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{org.name}</p>
                  <p className="text-sm text-slate-500">
                    {org._count.tournaments}{" "}
                    {org._count.tournaments === 1 ? "torneo" : "torneos"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={enterOrganization}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <button className="btn btn-sm btn-primary">Entrar al panel</button>
                  </form>
                  <Link
                    href={`/admin/historial?org=${org.id}`}
                    className="btn btn-sm"
                  >
                    Ver historial
                  </Link>
                  <form action={deleteOrganization}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <SubmitButton
                      className="btn btn-sm btn-danger"
                      confirm={`¿Eliminar "${org.name}" con todos sus torneos? No se puede deshacer.`}
                    >
                      Eliminar
                    </SubmitButton>
                  </form>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {org.users.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-sm text-slate-500">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge ${u.active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                      >
                        {u.active ? "Activo" : "Suspendido"}
                      </span>
                      <form action={setUserActive}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={u.active ? "0" : "1"}
                        />
                        <button className="btn btn-sm">
                          {u.active ? "Suspender" : "Reactivar"}
                        </button>
                      </form>
                      <details className="relative">
                        <summary className="btn btn-sm list-none">
                          Cambiar contraseña
                        </summary>
                        <form
                          action={resetPassword}
                          className="absolute right-0 z-10 mt-2 flex w-72 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
                        >
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            name="password"
                            type="password"
                            required
                            minLength={8}
                            placeholder="Nueva contraseña"
                            aria-label="Nueva contraseña"
                            autoComplete="new-password"
                            className="input"
                          />
                          <SubmitButton className="btn btn-sm btn-primary">
                            OK
                          </SubmitButton>
                        </form>
                      </details>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
