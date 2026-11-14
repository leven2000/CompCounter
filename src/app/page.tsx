import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { APP_NAME } from "@/lib/brand";
import { formatDate } from "@/lib/util";

export default async function Home() {
  await connection();
  const tournaments = await db.tournament.findMany({
    where: { published: true, quick: false },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: {
      name: true,
      slug: true,
      date: true,
      location: true,
      org: { select: { name: true } },
    },
  });

  return (
    <main className="flex-1">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-sm font-semibold tracking-[0.2em] text-red-400 uppercase">{APP_NAME}</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            Llaves, puntaje en vivo y pantallas para torneos de deportes de contacto
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            Jiu-jitsu, grappling y kickboxing. Los jueces puntúan desde el celular con un código, la
            mesa controla el reloj y el público lo ve en los televisores.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-primary px-5 py-2.5 text-base">
              Ingresar como organizador
            </Link>
            <Link
              href="/codigo"
              className="btn border-slate-700 bg-slate-900 px-5 py-2.5 text-base text-white hover:bg-slate-800"
            >
              Tengo un código de juez o mesa
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-lg font-semibold">Torneos</h2>
        {tournaments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Todavía no hay torneos publicados.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <li key={t.slug}>
                <Link href={`/t/${t.slug}`} className="card block transition hover:border-slate-400">
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(t.date)}
                    {t.location ? ` · ${t.location}` : ""}
                  </p>
                  <p className="mt-3 text-xs text-slate-400">{t.org.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
