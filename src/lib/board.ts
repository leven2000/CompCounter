import { db } from './db'
import { brandSelect, toBrand, type Brand } from './brand'
import { fighterView, type FighterView } from './live'

export type BoardRow = {
  id: string
  number: number
  scheduledAt: number | null
  areaName: string | null
  categoryName: string
  label: string | null
  red: FighterView | null
  blue: FighterView | null
  state: 'LIVE' | 'CALLED' | 'NEXT' | 'WAITING' | 'PENDING'
}

export type BoardData = {
  now: number
  tournament: { name: string; slug: string }
  brand: Brand
  rows: BoardRow[]
}

const entry = { include: { participant: true } } as const

export async function loadBoard(slug: string): Promise<BoardData | null> {
  const tournament = await db.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, org: { select: brandSelect } },
  })
  if (!tournament) return null

  const matches = await db.match.findMany({
    where: {
      category: { tournamentId: tournament.id },
      status: { in: ['LIVE', 'READY', 'PENDING'] },
    },
    include: {
      category: { select: { name: true, order: true, area: { select: { id: true, name: true } } } },
      currentInArea: { select: { name: true } },
      red: entry,
      blue: entry,
    },
    orderBy: [
      { scheduledAt: { sort: 'asc', nulls: 'last' } },
      { depth: 'desc' },
      { category: { order: 'asc' } },
      { round: 'asc' },
      { position: 'asc' },
    ],
    take: 120,
  })

  const nextTaken = new Set<string>()
  const rows: BoardRow[] = []
  for (const m of matches) {
    if (m.status === 'PENDING' && !m.redEntryId && !m.blueEntryId) continue
    const areaId = m.category.area?.id ?? null
    let state: BoardRow['state'] = 'WAITING'
    if (m.status === 'LIVE') state = m.phase === 'IDLE' ? 'CALLED' : 'LIVE'
    else if (m.status === 'PENDING') state = 'PENDING'
    else if (areaId && !nextTaken.has(areaId)) {
      nextTaken.add(areaId)
      state = 'NEXT'
    }
    rows.push({
      id: m.id,
      number: m.number,
      scheduledAt: m.scheduledAt ? m.scheduledAt.getTime() : null,
      areaName: m.currentInArea?.name ?? m.category.area?.name ?? null,
      categoryName: m.category.name,
      label: m.label,
      red: fighterView(m.red),
      blue: fighterView(m.blue),
      state,
    })
  }

  const rank = { LIVE: 0, CALLED: 1, NEXT: 2, WAITING: 2, PENDING: 2 }
  rows.sort((a, b) => rank[a.state] - rank[b.state])

  return {
    now: Date.now(),
    tournament: { name: tournament.name, slug: tournament.slug },
    brand: toBrand(tournament.org),
    rows,
  }
}
