"use server";

import type { Prisma } from "@prisma/client";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, requireOrganizer, verifyPassword } from "@/lib/auth";
import { resetMesaCode } from "@/lib/access";
import { clearBracket, generateBracket } from "@/lib/bracket";
import { checkLeaves, FORMATS, mergedName, mergeProblem } from "@/lib/bracket-core";
import { findCountry } from "@/lib/countries";
import { publish, tableAction } from "@/lib/live";
import { createDemo } from "@/lib/demo";
import { buildPlan, personKey, sanitizeRows, type ImportState } from "@/lib/import";
import { loadExisting } from "@/lib/import-data";
import { ensureQuickArea } from "@/lib/quick";
import { getRuleset, readSanctions, RULESETS } from "@/lib/rules";
import { int, isHexColor, newCode, num, optStr, slugify, str } from "@/lib/util";

const go = (path: string, kind: "ok" | "error", message: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

async function ownTournament(id: string) {
  const { scope } = await requireOrganizer();
  const row = await db.tournament.findFirst({ where: { id, AND: [scope] } });
  if (!row) redirect("/panel");
  return row;
}

async function ownCategory(id: string) {
  const { scope } = await requireOrganizer();
  const row = await db.category.findFirst({ where: { id, tournament: scope } });
  if (!row) redirect("/panel");
  return row;
}

async function ownArea(id: string) {
  const { scope } = await requireOrganizer();
  const row = await db.area.findFirst({ where: { id, tournament: scope } });
  if (!row) redirect("/panel");
  return row;
}

async function ownParticipant(id: string) {
  const { scope } = await requireOrganizer();
  const row = await db.participant.findFirst({ where: { id, tournament: scope } });
  if (!row) redirect("/panel");
  return row;
}

async function ownedTournament(id: string) {
  const { orgId } = await requireOrganizer();
  const row = await db.tournament.findFirst({ where: { id, orgId } });
  if (!row) redirect("/panel");
  return row;
}

function parseDate(raw: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : null;
}

function parseDuration(raw: string, fallback: number) {
  const v = raw.trim();
  if (!v) return fallback;
  const parts = v.match(/^(\d{1,2}):(\d{1,2})$/);
  if (parts) return Number(parts[1]) * 60 + Number(parts[2]);
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 60) : fallback;
}

