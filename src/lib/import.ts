export type Field =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'lastFirst'
  | 'team'
  | 'discipline'
  | 'category'
  | 'gender'
  | 'birth'
  | 'level'
  | 'weight'
  | 'country'

export type Mapping = (Field | '')[]

export const FIELDS: { id: Field; label: string; aliases: string[] }[] = [
  { id: 'firstName', label: 'Nombre', aliases: ['nombre', 'nombres', 'primer nombre', 'name', 'first name'] },
  { id: 'lastName', label: 'Apellido', aliases: ['apellido', 'apellidos', 'last name', 'surname'] },
  {
    id: 'fullName',
    label: 'Nombre y apellido',
    aliases: [
      'nombre y apellido',
      'nombre y apellidos',
      'nombres y apellidos',
      'nombre apellido',
      'nombre completo',
      'competidor',
      'competidora',
      'competidores',
      'peleador',
      'luchador',
      'atleta',
      'alumno',
      'deportista',
      'participante',
    ],
  },
  {
    id: 'lastFirst',
    label: 'Apellido y nombre',
    aliases: ['apellido y nombre', 'apellido y nombres', 'apellidos y nombres', 'apellidos y nombre', 'apellido nombre'],
  },
  {
    id: 'team',
    label: 'Escuela',
    aliases: [
      'escuela',
      'academia',
      'equipo',
      'team',
      'gimnasio',
      'gym',
      'club',
      'dojo',
      'institucion',
      'representa',
      'escuela academia',
      'escuela o academia',
      'academia o equipo',
      'nombre de la escuela',
      'nombre de la academia',
      'nombre del equipo',
    ],
  },
  { id: 'discipline', label: 'Disciplina', aliases: ['disciplina', 'disciplinas', 'modalidad', 'estilo', 'deporte'] },
  { id: 'category', label: 'Categoría', aliases: ['categoria', 'categorias', 'cat', 'division', 'categoria de peso'] },
  { id: 'gender', label: 'Género', aliases: ['genero', 'sexo', 'rama'] },
  {
    id: 'birth',
    label: 'Año o fecha de nacimiento',
    aliases: ['ano', 'anio', 'ano de nacimiento', 'ano nacimiento', 'nacimiento', 'fecha de nacimiento', 'fecha nacimiento', 'fecha nac'],
  },
  {
    id: 'level',
    label: 'Cinturón o nivel',
    aliases: ['cinturon', 'cinturon o nivel', 'nivel', 'graduacion', 'faja', 'cinto', 'grado', 'experiencia'],
  },
  { id: 'weight', label: 'Peso', aliases: ['peso', 'peso kg', 'peso declarado', 'kg', 'kilos'] },
  { id: 'country', label: 'País', aliases: ['pais', 'nacionalidad', 'country'] },
]

const DETECT_ORDER: Field[] = [
  'lastFirst',
  'fullName',
  'firstName',
  'lastName',
  'team',
  'discipline',
  'category',
  'gender',
  'birth',
  'level',
  'weight',
  'country',
]

const NAME_FIELDS: Field[] = ['firstName', 'lastName', 'fullName', 'lastFirst']

export const MAX_IMPORT_ROWS = 3000
export const MAX_NEW_CATEGORIES = 400

