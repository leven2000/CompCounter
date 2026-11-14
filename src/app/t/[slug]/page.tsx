import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { brandSelect, brandStyle, toBrand } from "@/lib/brand";
import { formatDate } from "@/lib/util";
import { BrandLogo } from "@/components/bits";
import { CategoryBracket } from "@/components/Bracket";
import { AutoRefresh } from "@/components/live/TvOverview";

const participantName = { select: { firstName: true, lastName: true } } as const;

export default async function PublicTournamentPage({ params }: PageProps<"/t/[slug]">) {
  await connection();
  const { slug } = await params;
  const t = await db.tournament.findUnique({
    where: { slug },
    include: {
      org: { select: brandSelect },
      areas: {
        orderBy: { order: "asc" },
        include: {
          currentMatch: {
            include: {
              category: { select: { name: true } },
              red: { include: { participant: participantName } },
              blue: { include: { participant: participantName } },
            },
          },
        },
      },
      categories: {
        orderBy: { order: "asc" },
        include: {
          entries: { include: { participant: true } },
          matches: { orderBy: [{ round: "asc" }, { position: "asc" }] },
        },
      },
    },
  });
  if (!t) notFound();
  const brand = toBrand(t.org);
  const name = (p?: { firstName: string; lastName: string } | null) =>
    p ? `${p.firstName} ${p.lastName}` : "Por definir";

  return (
    <div style={brandStyle(brand)} className="flex-1">
      <AutoRefresh seconds={15} />
      <header className="bg-accent text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-8">
          <BrandLogo brand={brand} className="h-14" />
          <div className="min-w-0 flex-1">
            <p className="text-sm opacity-70">{brand.name}</p>
            <h1 className="text-3xl font-bold">{t.name}</h1>
            <p className="mt-1 text-sm opacity-80">
              {formatDate(t.date)}
              {t.location ? ` · ${t.location}` : ""}
            </p>
          </div>
          <Link
            href={`/tv/torneo/${t.slug}`}
            className="btn border-white/30 bg-white/10 text-white hover:bg-white/20"
          >
            Ver todas las áreas en vivo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {t.areas.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">Áreas</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {t.areas.map((area) => {
                const m = area.currentMatch;
                return (
                  <li key={area.id}>
                    <Link href={`/tv/${area.id}`} className="card block transition hover:border-slate-400">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{area.name}</p>
                        {m && m.status === "LIVE" && (
                          <span className="badge bg-red-100 text-red-800">En vivo</span>
                        )}
                      </div>
                      {m ? (
                        <>
                          <p className="mt-2 text-sm font-medium">
                            {name(m.red?.participant)} <span className="text-slate-400">vs</span>{" "}
                            {name(m.blue?.participant)}
                          </p>
                          <p className="text-xs text-slate-500">{m.category.name}</p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">Sin pelea en curso</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Categorías y llaves</h2>
          {t.categories.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Todavía no se publicaron categorías.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {t.categories.map((c, index) => {
                const playable = c.matches.filter((m) => m.status !== "BYE");
                const played = playable.filter((m) => m.status === "DONE").length;
                return (
                  <details key={c.id} className="card" open={t.categories.length <= 2 || index === 0}>
                    <summary className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{c.name}</span>
                      <span className="badge">{c.entries.length} inscriptos</span>
                      {playable.length > 0 && (
                        <span
                          className={`badge ${
                            played === playable.length
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {played === playable.length ? "Terminada" : `${played} de ${playable.length} peleas`}
                        </span>
                      )}
                    </summary>
                    <div className="mt-4">
                      <CategoryBracket
                        format={c.bracketFormat}
                        entries={c.entries}
                        matches={c.matches}
                        options={t.org}
                      />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