function splitList(raw: string) {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createTournament(formData: FormData) {
  const { orgId } = await requireOrganizer();
  const name = str(formData, "name");
  if (!name) go("/panel", "error", "Ponele un nombre al torneo");
  let slug = slugify(name);
  if (await db.tournament.findUnique({ where: { slug } })) {
    slug = `${slug}-${newCode(4).toLowerCase()}`;
  }
  const tournament = await db.tournament.create({
    data: {
      orgId,
      name,
      slug,
      date: parseDate(str(formData, "date")),
      location: optStr(formData, "location"),
      areas: { create: { name: "Área 1", order: 1, judges: 3 } },
    },
    include: { areas: true },
  });
  await resetMesaCode(tournament.id);
  redirect(`/panel/torneos/${tournament.id}`);
}

export async function updateTournament(formData: FormData) {
  const t = await ownTournament(str(formData, "tournamentId"));
  await db.tournament.update({
    where: { id: t.id },
    data: {
      name: str(formData, "name") || t.name,
      date: parseDate(str(formData, "date")),
      location: optStr(formData, "location"),
      published: formData.get("published") === "on",
    },
  });
  go(`/panel/torneos/${t.id}`, "ok", "Torneo guardado");
}

export async function deleteTournament(formData: FormData) {
  const t = await ownedTournament(str(formData, "tournamentId"));
  await db.tournament.delete({ where: { id: t.id } });
  go("/panel", "ok", `Torneo "${t.name}" eliminado`);
}

export async function createArea(formData: FormData) {
  const t = await ownTournament(str(formData, "tournamentId"));
  const count = await db.area.count({ where: { tournamentId: t.id } });
  const judges = clamp(int(formData, "judges", 3), 1, 7);
  await db.area.create({
    data: {
      tournamentId: t.id,
      name: str(formData, "name") || `Área ${count + 1}`,
      order: count + 1,
      judges,
    },
  });
  refresh();
}

export async function updateArea(formData: FormData) {
  const area = await ownArea(str(formData, "areaId"));
  const judges = clamp(int(formData, "judges", area.judges), 1, 7);
  await db.area.update({
    where: { id: area.id },
    data: { name: str(formData, "name") || area.name, judges },
  });
  refresh();
}

export async function deleteArea(formData: FormData) {
  const area = await ownArea(str(formData, "areaId"));
  await db.area.delete({ where: { id: area.id } });
  refresh();
}

export async function regenerateMesaCode(formData: FormData) {
  const t = await ownTournament(str(formData, "tournamentId"));
  await resetMesaCode(t.id);
  refresh();
}

async function categoryData(formData: FormData, tournamentId: string) {
  const rules = getRuleset(str(formData, "ruleset"));
  const areaId = str(formData, "areaId");
  const area = areaId ? await db.area.findFirst({ where: { id: areaId, tournamentId } }) : null;
  return {
    ruleset: rules.id,
    gender: optStr(formData, "gender"),
    ageGroup: optStr(formData, "ageGroup"),
    level: optStr(formData, "level"),
    weightMin: num(formData, "weightMin"),
    weightMax: num(formData, "weightMax"),
    rounds: clamp(int(formData, "rounds", rules.rounds), 1, 12),
    roundSeconds: clamp(parseDuration(str(formData, "roundTime"), rules.roundSeconds), 10, 3600),
    restSeconds: clamp(parseDuration(str(formData, "restTime"), rules.restSeconds), 0, 900),
    autoLadder: formData.get("autoLadder") === "on",
    ...readSanctions({
      dqAt: str(formData, "dqAt"),
      minusMode: str(formData, "minusMode"),
      minusValue: str(formData, "minusValue"),
    }),
    areaId: area?.id ?? null,
  };
}

export async function createCategory(formData: FormData) {
  const t = await ownTournament(str(formData, "tournamentId"));
  const path = `/panel/torneos/${t.id}/categorias`;
  const name = str(formData, "name");
  if (!name) go(path, "error", "Ponele un nombre a la categoría");
  const last = await db.category.aggregate({ where: { tournamentId: t.id }, _max: { order: true } });
  await db.category.create({
    data: {
      tournamentId: t.id,
      name,
      order: (last._max.order ?? 0) + 1,
      ...(await categoryData(formData, t.id)),
    },
  });
  go(path, "ok", `Categoría "${name}" creada`);
}

export async function updateCategory(formData: FormData) {
  const c = await ownCategory(str(formData, "categoryId"));
  await db.category.update({
    where: { id: c.id },
    data: { name: str(formData, "name") || c.name, ...(await categoryData(formData, c.tournamentId)) },
  });
  go(`/panel/torneos/${c.tournamentId}/categorias`, "ok", "Categoría guardada");
}

export async function deleteCategory(formData: FormData) {
  const c = await ownCategory(str(formData, "categoryId"));
  await db.category.delete({ where: { id: c.id } });
  refresh();
}

export async function assignArea(formData: FormData) {
  const c = await ownCategory(str(formData, "categoryId"));
  const areaId = str(formData, "areaId");
  const area = areaId
    ? await db.area.findFirst({ where: { id: areaId, tournamentId: c.tournamentId } })
    : null;
  await db.category.update({ where: { id: c.id }, data: { areaId: area?.id ?? null } });
  refresh();
}

export async function generateCategories(formData: FormData) {
  const t = await ownTournament(str(formData, "tournamentId"));
  const path = `/panel/torneos/${t.id}/categorias`;
  const base = await categoryData(formData, t.id);
  const prefix = str(formData, "prefix");
  const genders = formData.getAll("genders").map(String).filter(Boolean);
  const ages = splitList(str(formData, "ages"));
  const levels = splitList(str(formData, "levels"));

  const tokens = str(formData, "weights")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toNumber = (token: string) => Number(token.replace(/[^0-9.]/g, ""));
  const limits = [...new Set(tokens.filter((x) => !x.includes("+")).map(toNumber))]
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const opens = tokens
    .filter((x) => x.includes("+"))
    .map(toNumber)
    .filter((n) => Number.isFinite(n) && n > 0);

  const ranges: { min: number | null; max: number | null; label: string }[] = limits.map((max, i) => ({
    min: i === 0 ? null : limits[i - 1],
    max,
    label: `-${max} kg`,
  }));
  for (const min of opens) ranges.push({ min, max: null, label: `+${min} kg` });
  if (ranges.length === 0) ranges.push({ min: null, max: null, label: "" });

  const last = await db.category.aggregate({ where: { tournamentId: t.id }, _max: { order: true } });
  let order = last._max.order ?? 0;
  const rows: Prisma.CategoryCreateManyInput[] = [];
  for (const gender of genders.length ? genders : [null]) {
    for (const age of ages.length ? ages : [null]) {
      for (const level of levels.length ? levels : [null]) {
        for (const range of ranges) {
          const name = [prefix, gender, age, level, range.label].filter(Boolean).join(" · ");
          if (!name) continue;
          rows.push({
            ...base,
            tournamentId: t.id,
            name,
            gender,
            ageGroup: age,
            level,
            weightMin: range.min,
            weightMax: range.max,
            order: ++order,
          });
        }
      }
    }
  }
  if (rows.length === 0) go(path, "error", "Completá al menos un dato para armar categorías");
  if (rows.length > 400) go(path, "error", `Son ${rows.length} categorías; achicá la combinación (máximo 400)`);
  await db.category.createMany({ data: rows });
  go(path, "ok", `${rows.length} categorías creadas`);
}

function participantData(formData: FormData) {
  const year = num(formData, "birthYear");
  return {
    firstName: str(formData, "firstName"),
    lastName: str(formData, "lastName"),
    team: optStr(formData, "team"),
    country: findCountry(str(formData, "country")),
    gender: optStr(formData, "gender"),
    birthYear: year && year > 1900 && year < 2100 ? Math.round(year) : null,
    level: optStr(formData, "level"),
    weight: num(formData, "weight"),
  };
}

async function validCategoryIds(formData: FormData, tournamentId: string) {
  const ids = formData.getAll("categoryIds").map(String).filter(Boolean);
  if (ids.length === 0) return [];
  const rows = await db.category.findMany({
    where: { id: { in: ids }, tournamentId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function createParticipant(formData: FormData) {
  const t = await ownTournament(str(formData, "tournamentId"));
  const path = `/panel/torneos/${t.id}/participantes`;
  const data = participantData(formData);
  if (!data.firstName || !data.lastName) go(path, "error", "Nombre y apellido son obligatorios");
  const categoryIds = await validCategoryIds(formData, t.id);
  await db.participant.create({
    data: {
      ...data,
      tournamentId: t.id,
      entries: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });
  go(path, "ok", `${data.firstName} ${data.lastName} agregado`);
}

export async function updateParticipant(formData: FormData) {
  const p = await ownParticipant(str(formData, "participantId"));
  const path = `/panel/torneos/${p.tournamentId}/participantes`;
  const data = participantData(formData);
  if (!data.firstName || !data.lastName) {
    go(`${path}/${p.id}`, "error", "Nombre y apellido son obligatorios");
  }
  const wanted = await validCategoryIds(formData, p.tournamentId);
  const current = await db.entry.findMany({
    where: { participantId: p.id },
    include: { category: { select: { name: true } } },
  });
  const removing = current.filter((e) => !wanted.includes(e.categoryId));
  for (const entry of removing) {
    const used = await db.match.count({
      where: { OR: [{ redEntryId: entry.id }, { blueEntryId: entry.id }] },
    });
    if (used > 0) {
      go(`${path}/${p.id}`, "error", `Está en la llave de "${entry.category.name}". Borrá esa llave antes de quitarlo.`);
    }
  }
  const adding = wanted.filter((id) => !current.some((e) => e.categoryId === id));
  await db.$transaction([
    db.participant.update({ where: { id: p.id }, data }),
    db.entry.deleteMany({ where: { id: { in: removing.map((e) => e.id) } } }),
    db.entry.createMany({ data: adding.map((categoryId) => ({ categoryId, participantId: p.id })) }),
  ]);
  for (const entry of current) {
    const seed = num(formData, `seed-${entry.id}`);
    await db.entry.updateMany({
      where: { id: entry.id },
      data: { seed: seed && seed > 0 ? Math.round(seed) : null },
    });
  }
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(photo.type)) {
      go(`${path}/${p.id}`, "error", "La foto tiene que ser PNG, JPG o WebP");
    }
    if (photo.size > 1_000_000) go(`${path}/${p.id}`, "error", "La foto no puede pesar más de 1 MB");
    const bytes = new Uint8Array(await photo.arrayBuffer());
    await db.$transaction([
      db.participantPhoto.upsert({
        where: { participantId: p.id },
        create: { participantId: p.id, data: bytes, type: photo.type },
        update: { data: bytes, type: photo.type },
      }),
      db.participant.update({ where: { id: p.id }, data: { photoVersion: { increment: 1 } } }),
    ]);
  } else if (formData.get("removePhoto") === "on") {
    await db.$transaction([
      db.participantPhoto.deleteMany({ where: { participantId: p.id } }),
      db.participant.update({ where: { id: p.id }, data: { photoVersion: 0 } }),
    ]);
  }
  go(path, "ok", "Participante guardado");
}

export async function deleteParticipant(formData: FormData) {
  const p = await ownParticipant(str(formData, "participantId"));
  const path = `/panel/torneos/${p.tournamentId}/participantes`;
  const used = await db.match.count({
    where: { OR: [{ red: { participantId: p.id } }, { blue: { participantId: p.id } }] },
  });
  if (used > 0) go(path, "error", "Está en una llave generada. Borrá la llave antes de eliminarlo.");
  await db.participant.delete({ where: { id: p.id } });
  refresh();
}

export async function saveWeighIn(formData: FormData) {
  const p = await ownParticipant(str(formData, "participantId"));
  await db.participant.update({
    where: { id: p.id },
    data: { weighIn: num(formData, "weighIn"), checkedIn: formData.get("checkedIn") === "on" },
  });
  refresh();
}

export async function importParticipants(formData: FormData) {
  const t = await ownTournament(str(formData, "tournamentId"));
  const path = `/panel/torneos/${t.id}/participantes`;
  const lines = String(formData.get("rows") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const categories = await db.category.findMany({
    where: { tournamentId: t.id },
    select: { id: true, name: true },
  });
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  let created = 0;
  let skipped = 0;
  for (const line of lines) {
    const separator = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cols = line.split(separator).map((c) => c.trim());
    const [firstName, lastName, team, country, gender, year, level, weight, category] = cols;
    if (!firstName || !lastName || firstName.toLowerCase() === "nombre") {
      skipped += 1;
      continue;
    }
    const birthYear = Number(year);
    const kg = Number((weight ?? "").replace(",", "."));
    const categoryId = category ? byName.get(category.toLowerCase()) : undefined;
    await db.participant.create({
      data: {
        tournamentId: t.id,
        firstName,
        lastName,
        team: team || null,
        country: findCountry(country ?? ""),
        gender: gender || null,
        birthYear: Number.isInteger(birthYear) && birthYear > 1900 ? birthYear : null,
        level: level || null,
        weight: Number.isFinite(kg) && kg > 0 ? kg : null,
        entries: categoryId ? { create: { categoryId } } : undefined,
      },
    });
    created += 1;
  }
  go(path, created ? "ok" : "error", `${created} participantes importados${skipped ? `, ${skipped} líneas salteadas` : ""}`);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function importSheet(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const t = await ownTournament(str(formData, "tournamentId"));
  let payload: { rows?: unknown; choices?: unknown; areaId?: unknown; country?: unknown };
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "")) ?? {};
  } catch {
    payload = {};
  }
  const rows = sanitizeRows(payload.rows);
  if (!rows) return { error: "No llegó la planilla. Volvé a elegir el archivo." };

  const choices: Record<string, string> = {};
  if (payload.choices && typeof payload.choices === "object") {
    for (const [key, value] of Object.entries(payload.choices)) {
      if (RULESETS.some((r) => r.id === value)) choices[key] = String(value);
    }
  }

  const plan = buildPlan(rows, choices, await loadExisting(t.id));
  if (plan.blockers.length > 0) return { error: plan.blockers[0] };

  const area =
    typeof payload.areaId === "string" && payload.areaId
      ? await db.area.findFirst({ where: { id: payload.areaId, tournamentId: t.id }, select: { id: true } })
      : null;
  const fallbackCountry = typeof payload.country === "string" ? findCountry(payload.country) : null;
  const newCategories = plan.categories.filter((c) => !c.existingId);
  const newPeople = plan.people.filter((p) => !p.existingId);
  let entries = 0;

  try {
    await db.$transaction(
      async (tx) => {
        const last = await tx.category.aggregate({ where: { tournamentId: t.id }, _max: { order: true } });
        let order = last._max.order ?? 0;
        const categoryIds = new Map<string, string>();
        for (const c of plan.categories) if (c.existingId) categoryIds.set(c.key, c.existingId);
        for (const group of chunk(newCategories, 200)) {
          const created = await tx.category.createManyAndReturn({
            data: group.map((c) => {
              const rules = getRuleset(c.ruleset);
              return {
                tournamentId: t.id,
                name: c.name,
                ruleset: rules.id,
                gender: c.gender,
                weightMin: c.weightMin,
                weightMax: c.weightMax,
                rounds: rules.rounds,
                roundSeconds: rules.roundSeconds,
                restSeconds: rules.restSeconds,
                areaId: area?.id ?? null,
                order: ++order,
              };
            }),
            select: { id: true, name: true },
          });
          const byName = new Map(created.map((row) => [row.name, row.id]));
          for (const c of group) {
            const id = byName.get(c.name);
            if (id) categoryIds.set(c.key, id);
          }
        }

        const personIds = new Map<string, string>();
        for (const p of plan.people) if (p.existingId) personIds.set(p.key, p.existingId);
        for (const group of chunk(newPeople, 200)) {
          const created = await tx.participant.createManyAndReturn({
            data: group.map((p) => ({
              tournamentId: t.id,
              firstName: p.firstName,
              lastName: p.lastName,
              team: p.team,
              country: findCountry(p.country) ?? fallbackCountry,
              gender: p.gender,
              birthYear: p.birthYear,
              level: p.level,
              weight: p.weight,
            })),
            select: { id: true, firstName: true, lastName: true, team: true },
          });
          for (const row of created) personIds.set(personKey(row.firstName, row.lastName, row.team ?? ""), row.id);
        }

        const pairs = plan.people.flatMap((p) =>
          p.categoryKeys.flatMap((key) => {
            const participantId = personIds.get(p.key);
            const categoryId = categoryIds.get(key);
            return participantId && categoryId ? [{ participantId, categoryId }] : [];
          }),
        );
        for (const group of chunk(pairs, 1000)) {
          const result = await tx.entry.createMany({ data: group, skipDuplicates: true });
          entries += result.count;
        }
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  } catch (error) {
    console.error("importSheet", error);
    return { error: "No se pudo guardar la planilla. No se cargó nada: probá de nuevo." };
  }

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const known = plan.stats.knownPeople;
  return go(
    `/panel/torneos/${t.id}/participantes`,
    "ok",
    `Planilla cargada: ${count(newPeople.length, "competidor nuevo", "competidores nuevos")}, ${count(
      newCategories.length,
      "categoría nueva",
      "categorías nuevas",
    )} y ${count(entries, "inscripción", "inscripciones")}.${
      known ? ` ${count(known, "competidor ya estaba cargado", "competidores ya estaban cargados")}.` : ""
    }`,
  );
}

const pickedFormat = (formData: FormData) => {
  const format = str(formData, "format");
  return FORMATS.includes(format) ? format : "AUTO";
};

async function bracketSettings(formData: FormData) {
  const t = await ownTournament(str(formData, "tournamentId"));
  await db.tournament.update({
    where: { id: t.id },
    data: {
      bracketFormat: pickedFormat(formData),
      roundRobinMax: clamp(int(formData, "roundRobinMax", 3), 2, 8),
      thirdPlaceMatch: formData.get("thirdPlaceMatch") === "on",
    },
  });
  return t;
}

export async function saveBracketSettings(formData: FormData) {
  const t = await bracketSettings(formData);
  go(`/panel/torneos/${t.id}/llaves`, "ok", "Formato guardado. Vale para las llaves que generes desde ahora.");
}

export async function generateOne(formData: FormData) {
  const c = await ownCategory(str(formData, "categoryId"));
  const path = `/panel/torneos/${c.tournamentId}/llaves?c=${c.id}`;
  await db.category.update({
    where: { id: c.id },
    data: { format: pickedFormat(formData), thirdPlaceMatch: formData.get("thirdPlaceMatch") === "on" },
  });
  const result = await generateBracket(c.id);
  if (!result.ok) go(path, "error", result.error);
  go(path, "ok", result.ok && result.matches ? `Llave generada: ${result.matches} peleas` : "Sin peleas: hace falta más de un inscripto");
}

export async function clearOne(formData: FormData) {
  const c = await ownCategory(str(formData, "categoryId"));
  const path = `/panel/torneos/${c.tournamentId}/llaves?c=${c.id}`;
  const result = await clearBracket(c.id);
  if (!result.ok) go(path, "error", result.error);
  go(path, "ok", "Llave borrada");
}

export async function buildBracket(formData: FormData) {
  const c = await ownCategory(str(formData, "categoryId"));
  const path = `/panel/torneos/${c.tournamentId}/llaves?c=${c.id}`;
  const size = int(formData, "size", 0);
  const leaves = Array.from({ length: clamp(size, 0, 128) }, (_, i) => str(formData, `leaf-${i}`) || null);
  const entries = await db.entry.findMany({ where: { categoryId: c.id }, select: { id: true } });
  const problem = checkLeaves(leaves, entries.map((e) => e.id));
  if (problem) go(path, "error", problem);
  const result = await generateBracket(c.id, leaves);
  if (!result.ok) go(path, "error", result.error);
  if (c.areaId) void publish(c.areaId);
  const left = entries.length - leaves.filter(Boolean).length;
  go(
    path,
    "ok",
    `Llave armada a mano: ${result.ok ? result.matches : 0} peleas${left > 0 ? `. Quedaron ${left} inscriptos afuera` : ""}`,
  );
}

export async function mergeCategories(formData: FormData) {
  const target = await ownCategory(str(formData, "targetId"));
  const path = `/panel/torneos/${target.tournamentId}/llaves`;
  const sourceId = str(formData, "sourceId");
  if (!sourceId) go(path, "error", "Elegí las dos categorías a fusionar");
  const source = await ownCategory(sourceId);
  const problem = mergeProblem(target, source);
  if (problem) go(path, "error", problem);
  const played = await db.match.count({
    where: { categoryId: { in: [target.id, source.id] }, status: { in: ["LIVE", "DONE"] } },
  });
  if (played > 0) go(path, "error", "Alguna de las dos ya tiene peleas jugadas: no se pueden fusionar");

  const already = new Set(
    (await db.entry.findMany({ where: { categoryId: target.id }, select: { participantId: true } })).map(
      (e) => e.participantId,
    ),
  );
  const moving = (await db.entry.findMany({ where: { categoryId: source.id } })).filter(
    (e) => !already.has(e.participantId),
  );
  const name = str(formData, "name").slice(0, 120) || mergedName(target.name, source.name);
  const widest = (a: number | null, b: number | null, pick: (...n: number[]) => number) =>
    a == null || b == null ? null : pick(a, b);
  await db.$transaction([
    db.match.deleteMany({ where: { categoryId: { in: [target.id, source.id] } } }),
    db.entry.updateMany({ where: { id: { in: moving.map((e) => e.id) } }, data: { categoryId: target.id, seed: null } }),
    db.category.update({
      where: { id: target.id },
      data: {
        name,
        bracketFormat: null,
        gender: target.gender === source.gender ? target.gender : null,
        ageGroup: target.ageGroup === source.ageGroup ? target.ageGroup : null,
        level: target.level === source.level ? target.level : null,
        weightMin: widest(target.weightMin, source.weightMin, Math.min),
        weightMax: widest(target.weightMax, source.weightMax, Math.max),
      },
    }),
    db.category.delete({ where: { id: source.id } }),
  ]);
  for (const areaId of new Set([target.areaId, source.areaId])) if (areaId) void publish(areaId);
  go(`${path}?c=${target.id}`, "ok", `Categorías fusionadas en "${name}": ${already.size + moving.length} inscriptos. Ahora generá la llave.`);
}

export async function generateAll(formData: FormData) {
  const t = await bracketSettings(formData);
  const categories = await db.category.findMany({
    where: { tournamentId: t.id },
    select: { id: true, _count: { select: { entries: true, matches: true } } },
  });
  let count = 0;
  for (const c of categories) {
    if (c._count.matches > 0 || c._count.entries < 2) continue;
    const result = await generateBracket(c.id);
    if (result.ok) count += 1;
  }
  go(`/panel/torneos/${t.id}/llaves`, "ok", `${count} llaves generadas`);
}

export async function swapEntries(formData: FormData) {
  const c = await ownCategory(str(formData, "categoryId"));
  const path = `/panel/torneos/${c.tournamentId}/llaves?c=${c.id}`;
  const a = str(formData, "entryA");
  const b = str(formData, "entryB");
  if (!a || !b || a === b) go(path, "error", "Elegí dos competidores distintos");
  const valid = await db.entry.count({ where: { id: { in: [a, b] }, categoryId: c.id } });
  if (valid !== 2) go(path, "error", "Esos competidores no son de esta categoría");

  const matches = await db.match.findMany({ where: { categoryId: c.id } });
  const involved = matches.filter((m) =>
    [m.redEntryId, m.blueEntryId].some((id) => id === a || id === b),
  );
  if (involved.length === 0) go(path, "error", "Ninguno de los dos está en la llave");
  if (involved.some((m) => m.status === "LIVE" || m.status === "DONE")) {
    go(path, "error", "Alguno de los dos ya peleó o está peleando: no se pueden intercambiar");
  }
  const swap = (id: string | null) => (id === a ? b : id === b ? a : id);
  await db.$transaction(
    involved.map((m) =>
      db.match.update({
        where: { id: m.id },
        data: {
          redEntryId: swap(m.redEntryId),
          blueEntryId: swap(m.blueEntryId),
          winnerEntryId: swap(m.winnerEntryId),
        },
      }),
    ),
  );
  if (c.areaId) void publish(c.areaId);
  go(path, "ok", "Competidores intercambiados en la llave");
}

function parseWallTime(raw: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? new Date(`${raw}:00.000Z`) : null;
}

export async function scheduleArea(formData: FormData) {
  const area = await ownArea(str(formData, "areaId"));
  const path = `/panel/torneos/${area.tournamentId}/horarios`;
  const start = parseWallTime(str(formData, "start"));
  if (!start) go(path, "error", "Elegí día y hora de inicio");
  const gap = clamp(int(formData, "gap", 2), 0, 60);
  const matches = await db.match.findMany({
    where: { category: { areaId: area.id }, status: { in: ["READY", "PENDING", "LIVE"] } },
    include: { category: { select: { rounds: true, roundSeconds: true, restSeconds: true } } },
    orderBy: [{ depth: "desc" }, { category: { order: "asc" } }, { round: "asc" }, { position: "asc" }],
  });
  let cursor = start ? start.getTime() : 0;
  const updates = matches.map((m) => {
    const at = new Date(cursor);
    const c = m.category;
    cursor += (c.rounds * c.roundSeconds + (c.rounds - 1) * c.restSeconds + gap * 60) * 1000;
    return db.match.update({ where: { id: m.id }, data: { scheduledAt: at } });
  });
  await db.$transaction(updates);
  void publish(area.id);
  go(path, "ok", `${matches.length} peleas programadas en ${area.name}`);
}

export async function clearSchedule(formData: FormData) {
  const area = await ownArea(str(formData, "areaId"));
  await db.match.updateMany({ where: { category: { areaId: area.id } }, data: { scheduledAt: null } });
  void publish(area.id);
  refresh();
}

export async function setMatchTime(formData: FormData) {
  const { scope } = await requireOrganizer();
  const match = await db.match.findFirst({
    where: { id: str(formData, "matchId"), category: { tournament: scope } },
    select: { id: true, category: { select: { areaId: true } } },
  });
  if (!match) redirect("/panel");
  await db.match.update({
    where: { id: match.id },
    data: { scheduledAt: parseWallTime(str(formData, "time")) },
  });
  if (match.category.areaId) void publish(match.category.areaId);
  refresh();
}

export async function createQuickMatch(formData: FormData) {
  const { orgId } = await requireOrganizer();
  const path = "/panel/combate";
  const redName = str(formData, "redName");
  const blueName = str(formData, "blueName");
  if (!redName || !blueName) go(path, "error", "Poné el nombre de los dos competidores");

  const { tournament, area: quickArea } = await ensureQuickArea(orgId);
  const judges = clamp(int(formData, "judges", quickArea.judges), 1, 7);
  const area =
    judges === quickArea.judges
      ? quickArea
      : await db.area.update({ where: { id: quickArea.id }, data: { judges } });
  const base = await categoryData(formData, tournament.id);
  const [lastOrder, lastNumber] = await Promise.all([
    db.category.aggregate({ where: { tournamentId: tournament.id }, _max: { order: true } }),
    db.match.aggregate({ where: { category: { tournamentId: tournament.id } }, _max: { number: true } }),
  ]);
  const corner = (side: "red" | "blue", name: string) => ({
    tournamentId: tournament.id,
    firstName: name,
    lastName: "",
    team: optStr(formData, `${side}Team`),
    country: findCountry(str(formData, `${side}Country`)),
  });

  const matchId = await db.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        ...base,
        tournamentId: tournament.id,
        name: str(formData, "title") || `${redName} vs ${blueName}`,
        format: "SINGLE",
        bracketFormat: "SINGLE",
        thirdPlaceMatch: false,
        areaId: area.id,
        order: (lastOrder._max.order ?? 0) + 1,
      },
    });
    const red = await tx.participant.create({
      data: { ...corner("red", redName), entries: { create: { categoryId: category.id } } },
      include: { entries: true },
    });
    const blue = await tx.participant.create({
      data: { ...corner("blue", blueName), entries: { create: { categoryId: category.id } } },
      include: { entries: true },
    });
    const match = await tx.match.create({
      data: {
        categoryId: category.id,
        round: 1,
        position: 0,
        depth: 0,
        label: "Combate",
        number: (lastNumber._max.number ?? 0) + 1,
        redEntryId: red.entries[0].id,
        blueEntryId: blue.entries[0].id,
        status: "READY",
        clockRemainingMs: base.roundSeconds * 1000,
      },
    });
    return match.id;
  });

  const called = await tableAction(area.id, { action: "call", matchId });
  void publish(area.id);
  go(
    path,
    "ok",
    called.ok
      ? "Combate creado y cargado en la mesa"
      : "Combate creado. Quedó en espera porque hay otro en curso",
  );
}