const strip = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export const plainKey = (text: string) =>
  strip(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const compactKey = (text: string) => strip(text).replace(/[^a-z0-9]+/g, '')

export function categoryKey(text: string) {
  return strip(text)
    .replace(/(\d)[.,](\d)/g, '$1D$2')
    .replace(/(\d)(?:-|–|\s+[-–]\s+)(?=\d)/g, '$1R')
    .replace(/(^|\s)-\s*(?=\d)/g, '$1M')
    .replace(/(^|\s)\+\s*(?=\d)/g, '$1P')
    .replace(/([a-z0-9])-(?=[a-z0-9])/g, '$1')
    .replace(/[^a-z0-9DRMP]+/g, ' ')
    .replace(/(\d)\s*(?:kgs?|kilos?)\b/g, '$1kg')
    .replace(/[RM]/g, '-')
    .replace(/P/g, '+')
    .replace(/D/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
}

export function personKey(firstName: string, lastName: string, team: string) {
  const name = plainKey(`${firstName} ${lastName}`).split(' ').filter(Boolean).sort().join(' ')
  return `${name}|${compactKey(team)}`
}

function headerMatch(header: string): { field: Field; score: number } | null {
  if (!header) return null
  let best: { field: Field; score: number } | null = null
  for (const id of DETECT_ORDER) {
    const aliases = FIELDS.find((f) => f.id === id)?.aliases ?? []
    for (const alias of aliases) {
      const score =
        header === alias ? 100 : ` ${header} `.includes(` ${alias} `) ? 10 + alias.split(' ').length : 0
      if (score > (best?.score ?? 0)) best = { field: id, score }
    }
  }
  return best
}

function mapHeaders(cells: string[]): Mapping {
  const candidates = cells
    .map((cell, column) => ({ column, match: headerMatch(plainKey(cell)) }))
    .filter((c) => c.match)
    .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0) || a.column - b.column)
  const mapping: Mapping = cells.map(() => '')
  for (const { column, match } of candidates) {
    if (match && !mapping.includes(match.field)) mapping[column] = match.field
  }
  return mapping
}

export function detectColumns(rows: string[][]): { headerRow: number; mapping: Mapping } {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const pad = (mapping: Mapping) => Array.from({ length: width }, (_, i) => mapping[i] ?? '')
  let found = { headerRow: -1, mapping: [] as Mapping, score: 0 }
  rows.slice(0, 25).forEach((cells, index) => {
    const mapping = mapHeaders(cells)
    const fields = mapping.filter(Boolean)
    if (fields.length < 2 || !fields.some((f) => NAME_FIELDS.includes(f as Field))) return
    if (fields.length > found.score) found = { headerRow: index, mapping, score: fields.length }
  })
  return { headerRow: found.headerRow, mapping: pad(found.mapping) }
}

export type RawRow = {
  line: number
  firstName: string
  lastName: string
  team: string
  discipline: string
  category: string
  gender: string
  birth: string
  level: string
  weight: string
  country: string
}

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'di', 'van', 'von', 'san', 'santa'])

export function splitName(text: string, lastNameFirst: boolean) {
  const comma = text.indexOf(',')
  if (comma > 0) {
    return { firstName: text.slice(comma + 1).trim(), lastName: text.slice(0, comma).trim() }
  }
  const words = text.split(' ').filter(Boolean)
  if (words.length < 2) return { firstName: text.trim(), lastName: '' }
  if (lastNameFirst) {
    let end = 1
    while (end < words.length - 1 && PARTICLES.has(words[end - 1].toLowerCase())) end += 1
    return { firstName: words.slice(end).join(' '), lastName: words.slice(0, end).join(' ') }
  }
  let start = words.length - 1
  while (start > 1 && PARTICLES.has(words[start - 1].toLowerCase())) start -= 1
  return { firstName: words.slice(0, start).join(' '), lastName: words.slice(start).join(' ') }
}

export function extractRows(rows: string[][], headerRow: number, mapping: Mapping): RawRow[] {
  const column = (field: Field) => mapping.indexOf(field)
  const split = column('firstName') < 0 || column('lastName') < 0
  const out: RawRow[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const cells = rows[i] ?? []
    const get = (field: Field) => {
      const index = column(field)
      return index >= 0 ? (cells[index] ?? '') : ''
    }
    const values = {
      firstName: get('firstName'),
      lastName: get('lastName'),
      team: get('team'),
      discipline: get('discipline'),
      category: get('category'),
      gender: get('gender'),
      birth: get('birth'),
      level: get('level'),
      weight: get('weight'),
      country: get('country'),
    }
    const joined = get('fullName') || get('lastFirst')
    if (joined || split) {
      const lastNameFirst = !get('fullName') && Boolean(get('lastFirst'))
      Object.assign(values, splitName(joined || values.firstName || values.lastName, lastNameFirst))
    }
    if (Object.values(values).some(Boolean)) out.push({ line: i + 1, ...values })
  }
  return out
}

