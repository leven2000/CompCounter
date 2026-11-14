import { Prisma } from '@prisma/client'
import { db } from './db'
import { ensureMatchJudges } from './access'
import * as bus from './bus'
import { brandSelect, toBrand, type Brand } from './brand'
import { countryName } from './countries'
import { countryCode3 } from './country-codes'
import {
  computeScore,
  getRuleset,
  type Corner,
  type JudgeTotals,
  type SideTotals,
} from './rules'

const entryInclude = { include: { participant: true } } as const

const matchInclude = {
  category: true,
  red: entryInclude,
  blue: entryInclude,
  events: { where: { voided: false }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.MatchInclude

type MatchFull = Prisma.MatchGetPayload<{ include: typeof matchInclude }>
type EntryFull = MatchFull['red']

export type FighterView = {
  name: string
  team: string | null
  country: string | null
  countryCode: string | null
  countryName: string | null
  photoUrl: string | null
}

export type MatchView = {
  id: string
  number: number
  label: string | null
  categoryName: string
  rules: {
    id: string
    name: string
    mode: 'judges' | 'operator'
    board: 'split' | 'rows'
    pointButtons: number[]
    advantages: boolean
    penalties: boolean
    warnings: boolean
    minusPoints: boolean
    knockdowns: boolean
    exits: boolean
    winMethods: string[]
    leadLimit: number | null
  }
  rounds: number
  roundSeconds: number
  red: FighterView | null
  blue: FighterView | null
  status: string
  phase: string
  currentRound: number
  clock: { running: boolean; remainingMs: number; startedAt: number | null }
  sides: Record<Corner, SideTotals>
  judges: JudgeTotals[]
  favor: Record<Corner, number>
  suggestion: { winner: Corner | null; reason: string }
  pendingDecisions: number[]
  leadReached: boolean
  winner: Corner | null
  winMethod: string | null
  log: {
    id: string
    type: string
    corner: string
    value: number
    judge: number | null
    round: number
    at: number
  }[]
}

export type QueueItem = {
  id: string
  number: number
  label: string | null
  categoryName: string
  scheduledAt: number | null
  red: FighterView | null
  blue: FighterView | null
}

export type Snapshot = {
  now: number
  area: { id: string; name: string; judges: number }
  tournament: { id: string; name: string; slug: string }
  brand: Brand
  match: MatchView | null
  queue: QueueItem[]
  presence: { table: boolean; judges: number[] }
}

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })
const done: ActionResult = { ok: true }

export function fighterView(entry: EntryFull): FighterView | null {
  if (!entry) return null
  const p = entry.participant
  return {
    name: `${p.firstName} ${p.lastName}`.trim(),
    team: p.team,
    country: p.country,
    countryCode: p.country ? countryCode3(p.country) : null,
    countryName: p.country ? countryName(p.country) : null,
    photoUrl: p.photoVersion > 0 ? `/api/photo/${p.id}?v=${p.photoVersion}` : null,
  }
}

function remainingNow(m: { clockRunning: boolean; clockStartedAt: Date | null; clockRemainingMs: number }) {
  if (m.clockRunning && m.clockStartedAt) {
    return Math.max(0, m.clockRemainingMs - (Date.now() - m.clockStartedAt.getTime()))
  }
  return m.clockRemainingMs
}

async function settle(m: MatchFull): Promise<MatchFull> {
  if (m.status !== 'LIVE' || !m.clockRunning || !m.clockStartedAt) return m
  const roundMs = m.category.roundSeconds * 1000
  const restMs = m.category.restSeconds * 1000
  const rounds = m.category.rounds
  const now = Date.now()

  let phase = m.phase
  let currentRound = m.currentRound
  let running = true
  let remaining = m.clockRemainingMs
  let startedAt: Date | null = m.clockStartedAt
  let endAt = startedAt.getTime() + remaining
  let changed = false

  while (running && endAt <= now) {
    changed = true
    if (phase === 'ROUND' && currentRound < rounds && restMs > 0) {
      phase = 'REST'
      remaining = restMs
      startedAt = new Date(endAt)
      endAt += restMs
    } else if ((phase === 'ROUND' && currentRound < rounds) || phase === 'REST') {
      phase = 'ROUND'
      currentRound += 1
      running = false
      remaining = roundMs
      startedAt = null
    } else {
      phase = 'ENDED'
      running = false
      remaining = 0
      startedAt = null
    }
  }

  if (!changed) return m
  return db.match.update({
    where: { id: m.id },
    data: {
      phase,
      currentRound,
      clockRunning: running,
      clockRemainingMs: remaining,
      clockStartedAt: startedAt,
    },
    include: matchInclude,
  })
}

