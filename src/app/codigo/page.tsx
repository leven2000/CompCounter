import Link from "next/link";
import { enterCode } from "@/app/actions";
import { APP_NAME } from "@/lib/brand";
import { Notice } from "@/components/bits";
import { SubmitButton } from "@/components/ui";

export default async function CodePage({ searchParams }: PageProps<"/codigo">) {
  const sp = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">
          {APP_NAME}
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Entrar con código</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          El organizador te pasa un código de 6 caracteres para tu puesto de juez o de mesa.
        </p>
        <Notice sp={sp} />
        <form action={enterCode} className="card space-y-4">
          <input
            name="code"
            required
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={8}
            placeholder="ABC123"
            aria-label="Código"
            className="input py-4 text-center font-mono text-3xl tracking-[0.3em] uppercase"
          />
          <SubmitButton className="btn btn-primary w-full py-3 text-base">Entrar</SubmitButton>
        </form>
      </div>
    </main>
  );
}