export function sanitizeRows(input: unknown): RawRow[] | null {
  if (!Array.isArray(input)) return null
  const text = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 200) : '')
  return input.map((item, index) => {
    const source = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      line: Number.isInteger(source.line) ? (source.line as number) : index + 1,
      firstName: text(source.firstName),
      lastName: text(source.lastName),
      team: text(source.team),
      discipline: text(source.discipline),
      category: text(source.category),
      gender: text(source.gender),
      birth: text(source.birth),
      level: text(source.level),
      weight: text(source.weight),
      country: text(source.country),
    }
  })
}

const DISCIPLINES: [string, RegExp][] = [
  ['point-fighting', /\b(point ?fighting|point ?fight|points?|pf|semi ?contact|semi ?contacto)\b/],
  ['kick-light', /\b(light ?contact|kick ?light|light|lc|kl)\b/],
  ['sub-only', /\b(sub ?only|submission ?only|solo finalizacion|solo sumision)\b/],
  ['bjj', /\b(bjj|jiu ?jitsu|jiujitsu|ju ?jitsu|jujitsu|gi|no ?gi|nogi)\b/],
  ['kick-ring', /\b(k ?1|full ?contact|low ?kick|kick ?boxing|kick)\b/],
]

export function guessRuleset(discipline: string) {
  const text = plainKey(discipline)
  return DISCIPLINES.find(([, pattern]) => pattern.test(text))?.[0] ?? ''
}

export function categoryName(discipline: string, category: string) {
  if (!discipline) return category
  return compactKey(category).includes(compactKey(discipline)) ? category : `${discipline} · ${category}`
}

const KG = '(\\d{2,3}(?:[.,]\\d{1,2})?)'
const UNIT = '\\s*(?:kgs?|kilos?)\\b'
const RANGE = new RegExp(`${KG}(?:-|–|\\s+[-–a]\\s+)${KG}${UNIT}`)
const UP_TO = new RegExp(`(?:(?:^|\\s)-\\s*|\\bhasta\\s+)${KG}${UNIT}`)
const OVER = new RegExp(`(?:(?:^|\\s)\\+\\s*|\\bmas de\\s+)${KG}${UNIT}`)

export function categoryTraits(name: string) {
  const text = strip(name)
  const kg = (raw: string) => {
    const n = Number(raw.replace(',', '.'))
    return n >= 10 && n <= 250 ? n : null
  }
  const gender = /\b(masculino|masc|varones|hombres|caballeros)\b/.test(text)
    ? 'Masculino'
    : /\b(femenino|fem|mujeres|damas)\b/.test(text)
      ? 'Femenino'
      : /\bmixto\b/.test(text)
        ? 'Mixto'
        : null
  let weightMin: number | null = null
  let weightMax: number | null = null
  const range = RANGE.exec(text)
  if (range) {
    const [min, max] = [kg(range[1]), kg(range[2])]
    if (min != null && max != null && min < max) [weightMin, weightMax] = [min, max]
  } else {
    const upTo = UP_TO.exec(text)
    const over = OVER.exec(text)
    if (upTo) weightMax = kg(upTo[1])
    else if (over) weightMin = kg(over[1])
  }
  return { gender, weightMin, weightMax }
}

function parseGender(raw: string, mIsMujer: boolean) {
  const text = plainKey(raw)
  if (/^(f|fem|femenino|femenina|mujer|mujeres|dama|damas)$/.test(text)) return 'Femenino'
  if (/^(masc|masculino|masculina|h|hombre|hombres|v|varon|varones|caballero|caballeros)$/.test(text)) return 'Masculino'
  if (text === 'm') return mIsMujer ? 'Femenino' : 'Masculino'
  return null
}