function matchView(m: MatchFull, judgeCount: number): MatchView {
  const rules = getRuleset(m.category.ruleset)
  const score = computeScore(rules, m.events, judgeCount, m.category.rounds, m.category.autoLadder)
  let winner: Corner | null = null
  if (m.winnerEntryId) winner = m.winnerEntryId === m.redEntryId ? 'RED' : 'BLUE'
  return {
    id: m.id,
    number: m.number,
    label: m.label,
    categoryName: m.category.name,
    rules: {
      id: rules.id,
      name: rules.name,
      mode: rules.mode,
      board: rules.board,
      pointButtons: rules.pointButtons,
      advantages: rules.advantages,
      penalties: rules.penalties,
      warnings: rules.warnings,
      minusPoints: rules.minusPoints,
      knockdowns: rules.knockdowns,
      exits: rules.exits,
      winMethods: rules.winMethods,
      leadLimit: rules.leadLimit,
    },
    rounds: m.category.rounds,
    roundSeconds: m.category.roundSeconds,
    red: fighterView(m.red),
    blue: fighterView(m.blue),
    status: m.status,
    phase: m.phase,
    currentRound: m.currentRound,
    clock: {
      running: m.clockRunning,
      remainingMs: m.clockRemainingMs,
      startedAt: m.clockStartedAt ? m.clockStartedAt.getTime() : null,
    },
    ...score,
    winner,
    winMethod: m.winMethod,
    log: m.events
      .filter((e) => e.type !== 'JUDGE')
      .slice(-12)
      .reverse()
      .map((e) => ({
        id: e.id,
        type: e.type,
        corner: e.corner,
        value: e.value,
        judge: e.judge,
        round: e.round,
        at: e.createdAt.getTime(),
      })),
  }
}

export async function buildSnapshot(areaId: string): Promise<Snapshot | null> {
  const area = await db.area.findUnique({
    where: { id: areaId },
    include: {
      tournament: {
        select: { id: true, name: true, slug: true, org: { select: brandSelect } },
      },
      currentMatch: { include: matchInclude },
    },
  })
  if (!area) return null

  const match = area.currentMatch ? await settle(area.currentMatch) : null

  const queue = await db.match.findMany({
    where: { status: 'READY', category: { areaId } },
    include: { category: true, red: entryInclude, blue: entryInclude },
    orderBy: [
      { scheduledAt: { sort: 'asc', nulls: 'last' } },
      { depth: 'desc' },
      { category: { order: 'asc' } },
      { round: 'asc' },
      { position: 'asc' },
    ],
    take: 40,
  })

  return {
    now: Date.now(),
    area: { id: area.id, name: area.name, judges: area.judges },
    tournament: { id: area.tournament.id, name: area.tournament.name, slug: area.tournament.slug },
    brand: toBrand(area.tournament.org),
    match: match ? matchView(match, area.judges) : null,
    queue: queue.map((q) => ({
      id: q.id,
      number: q.number,
      label: q.label,
      categoryName: q.category.name,
      scheduledAt: q.scheduledAt ? q.scheduledAt.getTime() : null,
      red: fighterView(q.red),
      blue: fighterView(q.blue),
    })),
    presence: bus.presence(areaId, match?.id ?? null),
  }
}

export function publish(areaId: string) {
  return bus.coalesce(areaId, async () => {
    const snap = await buildSnapshot(areaId)
    if (!snap) return
    bus.broadcast(areaId, JSON.stringify(snap))
    const m = snap.match
    if (m && m.status === 'LIVE' && m.clock.running && m.clock.startedAt != null) {
      const remaining = m.clock.remainingMs - (Date.now() - m.clock.startedAt)
      bus.setTimer(areaId, remaining + 40, () => {
        void publish(areaId)
      })
    } else {
      bus.clearTimer(areaId)
    }
  })
}

async function loadCurrent(areaId: string) {
  return db.area.findUnique({
    where: { id: areaId },
    include: { currentMatch: { include: matchInclude } },
  })
}

async function placeEntry(
  tx: Prisma.TransactionClient,
  matchId: string,
  slot: string | null,
  entryId: string | null,
) {
  const data = slot === 'BLUE' ? { blueEntryId: entryId } : { redEntryId: entryId }
  const updated = await tx.match.update({ where: { id: matchId }, data })
  const ready = updated.redEntryId && updated.blueEntryId
  if (ready && updated.status === 'PENDING') {
    await tx.match.update({ where: { id: matchId }, data: { status: 'READY' } })
  }
  if (!ready && updated.status === 'READY') {
    await tx.match.update({ where: { id: matchId }, data: { status: 'PENDING' } })
  }
}

const COUNTER_TYPES = ['POINT', 'ADV', 'PEN', 'WARN', 'MINUS', 'KD', 'EXIT']

