export const FORMATS = ['AUTO', 'SINGLE', 'ROUND_ROBIN']
export const ROUND_ROBIN_LIMIT = 8

export type BracketFormat = 'SINGLE' | 'ROUND_ROBIN'

export function pickFormat(
  n: number,
  categoryFormat: string,
  tournamentFormat: string,
  roundRobinMax: number,
): BracketFormat | null {
  if (n < 2) return null
  const choice = categoryFormat !== 'AUTO' ? categoryFormat : tournamentFormat
  if (choice === 'SINGLE') return 'SINGLE'
  if (choice === 'ROUND_ROBIN') return n > ROUND_ROBIN_LIMIT ? 'SINGLE' : 'ROUND_ROBIN'
  return n <= Math.min(roundRobinMax, ROUND_ROBIN_LIMIT) ? 'ROUND_ROBIN' : 'SINGLE'
}

export const bracketSize = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)))

export function defaultLeaves(entryIds: string[]): (string | null)[] {
  const size = bracketSize(entryIds.length)
  const order = [
    ...Array.from({ length: size / 2 }, (_, i) => i * 2),
    ...Array.from({ length: size / 2 }, (_, i) => i * 2 + 1),
  ]
  const leaves: (string | null)[] = Array.from({ length: size }, () => null)
  entryIds.forEach((id, i) => {
    leaves[order[i]] = id
  })
  return leaves
}

export function checkLeaves(leaves: (string | null)[], entryIds: string[]): string | null {
  const size = leaves.length
  if (size < 2 || size > 128 || 2 ** Math.round(Math.log2(size)) !== size) return 'La llave no tiene un tamaño válido.'
  const valid = new Set(entryIds)
  const placed = leaves.filter((id): id is string => Boolean(id))
  if (placed.some((id) => !valid.has(id))) return 'Hay un competidor que no es de esta categoría.'
  if (new Set(placed).size !== placed.length) return 'Pusiste al mismo competidor en dos lugares.'
  if (placed.length < 2) return 'Hacen falta al menos dos competidores en la llave.'
  for (let pair = 0; pair < size / 2; pair++) {
    if (!leaves[pair * 2] && !leaves[pair * 2 + 1]) {
      return `La pelea ${pair + 1} de la primera ronda quedó vacía: poné al menos un competidor (uno solo es pase libre).`
    }
  }
  return null
}

export const disciplineOf = (name: string) =>
  name.includes(' · ') ? name.split(' · ')[0].trim().toLowerCase() : ''

type Mergeable = { id: string; name: string; ruleset: string; tournamentId: string }

export function mergeProblem(target: Mergeable, source: Mergeable): string | null {
  if (target.id === source.id) return 'Elegí dos categorías distintas.'
  if (target.tournamentId !== source.tournamentId) return 'Las dos categorías tienen que ser del mismo torneo.'
  if (target.ruleset !== source.ruleset || disciplineOf(target.name) !== disciplineOf(source.name)) {
    return 'Solo se pueden fusionar categorías de la misma disciplina.'
  }
  return null
}

export function mergedName(target: string, source: string) {
  const prefix = target.includes(' · ') ? target.split(' · ')[0] : ''
  const rest = (name: string) => (prefix && name.startsWith(`${prefix} · `) ? name.slice(prefix.length + 3) : name)
  const joined = `${rest(target)} + ${rest(source)}`
  return (prefix ? `${prefix} · ${joined}` : joined).slice(0, 120)
}
