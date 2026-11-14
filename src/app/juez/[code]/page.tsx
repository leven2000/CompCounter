import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { resolveCode } from "@/lib/access";
import { brandSelect, toBrand } from "@/lib/brand";
import { InvalidCode } from "@/components/InvalidCode";
import { JudgePad } from "@/components/live/JudgePad";

export default async function JudgePage({ params }: PageProps<"/juez/[code]">) {
  await connection();
  const { code } = await params;
  const access = await resolveCode(code);
  if (!access || access.role !== "JUDGE") return <InvalidCode />;

  const match = await db.match.findUnique({
    where: { id: access.matchId },
    select: {
      id: true,
      currentInArea: { select: { id: true } },
      category: { select: { tournament: { select: { org: { select: brandSelect } } } } },
    },
  });
  if (!match?.currentInArea) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold">Esa pelea ya no está en la mesa</h1>
          <p className="mt-2 text-sm text-slate-500">
            Cada código sirve para una sola pelea. Pedile a la mesa el de la próxima.
          </p>
          <Link href="/codigo" className="btn btn-primary mt-6">
            Ingresar otro código
          </Link>
        </div>
      </main>
    );
  }

  return (
    <JudgePad
      areaId={match.currentInArea.id}
      matchId={match.id}
      code={access.code}
      seat={access.seat}
      initialBrand={toBrand(match.category.tournament.org)}
    />
  );
}
