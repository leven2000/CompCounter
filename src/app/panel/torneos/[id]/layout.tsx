import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { formatDate } from "@/lib/util";
import { NavLink } from "@/components/nav";

async function TournamentHeader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scope } = await requireOrganizer();
  const t = await db.tournament.findFirst({
    where: { id, AND: [scope] },
    select: { id: true, name: true, slug: true, date: true, location: true },
  });
  if (!t) notFound();
  const base = `/panel/torneos/${t.id}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/panel" className="text-sm text-slate-500 hover:text-slate-800">
            ← Torneos
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{t.name}</h1>
          <p className="text-sm text-slate-500">
            {formatDate(t.date)}
            {t.location ? ` · ${t.location}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/t/${t.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm">
            Página pública ↗
          </a>
          <a href={`/tv/torneo/${t.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm">
            TV general ↗
          </a>
        </div>
      </div>
      <nav className="mt-6 mb-6 flex gap-6 overflow-x-auto border-b border-slate-200">
        <NavLink href={base} exact variant="tab">
          Resumen
        </NavLink>
        <NavLink href={`${base}/categorias`} variant="tab">
          Categorías
        </NavLink>
        <NavLink href={`${base}/participantes`} variant="tab">
          Participantes
        </NavLink>
        <NavLink href={`${base}/llaves`} variant="tab">
          Llaves
        </NavLink>
        <NavLink href={`${base}/horarios`} variant="tab">
          Horarios
        </NavLink>
        <NavLink href={`${base}/areas`} variant="tab">
          Áreas, mesa y TV
        </NavLink>
      </nav>
    </>
  );
}

export default function TournamentLayout({
  children,
  params,
}: LayoutProps<"/panel/torneos/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="h-[150px]" />}>
        <TournamentHeader params={params} />
      </Suspense>
      {children}
    </>
  );
}
