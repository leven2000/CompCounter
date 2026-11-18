import { db } from './db'
import type { Existing } from './import'

export async function loadExisting(tournamentId: string): Promise<Existing> {
  const [categories, people] = await Promise.all([
    db.category.findMany({
      where: { tournamentId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, ruleset: true, _count: { select: { matches: true } } },
    }),
    db.participant.findMany({
      where: { tournamentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        team: true,
        entries: { select: { categoryId: true } },
      },
    }),
  ])
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      ruleset: c.ruleset,
      hasBracket: c._count.matches > 0,
    })),
    people: people.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      team: p.team,
      categoryIds: p.entries.map((e) => e.categoryId),
    })),
  }
}
