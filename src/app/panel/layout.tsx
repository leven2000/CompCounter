import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions";
import { leaveOrganization } from "@/app/admin/actions";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { brandSelect, toBrand } from "@/lib/brand";
import { BrandLogo } from "@/components/bits";
import { NavLink } from "@/components/nav";

async function PanelHeader() {
  const { user, orgId, acting } = await requireOrganizer();
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: brandSelect });
  const brand = toBrand(org);

  return (
    <>
      <style>{`:root{--brand:${brand.primary};--accent:${brand.accent};--c1:${brand.c1Color};--c2:${brand.c2Color}}`}</style>
      {acting && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-300 px-6 py-1.5 text-sm font-medium text-black print:hidden">
          <span>Estás dentro del panel de {brand.name} como administrador maestro.</span>
          <form action={leaveOrganization}>
            <button className="underline">Volver a administración</button>
          </form>
        </div>
      )}
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/panel" className="flex shrink-0 items-center gap-3">
              <BrandLogo brand={brand} className="h-9" />
              <span className="font-semibold whitespace-nowrap">{brand.name}</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-1">
              <NavLink href="/panel" exact>
                Torneos
              </NavLink>
              <NavLink href="/panel/combate">Combate suelto</NavLink>
              <NavLink href="/panel/historial">Historial</NavLink>
              <NavLink href="/panel/apariencia">Apariencia</NavLink>
              <NavLink href="/panel/cuenta">Cuenta</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{user.name}</span>
            <form action={logout}>
              <button className="btn btn-sm">Salir</button>
            </form>
          </div>
        </div>
      </header>
    </>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<header className="h-[61px] border-b border-slate-200 bg-white" />}>
        <PanelHeader />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
