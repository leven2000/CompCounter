import { Prisma } from '@prisma/client'
import { db } from './db'
import { ensureMesaCode } from './access'
import { newCode } from './util'

export async function ensureQuickArea(orgId: string) {
  let tournament = await db.tournament.findFirst({ where: { orgId, quick: true } })

  if (!tournament) {
    const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { slug: true } })
    const data = { orgId, name: 'Combates sueltos', quick: true, published: false }
    try {
      tournament = await db.tournament.create({ data: { ...data, slug: `sueltos-${org.slug}` } })
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
      tournament = await db.tournament.create({
        data: { ...data, slug: `sueltos-${org.slug}-${newCode(4).toLowerCase()}` },
      })
    }
  }

  let area = await db.area.findFirst({
    where: { tournamentId: tournament.id },
    orderBy: { order: 'asc' },
  })
  if (!area) {
    area = await db.area.create({
      data: { tournamentId: tournament.id, name: 'Combate', order: 1, judges: 3 },
    })
  }
  const mesaCode = await ensureMesaCode(tournament.id)

  return { tournament, area, mesaCode }
}
