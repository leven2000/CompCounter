import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/auth";
import { ensureMatchJudges } from "@/lib/access";
import { mesaLink, qrSvg, tvLink, type AccessLink } from "@/lib/access-links";
import { COUNTRIES } from "@/lib/countries";
import { ensureQuickArea } from "@/lib/quick";
import { getRuleset } from "@/lib/rules";
import { baseUrl } from "@/lib/server-url";
import { AccessCard } from "@/components/AccessCard";
import { Notice } from "@/components/bits";
import { mmss, RuleFields } from "@/components/RuleFields";
import { SubmitButton } from "@/components/ui";
import { createQuickMatch, deleteQuickMatch, regenerateMesaCode, updateArea } from "../actions";

function CornerFields({ side, label, color }: { side: "red" | "blue"; label: string; color: string }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        {label}
      </legend>
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor={`${side}Name`}>
            Nombre
          </label>
          <input id={`${side}Name`} name={`${side}Name`} required className="input" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`${side}Team`}>
              Academia o equipo
            </label>
            <input id={`${side}Team`} name={`${side}Team`} className="input" />
          </div>
          <div>
            <label className="label" htmlFor={`${side}Country`}>
              País
            </label>
            <select id={`${side}Country`} name={`${side}Country`} defaultValue="AR" className="input">
              <option value="">Sin bandera</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export default async function QuickMatchPage({ searchParams }: PageProps<"/panel/combate">) {
  const { orgId } = await requireOrganizer();
  const sp = await searchParams;
  const { tournament, area, mesaCode } = await ensureQuickArea(orgId);

  const [org, matches, origin] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { corner1Name: true, corner1Color: true, corner2Name: true, corner2Color: true },
    }),
    db.match.findMany({
      where: { category: { tournamentId: tournament.id } },
      orderBy: { number: "desc" },
      include: {
        category: true,
        red: { include: { participant: true } },
        blue: { include: { participant: true } },
      },
    }),
    baseUrl(),
  ]);
  const mesa = mesaLink(origin, mesaCode);
  const links = [mesa, tvLink(origin, area.id, "combates sueltos")];

  const current = await db.area.findUnique({
    where: { id: area.id },
    select: {
      currentMatch: {
        select: { id: true, status: true, category: { select: { name: true, ruleset: true } } },
      },
    },
  });
  const live = current?.currentMatch?.status === "LIVE" ? current.currentMatch : null;
  const judgeLinks: AccessLink[] = [];
  if (live && getRuleset(live.category.ruleset).mode === "judges") {
    for (const row of await ensureMatchJudges(live.id, area.judges)) {
      const url = `${origin}/juez/${row.code}`;
      judgeLinks.push({
        id: row.id,
        title: `Juez ${row.seat}`,
        hint: "Vale solo para el combate que está en la mesa.",
        url,
        code: row.code,
        qr: await qrSvg(url),
      });
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Combate suelto</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Para una exhibición, una pelea estelar o un sparring con tablero: sin torneo ni llave. Elegís
            modalidad, rounds y duración, y lo manejás desde la mesa con reloj, jueces y TV.
          </p>
        </div>
        {mesa && (
          <a href={mesa.url} target="_blank" rel="noreferrer" className="btn btn-primary">
            Abrir la mesa ↗
          </a>
        )}
      </div>

      <div className="mt-6">
        <Notice sp={sp} />
      </div>

      <form action={createQuickMatch} className="card space-y-5">
        <h2 className="font-semibold">Nuevo combate</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <CornerFields side="red" label={org.corner1Name} color={org.corner1Color} />
          <CornerFields side="blue" label={org.corner2Name} color={org.corner2Color} />
        </div>
        <div>
          <label className="label" htmlFor="title">
            Título o categoría (opcional)
          </label>
          <input id="title" name="title" placeholder="Pelea estelar · K-1 · 70 kg" className="input" />
        </div>
        <RuleFields idPrefix="quick" variant="match" />
        <div className="w-44">
          <label className="label" htmlFor="judges">
            Jueces (solo kickboxing)
          </label>
          <input
            id="judges"
            name="judges"
            type="number"
            min={1}
            max={7}
            defaultValue={area.judges}
            className="input"
          />
        </div>
        <p className="text-xs text-slate-500">
          Dejá rounds, duración y descanso vacíos para usar los de la modalidad. La duración se escribe
          como min:seg, por ejemplo 2:00.
        </p>
        <SubmitButton>Crear combate</SubmitButton>
      </form>

      <section className="card mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Mesa y TV</h2>
            <p className="mt-1 text-sm text-slate-500">
              El link de mesa y el de TV son siempre los mismos. Los códigos de los jueces se generan para cada combate de kickboxing y aparecen en la pantalla de la mesa.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <form action={updateArea} className="flex items-end gap-2">
              <input type="hidden" name="areaId" value={area.id} />
              <input type="hidden" name="name" value={area.name} />
              <div>
                <label className="label" htmlFor="quick-judges">
                  Jueces por pelea
                </label>
                <input
                  id="quick-judges"
                  name="judges"
                  type="number"
                  min={1}
                  max={7}
                  defaultValue={area.judges}
                  className="input w-20"
                />
              </div>
              <SubmitButton className="btn">Guardar</SubmitButton>
            </form>
            <form action={regenerateMesaCode}>
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <SubmitButton
                className="btn"
                confirm="El código de mesa actual deja de funcionar. ¿Generar uno nuevo?"
              >
                Nuevo código de mesa
              </SubmitButton>
            </form>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <AccessCard key={link.id} link={link} />
          ))}
        </div>
        {judgeLinks.length > 0 ? (
          <>
            <h3 className="mt-5 text-sm font-semibold">
              Jueces del combate en la mesa: {live?.category.name}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {judgeLinks.map((link) => (
                <AccessCard key={link.id} link={link} />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Cuando haya un combate de kickboxing en la mesa, acá aparecen los códigos y QR de sus jueces.
          </p>
        )}
      </section>

      <h2 className="mt-8 mb-3 font-semibold">Combates ({matches.length})</h2>
      {matches.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no creaste ninguno.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
          {matches.map((m) => {
            const rules = getRuleset(m.category.ruleset);
            const red = m.red?.participant.firstName ?? "—";
            const blue = m.blue?.participant.firstName ?? "—";
            const winner = m.winnerEntryId === m.redEntryId ? red : blue;
            const running = m.status === "LIVE" && m.phase !== "IDLE";
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {red} <span className="text-slate-400">vs</span> {blue}
                  </p>
                  <p className="text-xs text-slate-500">
                    {m.category.name} · {rules.name} · {m.category.rounds} × {mmss(m.category.roundSeconds)}
                    {m.category.rounds > 1 ? ` · descanso ${mmss(m.category.restSeconds)}` : ""}
                  </p>
                </div>
                {m.status === "DONE" ? (
                  <span className="badge bg-emerald-100 text-emerald-800">
                    Ganó {winner} · {m.winMethod}
                  </span>
                ) : running ? (
                  <span className="badge bg-red-100 text-red-800">En curso</span>
                ) : m.status === "LIVE" ? (
                  <span className="badge bg-sky-100 text-sky-800">En la mesa</span>
                ) : (
                  <span className="badge bg-amber-100 text-amber-800">En espera</span>
                )}
                <form action={deleteQuickMatch}>
                  <input type="hidden" name="categoryId" value={m.categoryId} />
                  <SubmitButton className="btn btn-sm btn-danger" confirm="¿Eliminar este combate?">
                    Eliminar
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