export async function tableAction(areaId: string, body: Record<string, unknown>): Promise<ActionResult> {
  const area = await loadCurrent(areaId)
  if (!area) return fail('Área inexistente')
  const m = area.currentMatch
  const action = String(body.action ?? '')

  if (action === 'call') {
    const target = await db.match.findFirst({
      where: { id: String(body.matchId ?? ''), category: { tournamentId: area.tournamentId } },
      include: { category: true },
    })
    if (!target || target.status !== 'READY') return fail('Esa pelea no está lista para llamar')
    if (m && m.status === 'LIVE' && m.phase !== 'IDLE') return fail('Hay una pelea en curso en esta área')
    await db.$transaction(async (tx) => {
      if (m && m.status === 'LIVE') {
        await tx.match.update({ where: { id: m.id }, data: { status: 'READY' } })
      }
      await tx.area.update({ where: { id: areaId }, data: { currentMatchId: null } })
      await tx.match.update({
        where: { id: target.id },
        data: {
          status: 'LIVE',
          phase: 'IDLE',
          currentRound: 1,
          clockRunning: false,
          clockRemainingMs: target.category.roundSeconds * 1000,
          clockStartedAt: null,
        },
      })
      await tx.area.update({ where: { id: areaId }, data: { currentMatchId: target.id } })
    })
    if (getRuleset(target.category.ruleset).mode === 'judges') {
      await ensureMatchJudges(target.id, area.judges)
    }
    return done
  }

  if (action === 'clear') {
    if (m && m.status === 'LIVE' && m.phase !== 'IDLE') return fail('Terminá la pelea antes de liberar el área')
    await db.$transaction(async (tx) => {
      if (m && m.status === 'LIVE') {
        await tx.match.update({ where: { id: m.id }, data: { status: 'READY' } })
      }
      await tx.area.update({ where: { id: areaId }, data: { currentMatchId: null } })
    })
    return done
  }

  if (!m) return fail('No hay pelea en esta área')

  if (action === 'reopen') {
    if (m.status !== 'DONE') return fail('La pelea no está cerrada')
    const nextIds = [m.nextMatchId, m.loserNextMatchId].filter((x): x is string => !!x)
    const nexts = await db.match.findMany({ where: { id: { in: nextIds } } })
    if (nexts.some((n) => n.status === 'LIVE' || n.status === 'DONE')) {
      return fail('La pelea siguiente ya empezó; no se puede reabrir')
    }
    await db.$transaction(async (tx) => {
      if (m.nextMatchId) await placeEntry(tx, m.nextMatchId, m.nextSlot, null)
      if (m.loserNextMatchId) await placeEntry(tx, m.loserNextMatchId, m.loserNextSlot, null)
      await tx.match.update({
        where: { id: m.id },
        data: {
          status: 'LIVE',
          phase: m.phase === 'IDLE' ? 'IDLE' : 'ENDED',
          winnerEntryId: null,
          winMethod: null,
          resultSummary: null,
          finishedAt: null,
        },
      })
    })
    return done
  }

  if (m.status !== 'LIVE') return fail('La pelea ya está cerrada')

  switch (action) {
    case 'start': {
      if (m.phase === 'ENDED') return fail('El tiempo ya terminó')
      if (m.clockRunning) return done
      await db.match.update({
        where: { id: m.id },
        data: {
          clockRunning: true,
          clockStartedAt: new Date(),
          phase: m.phase === 'IDLE' ? 'ROUND' : m.phase,
        },
      })
      return done
    }
    case 'stop': {
      await db.match.update({
        where: { id: m.id },
        data: { clockRunning: false, clockRemainingMs: remainingNow(m), clockStartedAt: null },
      })
      return done
    }
    case 'adjust': {
      const delta = Number(body.deltaMs)
      if (!Number.isFinite(delta)) return fail('Ajuste inválido')
      await db.match.update({
        where: { id: m.id },
        data: {
          clockRemainingMs: Math.max(0, remainingNow(m) + delta),
          clockStartedAt: m.clockRunning ? new Date() : null,
        },
      })
      return done
    }
    case 'endRound': {
      if (m.phase !== 'ROUND' && m.phase !== 'REST') return fail('No hay round en curso')
      await db.match.update({
        where: { id: m.id },
        data: { clockRunning: true, clockRemainingMs: 0, clockStartedAt: new Date(Date.now() - 1) },
      })
      return done
    }
    case 'extra': {
      const seconds = Number(body.seconds)
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) return fail('Duración inválida')
      await db.match.update({
        where: { id: m.id },
        data: {
          phase: 'ROUND',
          currentRound: m.currentRound + 1,
          clockRunning: false,
          clockRemainingMs: Math.round(seconds * 1000),
          clockStartedAt: null,
        },
      })
      return done
    }
    case 'event': {
      const type = String(body.type ?? '')
      const corner = body.corner === 'BLUE' ? 'BLUE' : 'RED'
      const value = Math.round(Number(body.value))
      if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 10) return fail('Valor inválido')
      const judge = type === 'JUDGE' ? Math.round(Number(body.judge)) : null
      if (type === 'JUDGE') {
        if (!judge || judge < 1 || judge > area.judges) return fail('Juez inválido')
      } else if (!COUNTER_TYPES.includes(type)) {
        return fail('Tipo de evento inválido')
      }
      if (value < 0) {
        const total = m.events
          .filter((e) => e.type === type && e.corner === corner && e.judge === judge)
          .reduce((acc, e) => acc + e.value, 0)
        if (total + value < 0) return fail('No hay nada para descontar')
      }
      await db.scoreEvent.create({
        data: { matchId: m.id, type, corner, value, judge, round: m.currentRound },
      })
      return done
    }
    case 'undo': {
      const last = [...m.events].reverse().find((e) => e.type !== 'JUDGE' && e.type !== 'DECISION')
      if (!last) return fail('No hay nada para deshacer')
      await db.scoreEvent.update({ where: { id: last.id }, data: { voided: true } })
      return done
    }
    case 'finish': {
      const winner = body.winner === 'BLUE' ? 'BLUE' : body.winner === 'RED' ? 'RED' : null
      const method = String(body.method ?? '').slice(0, 60) || 'Puntos'
      if (!winner) return fail('Elegí el ganador')
      const winnerEntryId = winner === 'RED' ? m.redEntryId : m.blueEntryId
      const loserEntryId = winner === 'RED' ? m.blueEntryId : m.redEntryId
      if (!winnerEntryId) return fail('Falta el competidor ganador')
      const rules = getRuleset(m.category.ruleset)
      const score = computeScore(rules, m.events, area.judges, m.category.rounds, m.category.autoLadder)
      const resultSummary =
        rules.mode === 'judges'
          ? `${score.favor.RED}-${score.favor.BLUE} en tarjetas`
          : rules.pointButtons.length > 0
            ? `${score.sides.RED.score}-${score.sides.BLUE.score}`
            : null
      await db.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: m.id },
          data: {
            status: 'DONE',
            winnerEntryId,
            winMethod: method,
            resultSummary,
            clockRunning: false,
            clockRemainingMs: remainingNow(m),
            clockStartedAt: null,
            finishedAt: new Date(),
          },
        })
        if (m.nextMatchId) await placeEntry(tx, m.nextMatchId, m.nextSlot, winnerEntryId)
        if (m.loserNextMatchId && loserEntryId) {
          await placeEntry(tx, m.loserNextMatchId, m.loserNextSlot, loserEntryId)
        }
      })
      return done
    }
    default:
      return fail('Acción desconocida')
  }
}

