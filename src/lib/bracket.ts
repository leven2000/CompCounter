import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from './db'
import { pickFormat } from './bracket-core'

type EntryRow = { id: string; seed: number | null; participant: { team: string | null } }

export type BracketResult = { ok: true; matches: number } | { ok: false; error: string }

export function roundLabel(depth: number, round: number) {
  if (depth === 0) return 'Final'
  if (depth === 1) return 'Semifinal'
  if (depth === 2) return 'Cuartos de final'
  if (depth === 3) return 'Octavos de final'
  return `Ronda ${round}`
}

function shuffle<T>(items: T[]) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function bitReverse(value: number, bits: number) {
  let out = 0
  for (let i = 0; i < bits; i++) {
    out = (out << 1) | ((value >> i) & 1)
  }
  return out
}

const teamKey = (e: EntryRow) => (e.participant.team ?? '').trim().toLowerCase()

function orderEntries(entries: EntryRow[]) {
  const seeded = entries.filter((e) => e.seed != null).sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
  return [...seeded, ...shuffle(entries.filter((e) => e.seed == null))]
}

function placeEntries(entries: EntryRow[], totalRounds: number) {
  const size = 2 ** totalRounds
  const pairs = size / 2
  const pairOrder = Array.from({ length: pairs }, (_, i) => bitReverse(i, Math.log2(pairs)))
  const slotOrder = [...pairOrder.map((p) => p * 2), ...[...pairOrder].reverse().map((p) => p * 2 + 1)]
  const free = slotOrder.slice(0, entries.length)
  const leaves: (EntryRow | null)[] = Array.from({ length: size }, () => null)

  const seeded = entries.filter((e) => e.seed != null).sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
  for (const entry of seeded) leaves[free.shift()!] = entry

  const groups = new Map<string, EntryRow[]>()
  for (const entry of shuffle(entries.filter((e) => e.seed == null))) {
    const key = teamKey(entry) || `solo-${entry.id}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  const teams = [...groups.values()].sort((a, b) => b.length - a.length)

  const closeness = (a: number, b: number) => 2 ** (totalRounds - Math.floor(Math.log2(a ^ b)) - 1)

  for (const members of teams) {
    for (const entry of members) {
      const team = teamKey(entry)
      let best: number[] = []
      let bestCost = Infinity
      for (const slot of free) {
        let cost = 0
        if (team) {
          leaves.forEach((other, leaf) => {
            if (other && teamKey(other) === team) cost += closeness(slot, leaf)
          })
        }
        if (cost < bestCost) {
          bestCost = cost
          best = [slot]
        } else if (cost === bestCost) {
          best.push(slot)
        }
      }
      const pick = best[Math.floor(Math.random() * best.length)]
      leaves[pick] = entry
      free.splice(free.indexOf(pick), 1)
    }
  }
  return leaves
}

function singleElimination(
  categoryId: string,
  leaves: (string | null)[],
  roundMs: number,
  thirdPlace: boolean,
): Prisma.MatchCreateManyInput[] {
  const n = leaves.filter(Boolean).length
  const size = leaves.length
  const totalRounds = Math.log2(size)
  const slots = Array.from({ length: size / 2 }, (_, p) => [leaves[p * 2], leaves[p * 2 + 1]])

  const ids: string[][] = []
  for (let r = 1; r <= totalRounds; r++) {
    ids[r] = Array.from({ length: size / 2 ** r }, () => randomUUID())
  }

  const rows = new Map<string, Prisma.MatchCreateManyInput>()
  for (let r = 1; r <= totalRounds; r++) {
    ids[r].forEach((id, p) => {
      const depth = totalRounds - r
      rows.set(id, {
        id,
        categoryId,
        round: r,
        position: p,
        depth,
        label: roundLabel(depth, r),
        nextMatchId: r < totalRounds ? ids[r + 1][Math.floor(p / 2)] : null,
        nextSlot: r < totalRounds ? (p % 2 === 0 ? 'RED' : 'BLUE') : null,
        redEntryId: r === 1 ? slots[p][0] : null,
        blueEntryId: r === 1 ? slots[p][1] : null,
        status: 'PENDING',
        clockRemainingMs: roundMs,
      })
    })
  }

  for (const id of ids[1]) {
    const row = rows.get(id)!
    if (Boolean(row.redEntryId) === Boolean(row.blueEntryId)) continue
    const only = row.redEntryId ?? row.blueEntryId
    row.status = 'BYE'
    row.winnerEntryId = only
    row.winMethod = 'Pase libre'
    if (row.nextMatchId) {
      const next = rows.get(row.nextMatchId)!
      if (row.nextSlot === 'BLUE') next.blueEntryId = only
      else next.redEntryId = only
    }
  }

  if (thirdPlace && totalRounds >= 2 && n >= 4) {
    const id = randomUUID()
    ids[totalRounds - 1].forEach((semiId, p) => {
      const semi = rows.get(semiId)!
      semi.loserNextMatchId = id
      semi.loserNextSlot = p === 0 ? 'RED' : 'BLUE'
    })
    rows.set(id, {
      id,
      categoryId,
      round: totalRounds,
      position: 1,
      depth: 0,
      label: '3er puesto',
      status: 'PENDING',
      clockRemainingMs: roundMs,
    })
  }

  for (const row of rows.values()) {
    if (row.status === 'PENDING' && row.redEntryId && row.blueEntryId) row.status = 'READY'
  }

  return [...rows.values()]
}

function roundRobin(categoryId: string, ordered: EntryRow[], roundMs: number): Prisma.MatchCreateManyInput[] {
  const list: (EntryRow | null)[] = [...ordered]
  if (list.length % 2 === 1) list.push(null)
  const rounds = list.length - 1
  const half = list.length / 2
  const rows: Prisma.MatchCreateManyInput[] = []
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = list[i]
      const b = list[list.length - 1 - i]
      if (!a || !b) continue
      rows.push({
        id: randomUUID(),
        categoryId,
        round: r + 1,
        position: i,
        depth: rounds - 1 - r,
        label: ordered.length === 2 ? 'Final' : `Ronda ${r + 1}`,
        redEntryId: a.id,
        blueEntryId: b.id,
        status: 'READY',
        clockRemainingMs: roundMs,
      })
    }
    list.splice(1, 0, list.pop()!)
  }
  return rows
}

export async function generateBracket(
  categoryId: string,
  manual?: (string | null)[],
  force = false,
): Promise<BracketResult> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    include: {
      tournament: { select: { bracketFormat: true, roundRobinMax: true, thirdPlaceMatch: true } },
      entries: { include: { participant: { select: { team: true } } } },
      matches: { select: { status: true } },
    },
  })
  if (!category) return { ok: false, error: 'Categoría inexistente' }
  if (!force && category.matches.some((m) => m.status === 'LIVE' || m.status === 'DONE')) {
    return { ok: false, error: 'La llave ya tiene peleas jugadas' }
  }

  const n = category.entries.length
  const roundMs = category.roundSeconds * 1000
  let rows: Prisma.MatchCreateManyInput[] = []
  let format: string | null = null

  const thirdPlace = category.thirdPlaceMatch || category.tournament.thirdPlaceMatch
  if (manual) {
    format = 'SINGLE'
    rows = singleElimination(categoryId, manual, roundMs, thirdPlace)
  } else if (n >= 2) {
    format = pickFormat(n, category.format, category.tournament.bracketFormat, category.tournament.roundRobinMax)
    const leaves = () =>
      placeEntries(category.entries, Math.ceil(Math.log2(n))).map((entry) => entry?.id ?? null)
    rows =
      format === 'ROUND_ROBIN'
        ? roundRobin(categoryId, orderEntries(category.entries), roundMs)
        : singleElimination(categoryId, leaves(), roundMs, thirdPlace)
  }

  const max = await db.match.aggregate({
    where: { category: { tournamentId: category.tournamentId }, categoryId: { not: categoryId } },
    _max: { number: true },
  })
  let number = max._max.number ?? 0
  const playable = rows
    .filter((r) => r.status !== 'BYE')
    .sort(
      (a, b) =>
        a.round - b.round ||
        Number(a.label === 'Final') - Number(b.label === 'Final') ||
        a.position - b.position,
    )
  for (const row of playable) row.number = ++number

  await db.$transaction([
    db.match.deleteMany({ where: { categoryId } }),
    db.match.createMany({ data: rows }),
    db.category.update({ where: { id: categoryId }, data: { bracketFormat: format } }),
  ])

  return { ok: true, matches: playable.length }
}

export async function clearBracket(categoryId: string, force = false): Promise<BracketResult> {
  const played = force
    ? 0
    : await db.match.count({
        where: { categoryId, status: { in: ['LIVE', 'DONE'] } },
      })
  if (played > 0) return { ok: false, error: 'La llave ya tiene peleas jugadas' }
  await db.$transaction([
    db.match.deleteMany({ where: { categoryId } }),
    db.category.update({ where: { id: categoryId }, data: { bracketFormat: null } }),
  ])
  return { ok: true, matches: 0 }
}
