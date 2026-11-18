import { brandStyle } from "@/lib/brand";
import { DESKTOP } from "@/lib/desktop";
import { loadMesa } from "@/lib/mesa";
import { BrandLogo } from "@/components/bits";
import { InvalidCode } from "@/components/InvalidCode";
import { MesaNav } from "@/components/MesaNav";

export default async function MesaLayout({ children, params }: LayoutProps<"/mesa/[code]">) {
  const { code } = await params;
  const mesa = await loadMesa(code);
  if (!mesa) return <InvalidCode />;

  return (
    <div style={brandStyle(mesa.brand)} className="flex min-h-dvh flex-col bg-slate-100">
      <header className="bg-accent text-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <div className="flex items-center gap-3">
            <BrandLogo brand={mesa.brand} className="h-8" />
            <div>
              <p className="text-sm leading-tight font-bold">Mesa · {mesa.tournament.name}</p>
              <p className="text-xs opacity-70">{mesa.brand.name}</p>
            </div>
          </div>
          <MesaNav code={mesa.code} desktop={DESKTOP} />
        </div>
      </header>
      {children}
    </div>
  );
}