export function parseBirthYear(raw: string) {
  const explicit = /(?:^|\D)(19\d{2}|20\d{2})(?:\D|$)/.exec(raw)
  if (explicit) return Number(explicit[1])
  const serial = Number(raw.replace(',', '.'))
  if (Number.isFinite(serial) && serial > 3000 && serial < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000).getUTCFullYear()
  }
  return null
}

function parseWeight(raw: string) {
  const n = parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) && n >= 10 && n <= 250 ? Math.round(n * 100) / 100 : null
}

export type Existing = {
  categories: { id: string; name: string; ruleset: string; hasBracket: boolean }[]
  people: { id: string; firstName: string; lastName: string; team: string | null; categoryIds: string[] }[]
}

export type PlanDiscipline = { key: string; label: string; rows: number; ruleset: string; needed: boolean }

export type PlanCategory = {
  key: string
  name: string
  ruleset: string
  existingId: string | null
  hasBracket: boolean
  rows: number
  added: number
  gender: string | null
  weightMin: number | null
  weightMax: number | null
}

export type PlanPerson = {
  key: string
  existingId: string | null
  firstName: string
  lastName: string
  team: string | null
  gender: string | null
  birthYear: number | null
  level: string | null
  weight: number | null
  country: string
  categoryKeys: string[]
}

export type Plan = {
  disciplines: PlanDiscipline[]
  categories: PlanCategory[]
  people: PlanPerson[]
  teams: { name: string; people: number }[]
  issues: { line: number; text: string }[]
  blockers: string[]
  stats: {
    rows: number
    newPeople: number
    knownPeople: number
    newCategories: number
    entries: number
    alreadyEntered: number
    withoutCategory: number
  }
}

export type ImportState = { error: string } | null

const cut = (text: string, max: number) => text.trim().slice(0, max).trim()

