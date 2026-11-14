import { db } from './db'
import { brandSelect, toBrand } from './brand'
import { normalizeCode } from './util'

export async function loadMesa(rawCode: string) {
  const code = normalizeCode(rawCode)
  if (!code) return null
  const tournament = await db.tournament.findUnique({
    where: { mesaCode: code },
    select: {
      id: true,
      name: true,
      slug: true,
      quick: true,
      org: { select: brandSelect },
      areas: { select: { id: true, name: true, judges: true }, orderBy: { order: 'asc' } },
    },
  })
  if (!tournament) return null
  return { code, tournament, areas: tournament.areas, brand: toBrand(tournament.org) }
}
