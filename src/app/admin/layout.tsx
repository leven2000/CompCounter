import { logout } from "@/app/actions";
import { APP_NAME } from "@/lib/brand";
import { NavLink } from "@/components/nav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">{APP_NAME}</p>
              <p className="text-sm font-semibold">Administración</p>
            </div>
            <nav className="flex flex-wrap items-center gap-1">
              <NavLink href="/admin" exact>
                Organizadores
              </NavLink>
              <NavLink href="/admin/historial">Historial</NavLink>
            </nav>
          </div>
          <form action={logout}>
            <button className="btn btn-sm">Salir</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