export async function judgeAction(
  areaId: string,
  seat: number,
  body: Record<string, unknown>,
): Promise<ActionResult> {
  const area = await loadCurrent(areaId)
  if (!area) return fail('Área inexistente')
  const m = area.currentMatch
  if (!m || m.status !== 'LIVE') return fail('No hay pelea en curso')
  if (seat < 1 || seat > area.judges) return fail('Puesto de juez inválido')
  if (getRuleset(m.category.ruleset).mode !== 'judges') return fail('Esta modalidad no se puntúa con jueces')
  const corner = body.corner === 'BLUE' ? 'BLUE' : 'RED'
  const action = String(body.action ?? '')

  if (action === 'click') {
    if (m.phase !== 'ROUND') return fail('No hay round en curso')
    const value = Number(body.value) === -1 ? -1 : 1
    if (value === -1) {
      const total = m.events
        .filter((e) => e.type === 'JUDGE' && e.judge === seat && e.corner === corner && e.round === m.currentRound)
        .reduce((acc, e) => acc + e.value, 0)
      if (total <= 0) return fail('No hay puntos para descontar en este round')
    }
    const clientId = typeof body.clientId === 'string' ? body.clientId.slice(0, 64) : null
    try {
      await db.scoreEvent.create({
        data: { matchId: m.id, type: 'JUDGE', corner, value, judge: seat, round: m.currentRound, clientId },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return done
      throw e
    }
    return done
  }

  if (action === 'decision') {
    if (m.phase !== 'ENDED') return fail('La decisión se carga al terminar el tiempo')
    await db.scoreEvent.create({
      data: { matchId: m.id, type: 'DECISION', corner, value: 1, judge: seat, round: m.currentRound },
    })
    return done
  }

  return fail('Acción desconocida')
}
