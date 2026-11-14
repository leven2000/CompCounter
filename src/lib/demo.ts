import type { Prisma } from '@prisma/client'
import { db } from './db'
import { resetMesaCode } from './access'
import { generateBracket } from './bracket'
import { tableAction } from './live'
import { getRuleset } from './rules'
import { newCode } from './util'

const MEN = 'Juan Lucas Mateo Tomás Bruno Diego Nicolás Franco Agustín Santiago Martín Facundo Joaquín Ezequiel Ramiro Gonzalo Iván Leandro Matías Pablo Rodrigo Sebastián Thiago Valentín'.split(' ')
const WOMEN = 'Sofía Lucía Camila Valentina Martina Julieta Florencia Agustina Micaela Carolina Rocío Paula Daniela Abril Milagros Victoria'.split(' ')
const SURNAMES = 'Pérez Díaz Silva Rojas Luna Vega Sosa Paz Torres Ruiz Lima Núñez Acosta Benítez Castro Domínguez Escobar Ferreyra Gómez Herrera Ibáñez Juárez López Medina Navarro Ortiz Peralta Quiroga Ramos Suárez'.split(' ')
const TEAMS = ['Team Norte', 'Dojo Sur', 'Fight Club BA', 'Academia Leones', 'Centro Gracie', 'Kick Factory']
const COUNTRIES = ['AR', 'AR', 'AR', 'BR', 'UY', 'CL', 'AR', 'PY', 'PE', 'CO', 'AR', 'MX']

type Spec = {
  name: string
  ruleset: string
  gender: 'Masculino' | 'Femenino'
  ageGroup: string
  level: string | null
  weightMin: number | null
  weightMax: number | null
  count: number
  area: number
}

const SPECS: Spec[] = [
  { name: 'K-1 · Masculino · Adulto · -67 kg', ruleset: 'kick-ring', gender: 'Masculino', ageGroup: 'Adulto', level: null, weightMin: 63, weightMax: 67, count: 8, area: 0 },
  { name: 'Low Kick · Femenino · Adulto · -60 kg', ruleset: 'kick-ring', gender: 'Femenino', ageGroup: 'Adulto', level: null, weightMin: 56, weightMax: 60, count: 4, area: 0 },
  { name: 'Light Contact · Masculino · Juvenil · -63 kg', ruleset: 'kick-light', gender: 'Masculino', ageGroup: 'Juvenil', level: null, weightMin: 57, weightMax: 63, count: 6, area: 1 },
  { name: 'Kick Light · Femenino · Adulto · -55 kg', ruleset: 'kick-light', gender: 'Femenino', ageGroup: 'Adulto', level: null, weightMin: 50, weightMax: 55, count: 3, area: 1 },
  { name: 'Point Fighting · Masculino · Adulto · -74 kg', ruleset: 'point-fighting', gender: 'Masculino', ageGroup: 'Adulto', level: null, weightMin: 69, weightMax: 74, count: 5, area: 1 },
  { name: 'Jiu-Jitsu Gi · Masculino · Adulto · Azul · -76 kg', ruleset: 'bjj', gender: 'Masculino', ageGroup: 'Adulto', level: 'Azul', weightMin: 70, weightMax: 76, count: 8, area: 2 },
  { name: 'Jiu-Jitsu Gi · Femenino · Adulto · Blanco · -64 kg', ruleset: 'bjj', gender: 'Femenino', ageGroup: 'Adulto', level: 'Blanco', weightMin: 58.5, weightMax: 64, count: 4, area: 2 },
  { name: 'No-Gi · Masculino · Master · Violeta · -82 kg', ruleset: 'bjj', gender: 'Masculino', ageGroup: 'Master', level: 'Violeta', weightMin: 76, weightMax: 82.3, count: 5, area: 2 },
  { name: 'Grappling · Masculino · Adulto · Absoluto', ruleset: 'sub-only', gender: 'Masculino', ageGroup: 'Adulto', level: null, weightMin: null, weightMax: null, count: 4, area: 2 },
]

const QUEUE_ORDER: Prisma.MatchOrderByWithRelationInput[] = [
  { depth: 'desc' },
  { category: { order: 'asc' } },
  { round: 'asc' },
  { position: 'asc' },
]

async function playJudged(areaId: string, matchId: string, cards: [number, number][]) {
  await tableAction(areaId, { action: 'call', matchId })
  await tableAction(areaId, { action: 'start' })
  const clicks: Prisma.ScoreEventCreateManyInput[] = []
  cards.forEach(([red, blue], i) => {
    for (let n = 0; n < red; n++) clicks.push({ matchId, type: 'JUDGE', corner: 'RED', value: 1, judge: i + 1, round: 1 })
    for (let n = 0; n < blue; n++) clicks.push({ matchId, type: 'JUDGE', corner: 'BLUE', value: 1, judge: i + 1, round: 1 })
  })
  await db.scoreEvent.createMany({ data: clicks })
  const redWins = cards.filter(([red, blue]) => red > blue).length > cards.length / 2
  await tableAction(areaId, { action: 'finish', winner: redWins ? 'RED' : 'BLUE', method: 'Puntos' })
}