export async function deleteQuickMatch(formData: FormData) {
  const c = await ownCategory(str(formData, "categoryId"));
  const path = "/panel/combate";
  const t = await db.tournament.findUnique({ where: { id: c.tournamentId }, select: { quick: true } });
  if (!t?.quick) redirect(path);
  const running = await db.match.count({
    where: { categoryId: c.id, status: "LIVE", phase: { not: "IDLE" } },
  });
  if (running > 0) go(path, "error", "Ese combate está en curso. Cerralo desde la mesa antes de eliminarlo.");
  const entries = await db.entry.findMany({ where: { categoryId: c.id }, select: { participantId: true } });
  await db.$transaction([
    db.category.delete({ where: { id: c.id } }),
    db.participant.deleteMany({ where: { id: { in: entries.map((e) => e.participantId) } } }),
  ]);
  if (c.areaId) void publish(c.areaId);
  refresh();
}

export async function updateBranding(formData: FormData) {
  const { orgId } = await requireOrganizer();
  const path = "/panel/apariencia";
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      name: true,
      colorPrimary: true,
      colorAccent: true,
      corner1Name: true,
      corner1Color: true,
      corner2Name: true,
      corner2Color: true,
    },
  });
  const color = (key: string, fallback: string) => {
    const v = str(formData, key);
    return isHexColor(v) ? v : fallback;
  };
  const data: Prisma.OrganizationUpdateInput = {
    name: str(formData, "name").slice(0, 60) || org.name,
    colorPrimary: color("colorPrimary", org.colorPrimary),
    colorAccent: color("colorAccent", org.colorAccent),
    tvTheme: str(formData, "tvTheme") === "light" ? "light" : "dark",
    corner1Name: str(formData, "corner1Name").slice(0, 16) || org.corner1Name,
    corner1Color: color("corner1Color", org.corner1Color),
    corner2Name: str(formData, "corner2Name").slice(0, 16) || org.corner2Name,
    corner2Color: color("corner2Color", org.corner2Color),
    showFlags: formData.get("showFlags") === "on",
    showTeams: formData.get("showTeams") === "on",
  };
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      go(path, "error", "El logo tiene que ser PNG, JPG o WebP");
    }
    if (file.size > 1_000_000) go(path, "error", "El logo no puede pesar más de 1 MB");
    data.logo = new Uint8Array(await file.arrayBuffer());
    data.logoType = file.type;
  } else if (formData.get("removeLogo") === "on") {
    data.logo = null;
    data.logoType = null;
  }
  await db.organization.update({ where: { id: orgId }, data });
  const areas = await db.area.findMany({ where: { tournament: { orgId } }, select: { id: true } });
  for (const area of areas) void publish(area.id);
  go(path, "ok", "Apariencia guardada");
}

