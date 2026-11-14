import { Prisma } from '@prisma/client'
import { db } from './db'
import { newCode, normalizeCode } from './util'

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

export async function resetMesaCode(tournamentId: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode()
    if (await db.matchJudge.findUnique({ where: { code } })) continue
    try {
      await db.tournament.update({ where: { id: tournamentId }, data: { mesaCode: code } })
      return code
    } catch (e) {
      if (!isUnique(e)) throw e
    }
  }
  throw new Error('No se pudo generar el código de mesa')
}

export async function ensureMesaCode(tournamentId: string) {
  const row = await db.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { mesaCode: true },
  })
  return row.mesaCode ?? resetMesaCode(tournamentId)
}

export async function ensureMatchJudges(matchId: string, judges: number) {
  const existing = await db.matchJudge.findMany({ where: { matchId } })
  for (let seat = 1; seat <= judges; seat++) {
    if (existing.some((e) => e.seat === seat)) continue
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = newCode()
      if (await db.tournament.findUnique({ where: { mesaCode: code } })) continue
      try {
        await db.matchJudge.create({ data: { matchId, seat, code } })
        break
      } catch (e) {
        if (!isUnique(e)) throw e
      }
    }
  }
  await db.matchJudge.deleteMany({ where: { matchId, seat: { gt: judges } } })
  return db.matchJudge.findMany({ where: { matchId }, orderBy: { seat: 'asc' } })
}

export type Access =
  | { role: 'TABLE'; code: string; tournamentId: string }
  | { role: 'JUDGE'; code: string; matchId: string; seat: number }

export async function resolveCode(raw: string): Promise<Access | null> {
  const code = normalizeCode(raw)
  if (!code) return null
  const tournament = await db.tournament.findUnique({ where: { mesaCode: code }, select: { id: true } })
  if (tournament) return { role: 'TABLE', code, tournamentId: tournament.id }
  const judge = await db.matchJudge.findUnique({ where: { code } })
  if (judge) return { role: 'JUDGE', code, matchId: judge.matchId, seat: judge.seat }
  return null
}
