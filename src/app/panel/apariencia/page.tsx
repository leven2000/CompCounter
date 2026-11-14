import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { brandSelect, toBrand } from "@/lib/brand";
import { Notice } from "@/components/bits";
import { BrandingForm } from "@/components/BrandingForm";

export default async function BrandingPage({ searchParams }: PageProps<"/panel/apariencia">) {
  const { orgId } = await requireOrganizer();
  const sp = await searchParams;
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: brandSelect });
  const brand = toBrand(org);

  return (
    <>
      <h1 className="text-xl font-bold">Apariencia</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Se aplica a tu panel, a la página pública de tus torneos, a las pantallas de TV y a lo que ven
        jueces y mesa.
      </p>
      <Notice sp={sp} />
      <BrandingForm key={org.updatedAt.getTime()} brand={brand} />
    </>
  );
}
