import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { DESKTOP } from "@/lib/desktop";
import { Notice } from "@/components/bits";
import { SubmitButton } from "@/components/ui";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const user = await currentUser();
  if (user) redirect(user.role === "SUPERADMIN" ? "/admin" : "/panel");
  if (DESKTOP) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="max-w-sm text-center text-slate-600">
          La sesión local no está activa. Cerrá {APP_NAME} y volvé a abrirlo.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">
          {APP_NAME}
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Ingresar</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Las cuentas las crea el administrador de la plataforma.
        </p>
        <Notice sp={sp} />
        <form action={login} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
            />
          </div>
          <SubmitButton className="btn btn-primary w-full">Ingresar</SubmitButton>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Sos juez o estás en la mesa?{" "}
          <Link href="/codigo" className="font-medium text-brand underline">
            Entrá con tu código
          </Link>
        </p>
      </div>
    </main>
  );
}