export async function changePassword(formData: FormData) {
  const { user } = await requireOrganizer();
  const path = "/panel/cuenta";
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) go(path, "error", "La contraseña actual no coincide");
  if (next.length < 8) go(path, "error", "La nueva contraseña necesita 8 caracteres o más");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  go(path, "ok", "Contraseña actualizada");
}

export async function addTournamentMember(formData: FormData) {
  const t = await ownedTournament(str(formData, "tournamentId"));
  const { acting } = await requireOrganizer();
  const path = `/panel/torneos/${t.id}`;
  const email = str(formData, "email").toLowerCase();
  if (!email) go(path, "error", "Escribí el email del organizador");

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    const name = str(formData, "name");
    const password = String(formData.get("password") ?? "");
    if (!acting) {
      go(path, "error", "No hay ninguna cuenta con ese email. Las cuentas nuevas las crea el administrador de la plataforma.");
    }
    if (!name || password.length < 8) {
      go(path, "error", "Esa cuenta no existe. Para crearla, completá nombre y una contraseña de 8 caracteres o más.");
    }
    let slug = slugify(name);
    if (await db.organization.findUnique({ where: { slug } })) {
      slug = `${slug}-${newCode(4).toLowerCase()}`;
    }
    const org = await db.organization.create({
      data: {
        name,
        slug,
        users: { create: { email, name, role: "ORGANIZER", passwordHash: await hashPassword(password) } },
      },
      include: { users: true },
    });
    user = org.users[0];
  }
  if (user.role !== "ORGANIZER") go(path, "error", "Esa cuenta es de administración, no de organizador");
  if (user.orgId === t.orgId) go(path, "error", "Esa cuenta ya pertenece a la organización dueña del torneo");

  await db.tournamentMember.upsert({
    where: { tournamentId_userId: { tournamentId: t.id, userId: user.id } },
    create: { tournamentId: t.id, userId: user.id },
    update: {},
  });
  go(path, "ok", `${user.name} ya puede administrar este torneo`);
}

export async function removeTournamentMember(formData: FormData) {
  const t = await ownedTournament(str(formData, "tournamentId"));
  await db.tournamentMember.deleteMany({
    where: { id: str(formData, "memberId"), tournamentId: t.id },
  });
  refresh();
}

export async function createDemoTournament() {
  const { orgId } = await requireOrganizer();
  const id = await createDemo(orgId);
  redirect(`/panel/torneos/${id}`);
}
