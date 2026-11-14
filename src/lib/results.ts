export type ResultMatch = {
  id: string
  round: number
  position: number
  depth: number
  label: string | null
  status: string
  redEntryId: string | null
  blueEntryId: string | null
  winnerEntryId: string | null
}

export type Standing = { entryId: string; played: number; wins: number; losses: number }

export function standings(entryIds: string[], matches: ResultMatch[]): Standing[] {
  const table = new Map<string, Standing>(
    entryIds.map((id) => [id, { entryId: id, played: 0, wins: 0, losses: 0 }]),
  )
  for (const m of matches) {
    if (m.status !== 'DONE' || !m.winnerEntryId) continue
    for (const id of [m.redEntryId, m.blueEntryId]) {
      const row = id ? table.get(id) : undefined
      if (!row) continue
      row.played += 1
      if (id === m.winnerEntryId) row.wins += 1
      else row.losses += 1
    }
  }
  const beat = (a: string, b: string) =>
    matches.some(
      (m) =>
        m.status === 'DONE' &&
        m.winnerEntryId === a &&
        ((m.redEntryId === a && m.blueEntryId === b) || (m.redEntryId === b && m.blueEntryId === a)),
    )
  return [...table.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (beat(a.entryId, b.entryId)) return -1
    if (beat(b.entryId, a.entryId)) return 1
    return a.losses - b.losses
  })
}

export type Podium = { gold: string | null; silver: string | null; bronze: string[]; complete: boolean }

export function podium(format: string | null, entryIds: string[], matches: ResultMatch[]): Podium {
  if (entryIds.length === 1 && matches.length === 0) {
    return { gold: entryIds[0], silver: null, bronze: [], complete: true }
  }
  const playable = matches.filter((m) => m.status !== 'BYE')
  if (playable.length === 0) return { gold: null, silver: null, bronze: [], complete: false }

  if (format === 'ROUND_ROBIN') {
    const complete = playable.every((m) => m.status === 'DONE')
    if (!complete) return { gold: null, silver: null, bronze: [], complete: false }
    const order = standings(entryIds, matches).map((s) => s.entryId)
    return { gold: order[0] ?? null, silver: order[1] ?? null, bronze: order[2] ? [order[2]] : [], complete }
  }

  const final = matches.find((m) => m.label === 'Final')
  if (!final || final.status !== 'DONE' || !final.winnerEntryId) {
    return { gold: null, silver: null, bronze: [], complete: false }
  }
  const loser = (m: ResultMatch) => (m.winnerEntryId === m.redEntryId ? m.blueEntryId : m.redEntryId)
  const third = matches.find((m) => m.label === '3er puesto')
  let bronze: string[] = []
  if (third) {
    bronze = third.status === 'DONE' && third.winnerEntryId ? [third.winnerEntryId] : []
  } else {
    bronze = matches
      .filter((m) => m.depth === 1 && m.status === 'DONE')
      .map(loser)
      .filter((id): id is string => !!id)
  }
  return { gold: final.winnerEntryId, silver: loser(final), bronze, complete: true }
}