async function playScored(
  areaId: string,
  matchId: string,
  events: { type: string; corner: 'RED' | 'BLUE'; value: number }[],
  winner: 'RED' | 'BLUE',
  method: string,
) {
  await tableAction(areaId, { action: 'call', matchId })
  await tableAction(areaId, { action: 'start' })
  for (const event of events) await tableAction(areaId, { action: 'event', ...event })
  await tableAction(areaId, { action: 'finish', winner, method })
}

export async function createDemo(orgId: string) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 7)
  date.setUTCHours(0, 0, 0, 0)

  const tournament = await db.tournament.create({
    data: {
      orgId,
      name: 'Torneo Demo',
      slug: `torneo-demo-${newCode(4).toLowerCase()}`,
      date,
      location: 'Estadio Demo, Buenos Aires',
      areas: {
        create: [
          { name: 'Ring 1', order: 1, judges: 3 },
          { name: 'Tatami 1', order: 2, judges: 3 },
          { name: 'Tatami 2', order: 3, judges: 3 },
        ],
      },
    },
    include: { areas: { orderBy: { order: 'asc' } } },
  })
  await resetMesaCode(tournament.id)

  let person = 0
  const categoryIds: string[] = []
  for (const [index, spec] of SPECS.entries()) {
    const rules = getRuleset(spec.ruleset)
    const category = await db.category.create({
      data: {
        tournamentId: tournament.id,
        name: spec.name,
        ruleset: rules.id,
        gender: spec.gender,
        ageGroup: spec.ageGroup,
        level: spec.level,
        weightMin: spec.weightMin,
        weightMax: spec.weightMax,
        rounds: rules.rounds,
        roundSeconds: rules.roundSeconds,
        restSeconds: rules.restSeconds,
        areaId: tournament.areas[spec.area].id,
        order: index + 1,
      },
    })
    categoryIds.push(category.id)

    for (let i = 0; i < spec.count; i++) {
      const names = spec.gender === 'Femenino' ? WOMEN : MEN
      const base = spec.weightMax ?? 84
      await db.participant.create({
        data: {
          tournamentId: tournament.id,
          firstName: names[person % names.length],
          lastName: SURNAMES[(person * 7 + 3) % SURNAMES.length],
          team: TEAMS[(person + i) % TEAMS.length],
          country: COUNTRIES[person % COUNTRIES.length],
          gender: spec.gender,
          birthYear: spec.ageGroup === 'Juvenil' ? 2010 + (i % 2) : spec.ageGroup === 'Master' ? 1985 + (i % 6) : 1996 + (i % 9),
          level: spec.level,
          weight: Math.round((base - 0.4 - (i % 5) * 0.6) * 10) / 10,
          checkedIn: i % 4 !== 3,
          weighIn: i % 4 !== 3 ? Math.round((base - 0.5 - (i % 5) * 0.6) * 10) / 10 : null,
          entries: { create: { categoryId: category.id, seed: i < 2 && spec.count >= 8 ? i + 1 : null } },
        },
      })
      person += 1
    }
    await generateBracket(category.id)
  }

  for (const area of tournament.areas) {
    const matches = await db.match.findMany({
      where: { category: { areaId: area.id }, status: { in: ['READY', 'PENDING'] } },
      include: { category: { select: { rounds: true, roundSeconds: true, restSeconds: true } } },
      orderBy: QUEUE_ORDER,
    })
    let cursor = date.getTime() + 9 * 3600 * 1000
    for (const m of matches) {
      await db.match.update({ where: { id: m.id }, data: { scheduledAt: new Date(cursor) } })
      const c = m.category
      cursor += (c.rounds * c.roundSeconds + (c.rounds - 1) * c.restSeconds + 120) * 1000
    }
  }

  const ready = (categoryId: string) =>
    db.match.findMany({
      where: { categoryId, status: 'READY' },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
      take: 2,
    })

  const [ring, , tatami] = tournament.areas
  const kick = await ready(categoryIds[0])
  if (kick[0]) await playJudged(ring.id, kick[0].id, [[14, 9], [11, 10], [9, 12]])
  if (kick[1]) await playJudged(ring.id, kick[1].id, [[6, 13], [8, 12], [10, 9]])

  const bjj = await ready(categoryIds[5])
  if (bjj[0]) {
    await playScored(
      tatami.id,
      bjj[0].id,
      [
        { type: 'POINT', corner: 'RED', value: 2 },
        { type: 'POINT', corner: 'RED', value: 3 },
        { type: 'ADV', corner: 'BLUE', value: 1 },
        { type: 'POINT', corner: 'BLUE', value: 2 },
      ],
      'RED',
      'Puntos',
    )
  }
  if (bjj[1]) {
    await playScored(
      tatami.id,
      bjj[1].id,
      [
        { type: 'POINT', corner: 'BLUE', value: 4 },
        { type: 'PEN', corner: 'RED', value: 1 },
      ],
      'BLUE',
      'Finalización',
    )
  }
  await tableAction(ring.id, { action: 'clear' })
  await tableAction(tatami.id, { action: 'clear' })

  return tournament.id
}
