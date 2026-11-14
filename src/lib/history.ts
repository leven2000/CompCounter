import type { Prisma } from '@prisma/client'
import { db } from './db'
import { computeScore, getRuleset } from './rules'

export type HistoryFilters = {
  scope?: Prisma.TournamentWhereInput
  tournamentId?: string
  q?: string
}

const entryName = { include: { participant: { select: { firstName: true, lastName: true, team: true, country: true } } } } as const

export async function loadHistory(filters: HistoryFilters) {
  const scope: Prisma.TournamentWhereInput = filters.scope ?? {}
  const q = filters.q?.trim()
  const byName: Prisma.ParticipantWhereInput | undefined = q
    ? {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { team: { contains: q, mode: 'insensitive' } },
        ],
      }
    : undefined

  const [tournaments, matches] = await Promise.all([
    db.tournament.findMany({
      where: scope,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 150,
      select: {
        id: true,
        name: true,
        date: true,
        createdAt: true,
        quick: true,
        org: { select: { name: true } },
        _count: { select: { categories: true, participants: true } },
      },
    }),
    db.match.findMany({
      where: {
        status: 'DONE',
        category: {
          tournament: { ...scope, ...(filters.tournamentId ? { id: filters.tournamentId } : {}) },
        },
        ...(byName ? { OR: [{ red: { participant: byName } }, { blue: { participant: byName } }] } : {}),
      },
      orderBy: { finishedAt: 'desc' },
      take: 200,
      include: {
        category: {
          select: {
            name: true,
            tournament: { select: { id: true, name: true, quick: true, org: { select: { name: true } } } },
          },
        },
        red: entryName,
        blue: entryName,
      },
    }),
  ])

  const ids = tournaments.map((t) => t.id)
  const [categories, counts] = await Promise.all([
    db.category.findMany({ where: { tournamentId: { in: ids } }, select: { id: true, tournamentId: true } }),
    db.match.groupBy({
      by: ['categoryId'],
      where: { status: 'DONE', category: { tournamentId: { in: ids } } },
      _count: { _all: true },
    }),
  ])
  const tournamentOf = new Map(categories.map((c) => [c.id, c.tournamentId]))
  const fights = new Map<string, number>()
  for (const row of counts) {
    const id = tournamentOf.get(row.categoryId)
    if (id) fights.set(id, (fights.get(id) ?? 0) + row._count._all)
  }

  return {
    tournaments: tournaments.map((t) => ({ ...t, fights: fights.get(t.id) ?? 0 })),
    matches,
  }
}

export type HistoryData = Awaited<ReturnType<typeof loadHistory>>

export async function loadMatchReport(matchId: string, scope?: Prisma.TournamentWhereInput) {
  const match = await db.match.findFirst({
    where: {
      id: matchId,
      status: 'DONE',
      ...(scope ? { category: { tournament: scope } } : {}),
    },
    include: {
      category: {
        include: {
          area: { select: { name: true, judges: true } },
          tournament: {
            select: {
              name: true,
              quick: true,
              org: { select: { name: true, corner1Name: true, corner2Name: true } },
            },
          },
        },
      },
      red: entryName,
      blue: entryName,
      events: { where: { voided: false }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!match) return null

  const rules = getRuleset(match.category.ruleset)
  const seats = Math.max(
    match.category.area?.judges ?? 0,
    ...match.events.filter((e) => e.judge != null).map((e) => e.judge ?? 0),
  )
  const score = computeScore(rules, match.events, seats, match.category.rounds, match.category.autoLadder)
  const lastRound = Math.max(match.category.rounds, ...match.events.map((e) => e.round))

  const cards = Array.from({ length: rules.mode === 'judges' ? seats : 0 }, (_, i) => {
    const seat = i + 1
    const rounds = Array.from({ length: lastRound }, (_, r) => {
      const inRound = match.events.filter(
        (e) => e.type === 'JUDGE' && e.judge === seat && e.round === r + 1,
      )
      const sum = (corner: string) =>
        inRound.filter((e) => e.corner === corner).reduce((acc, e) => acc + e.value, 0)
      return { red: sum('RED'), blue: sum('BLUE') }
    })
    return { seat, rounds, total: score.judges.find((j) => j.seat === seat) ?? null }
  })

  return {
    match,
    rules,
    score,
    cards,
    lastRound,
    log: match.events.filter((e) => e.type !== 'JUDGE'),
  }
}

export type MatchReportData = NonNullable<Awaited<ReturnType<typeof loadMatchReport>>>
