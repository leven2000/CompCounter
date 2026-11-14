import { requireOrganizer } from "@/lib/auth";
import { Notice } from "@/components/bits";
import { SubmitButton } from "@/components/ui";
import { changePassword } from "../actions";

export default async function AccountPage({ searchParams }: PageProps<"/panel/cuenta">) {
  const { user } = await requireOrganizer();
  const sp = await searchParams;
  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold">Cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {user.name} · {user.email}
      </p>
      <Notice sp={sp} />
      <form action={changePassword} className="card space-y-4">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <div>
          <label className="label" htmlFor="current">
            Contraseña actual
          </label>
          <input
            id="current"
            name="current"
            type="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="next">
            Nueva contraseña
          </label>
          <input
            id="next"
            name="next"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
        </div>
        <SubmitButton>Guardar</SubmitButton>
      </form>
    </div>
  );
}
