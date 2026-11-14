import Link from "next/link";

export function InvalidCode() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold">Ese código ya no sirve</h1>
        <p className="mt-2 text-sm text-slate-500">
          Puede que el organizador haya generado códigos nuevos. Pedile el actual.
        </p>
        <Link href="/codigo" className="btn btn-primary mt-6">
          Ingresar otro código
        </Link>
      </div>
    </main>
  );
}