export function buildPlan(rows: RawRow[], choices: Record<string, string>, existing: Existing): Plan {
  const detailed = rows.some((r) => r.team || r.discipline || r.category)
  const mIsMujer = rows.some((r) => /^(h|hombre|hombres|v|varon|varones)$/.test(plainKey(r.gender)))
  const existingCategories = new Map(existing.categories.map((c) => [categoryKey(c.name), c]))
  const existingPeople = new Map(
    existing.people.map((p) => [personKey(p.firstName, p.lastName, p.team ?? ''), p]),
  )
  const teamNames = new Map<string, string>()
  for (const p of existing.people) {
    if (p.team && !teamNames.has(compactKey(p.team))) teamNames.set(compactKey(p.team), p.team)
  }

  const disciplines = new Map<string, PlanDiscipline>()
  const categories = new Map<string, PlanCategory>()
  const people = new Map<string, PlanPerson>()
  const entered = new Map<string, Set<string>>()
  const seen = new Map<string, number>()
  const firstLine = new Map<string, number>()
  const issues: Plan['issues'] = []
  const stats = { rows: rows.length, newPeople: 0, knownPeople: 0, newCategories: 0, entries: 0, alreadyEntered: 0, withoutCategory: 0 }

  for (const row of rows.slice(0, MAX_IMPORT_ROWS)) {
    const firstName = cut(row.firstName, 60)
    const lastName = cut(row.lastName, 60)
    if (!firstName && !lastName) {
      issues.push({ line: row.line, text: 'Falta el nombre: no se carga.' })
      continue
    }
    if (detailed && !row.team && !row.discipline && !row.category) {
      issues.push({ line: row.line, text: 'Solo tiene el nombre, sin escuela, disciplina ni categoría: no se carga.' })
      continue
    }
    const rawTeam = cut(row.team, 80)
    if (rawTeam && !teamNames.has(compactKey(rawTeam))) teamNames.set(compactKey(rawTeam), rawTeam)
    const team = rawTeam ? (teamNames.get(compactKey(rawTeam)) ?? rawTeam) : null

    const key = personKey(firstName, lastName, team ?? '')
    let person = people.get(key)
    if (!person) {
      const known = existingPeople.get(key)
      person = {
        key,
        existingId: known?.id ?? null,
        firstName,
        lastName,
        team,
        gender: null,
        birthYear: null,
        level: null,
        weight: null,
        country: '',
        categoryKeys: [],
      }
      people.set(key, person)
      firstLine.set(key, row.line)
      entered.set(key, new Set(known?.categoryIds ?? []))
      if (known) stats.knownPeople += 1
      else stats.newPeople += 1
    }
    person.gender ??= parseGender(row.gender, mIsMujer)
    person.birthYear ??= parseBirthYear(row.birth)
    person.level ??= cut(row.level, 40) || null
    person.weight ??= parseWeight(row.weight)
    person.country ||= cut(row.country, 40)

    const categoryText = cut(row.category, 100)
    if (!categoryText) continue

    const disciplineKey = compactKey(row.discipline)
    let discipline = disciplines.get(disciplineKey)
    if (!discipline) {
      const label = cut(row.discipline, 40)
      discipline = {
        key: disciplineKey,
        label,
        rows: 0,
        ruleset: choices[disciplineKey] || guessRuleset(label),
        needed: false,
      }
      disciplines.set(disciplineKey, discipline)
    }
    discipline.rows += 1

    const name = categoryName(discipline.label, categoryText)
    const categoryId = categoryKey(name)
    let category = categories.get(categoryId)
    if (!category) {
      const known = existingCategories.get(categoryId)
      category = {
        key: categoryId,
        name: known?.name ?? name,
        ruleset: known?.ruleset ?? discipline.ruleset,
        existingId: known?.id ?? null,
        hasBracket: known?.hasBracket ?? false,
        rows: 0,
        added: 0,
        ...categoryTraits(name),
      }
      categories.set(categoryId, category)
      if (!known) stats.newCategories += 1
    }
    if (!category.existingId) discipline.needed = true

    const pair = `${key}\n${categoryId}`
    const previous = seen.get(pair)
    if (previous != null) {
      issues.push({ line: row.line, text: `Repetida: mismo competidor y categoría que la fila ${previous}.` })
      continue
    }
    seen.set(pair, row.line)
    person.categoryKeys.push(categoryId)
    category.rows += 1
    if (category.existingId && entered.get(key)?.has(category.existingId)) stats.alreadyEntered += 1
    else {
      category.added += 1
      stats.entries += 1
    }
  }

  const list = [...people.values()]
  for (const p of list) {
    if (p.existingId || p.categoryKeys.length > 0) continue
    stats.withoutCategory += 1
    issues.push({ line: firstLine.get(p.key) ?? 0, text: 'No tiene categoría: se carga sin inscribir.' })
  }
  issues.sort((a, b) => a.line - b.line)

  const teamCount = new Map<string, number>()
  for (const p of list) if (p.team) teamCount.set(p.team, (teamCount.get(p.team) ?? 0) + 1)

  const blockers: string[] = []
  if (rows.length > MAX_IMPORT_ROWS) {
    blockers.push(`La planilla tiene ${rows.length} filas con datos y el máximo es ${MAX_IMPORT_ROWS}. Partila en varias.`)
  }
  if (rows.length === 0) blockers.push('Esa hoja no tiene filas con datos.')
  else if (list.length === 0) blockers.push('No encontré ningún competidor. Revisá qué columna tiene el nombre.')
  const pending = [...disciplines.values()].filter((d) => d.needed && !d.ruleset)
  if (pending.length > 0) {
    blockers.push(`Falta elegir la modalidad de: ${pending.map((d) => d.label || 'las filas sin disciplina').join(', ')}.`)
  }
  if (stats.newCategories > MAX_NEW_CATEGORIES) {
    blockers.push(
      `Se crearían ${stats.newCategories} categorías y el máximo es ${MAX_NEW_CATEGORIES}. Revisá que la columna de categoría sea la correcta.`,
    )
  }

  return {
    disciplines: [...disciplines.values()],
    categories: [...categories.values()],
    people: list,
    teams: [...teamCount].map(([name, count]) => ({ name, people: count })).sort((a, b) => b.people - a.people),
    issues,
    blockers,
    stats,
  }
}
