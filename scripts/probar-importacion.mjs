import { readFileSync } from 'node:fs'

const { readTable, SheetError } = await import('../src/lib/sheet.ts')
const {
  buildPlan,
  categoryKey,
  categoryName,
  categoryTraits,
  detectColumns,
  extractRows,
  guessRuleset,
  parseBirthYear,
  personKey,
  sanitizeRows,
  splitName,
} = await import('../src/lib/import.ts')
const { RULESETS } = await import('../src/lib/rules.ts')

let failed = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${name}${ok ? '' : `: dio ${JSON.stringify(got)}, se esperaba ${JSON.stringify(want)}`}`)
}
const file = (path) => new Uint8Array(readFileSync(new URL(path, import.meta.url)))
const none = { categories: [], people: [] }
const read = (rows) => {
  const { headerRow, mapping } = detectColumns(rows)
  return extractRows(rows, headerRow, mapping)
}

const template = readTable('plantilla.xlsx', file('../public/plantilla-competidores.xlsx'))
check('plantilla: dos hojas', template.map((s) => s.name), ['Competidores', 'Ejemplo'])
let detected = detectColumns(template[0].rows)
check('plantilla: se reconocen todas las columnas', detected, {
  headerRow: 0,
  mapping: ['firstName', 'lastName', 'team', 'discipline', 'category', 'gender', 'birth', 'level', 'weight', 'country'],
})
detected = detectColumns(template[1].rows)
check('plantilla, hoja Ejemplo: los títulos están debajo de las notas', detected.headerRow, 4)
let plan = buildPlan(extractRows(template[1].rows, detected.headerRow, detected.mapping), {}, none)
check('plantilla, hoja Ejemplo: 3 personas, 4 categorías, 4 inscripciones', [plan.stats.newPeople, plan.stats.newCategories, plan.stats.entries], [3, 4, 4])
check('plantilla, hoja Ejemplo: sin bloqueos ni avisos', [plan.blockers, plan.issues], [[], []])

const excel = readTable('inscriptos.xlsx', file('./fixtures/inscriptos-excel.xlsx'))
check('Excel real: ignora la hoja oculta', excel.map((s) => s.name), ['Inscriptos', 'Otra hoja'])
const sheet = excel[0].rows
check('Excel real: título combinado en la fila 1', sheet[0], ['TORNEO APERTURA – LISTA DE INSCRIPTOS'])
check('Excel real: no arrastra las filas con formato y sin datos', sheet.length, 14)
detected = detectColumns(sheet)
check('Excel real: encuentra los títulos en la fila 3', detected, {
  headerRow: 2,
  mapping: ['', 'lastFirst', '', 'birth', 'weight', 'discipline', 'category', 'team'],
})
check('Excel real: fecha como número de serie y decimales limpios', sheet[3].slice(3, 5), ['38423', '58.4'])
check('Excel real: texto con formato parcial', sheet[6][1], 'Pérez Ana')
check('Excel real: fórmula con su resultado', sheet[8][1], 'Ruiz Tomás')
check('Excel real: salto de línea dentro de la celda', sheet[9][1], 'Sosa Mía Belén')
check('Excel real: caracteres especiales y espacios de más', [sheet[5][7], sheet[6][7]], ['Team A&B <Sur>', 'Escuela del Sol'])
check('Excel real: categoría escrita como número', sheet[11][6], '81')

const rows = extractRows(sheet, detected.headerRow, detected.mapping)
check('Excel real: 9 competidores y una fila de total', rows.length, 10)
check('Excel real: apellido con coma', [rows[0].firstName, rows[0].lastName], ['Lucía', 'GÓMEZ'])
check('Excel real: apellido compuesto adelante', [rows[1].firstName, rows[1].lastName], ['Martín', 'de la Fuente'])

plan = buildPlan(rows, {}, none)
check('modalidades: K-1 y k1 son la misma; Grappling queda sin adivinar', plan.disciplines.map((d) => [d.label, d.rows, d.ruleset]), [
  ['K-1', 4, 'kick-ring'],
  ['Kick Light', 1, 'kick-light'],
  ['Jiu-Jitsu', 1, 'bjj'],
  ['BJJ', 1, 'bjj'],
  ['Grappling', 1, ''],
  ['Full Contact', 1, 'kick-ring'],
])
check('bloquea hasta elegir la modalidad que no se reconoce', plan.blockers, ['Falta elegir la modalidad de: Grappling.'])
plan = buildPlan(rows, { grappling: 'sub-only' }, none)
check('con la modalidad elegida ya no hay bloqueos', plan.blockers, [])
check('categorías: nombre con la disciplina adelante', plan.categories.map((c) => [c.name, c.ruleset, c.rows]), [
  ['K-1 · Adulto -60kg Femenino', 'kick-ring', 1],
  ['K-1 · Adulto -70 kg Masculino', 'kick-ring', 1],
  ['Kick Light · Adulto - 70 Kg Masculino', 'kick-light', 1],
  ['Jiu-Jitsu · Azul -64 kg', 'bjj', 1],
  ['BJJ · Azul -64 kg', 'bjj', 1],
  ['Grappling · Absoluto', 'sub-only', 1],
  ['K-1 · Juvenil -55kg', 'kick-ring', 1],
  ['Full Contact · 81', 'kick-ring', 1],
])
check('categorías: toma género y peso del nombre', plan.categories.slice(0, 3).map((c) => [c.gender, c.weightMin, c.weightMax]), [
  ['Femenino', null, 60],
  ['Masculino', null, 70],
  ['Masculino', null, 70],
])
check('personas: Ana Pérez es una sola con dos categorías', plan.people.find((p) => p.lastName === 'Pérez')?.categoryKeys.length, 2)
check('personas: totales', plan.stats, {
  rows: 10,
  newPeople: 7,
  knownPeople: 0,
  newCategories: 8,
  entries: 8,
  alreadyEntered: 0,
  withoutCategory: 0,
})
check('escuelas: unifica mayúsculas, acentos y espacios', plan.teams, [
  { name: 'Dragón Gym', people: 3 },
  { name: 'Escuela del Sol', people: 2 },
  { name: 'Team A&B <Sur>', people: 1 },
  { name: 'Lobos', people: 1 },
])
check('avisos: fila repetida y fila de totales que no es un competidor', plan.issues, [
  { line: 11, text: 'Repetida: mismo competidor y categoría que la fila 4.' },
  { line: 14, text: 'Solo tiene el nombre, sin escuela, disciplina ni categoría: no se carga.' },
])
check('nacimiento: año desde la fecha de Excel', plan.people[0].birthYear, 2005)
check('peso declarado', plan.people[0].weight, 58.4)

const existing = {
  categories: [
    { id: 'c1', name: 'K-1 · Adulto -60 kg Femenino', ruleset: 'kick-ring', hasBracket: true },
    { id: 'c2', name: 'Grappling · Absoluto', ruleset: 'bjj', hasBracket: false },
  ],
  people: [{ id: 'p1', firstName: 'Lucía', lastName: 'Gómez', team: 'DRAGON GYM', categoryIds: ['c1'] }],
}
plan = buildPlan(rows, {}, existing)
check('reimportar: reconoce a la persona y su inscripción', [plan.stats.knownPeople, plan.stats.newPeople, plan.stats.alreadyEntered, plan.stats.entries], [1, 6, 1, 7])
check('reimportar: usa la categoría que ya existe, con su modalidad y su llave', plan.categories.filter((c) => c.existingId).map((c) => [c.existingId, c.name, c.ruleset, c.hasBracket, c.added]), [
  ['c1', 'K-1 · Adulto -60 kg Femenino', 'kick-ring', true, 0],
  ['c2', 'Grappling · Absoluto', 'bjj', false, 1],
])
check('reimportar: no pide la modalidad si la categoría ya existe', plan.blockers, [])
check('reimportar: conserva cómo estaba escrita la escuela', plan.teams[0], { name: 'DRAGON GYM', people: 3 })

const csv = new TextEncoder().encode('sep=;\r\nNombre;Apellido;Escuela;Disciplina;Categoría\r\n"Paz; Sofía";Ríos;"Team ""Norte""";K-1;-60 kg\r\n')
check('CSV: separador declarado, comillas y punto y coma dentro del texto', readTable('lista.csv', csv)[0].rows[1], ['Paz; Sofía', 'Ríos', 'Team "Norte"', 'K-1', '-60 kg'])
const latin = Uint8Array.from([...'Nombre,Categor', 0xed, ...'a\nJos', 0xe9, ...' Nu', 0xf1, ...'ez,Adulto\n'].map((c) => (typeof c === 'number' ? c : c.charCodeAt(0))))
check('CSV de Excel en Windows-1252: acentos bien', readTable('lista.csv', latin)[0].rows, [['Nombre', 'Categoría'], ['José Nuñez', 'Adulto']])
check('CSV con tabuladores', readTable('lista.txt', new TextEncoder().encode('Competidor\tGimnasio\nAna Paz\tLobos\n'))[0].rows, [['Competidor', 'Gimnasio'], ['Ana Paz', 'Lobos']])

const fails = (bytes) => {
  try {
    readTable('x', bytes)
    return 'no falló'
  } catch (error) {
    return error instanceof SheetError ? 'SheetError' : String(error)
  }
}
check('.xls viejo: error claro', fails(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])), 'SheetError')
check('zip roto: error claro', fails(Uint8Array.from([0x50, 0x4b, 3, 4, 1, 2, 3])), 'SheetError')
check('archivo vacío: error claro', fails(new Uint8Array()), 'SheetError')

check('títulos: columnas con otros nombres', detectColumns([['N°', 'Competidor', 'Gimnasio', 'Estilo', 'División', 'Sexo', 'Graduación']]).mapping, ['', 'fullName', 'team', 'discipline', 'category', 'gender', 'level'])
check('títulos: sin títulos reconocibles', detectColumns([['Ana Paz', 'Lobos', 'K-1']]).headerRow, -1)
check('nombre solo en una columna "Nombre": se separa', read([['Nombre', 'Escuela'], ['María del Carmen López', 'Lobos']])[0], {
  line: 2,
  firstName: 'María del Carmen',
  lastName: 'López',
  team: 'Lobos',
  discipline: '',
  category: '',
  gender: '',
  birth: '',
  level: '',
  weight: '',
  country: '',
})
check('nombre y apellido en columnas separadas: no se tocan', read([['Nombre', 'Apellido'], ['Juan Cruz', 'De Luca']]).map((r) => [r.firstName, r.lastName]), [['Juan Cruz', 'De Luca']])
check('nombre con apellido compuesto al final', splitName('Juan de la Fuente', false), { firstName: 'Juan', lastName: 'de la Fuente' })
check('una sola palabra', splitName('Ronaldinho', false), { firstName: 'Ronaldinho', lastName: '' })

check('categoría: espacios, mayúsculas y kg', categoryKey('Juvenil  - 60 Kg'), categoryKey('juvenil -60kg'))
check('categoría: K-1 y K1', categoryKey('K-1 Adulto -70 kg'), categoryKey('K1 adulto -70kg'))
check('categoría: -70 y +70 son distintas', categoryKey('Adulto -70 kg') === categoryKey('Adulto +70 kg'), false)
check('categoría: rango con y sin espacios', categoryKey('60 - 65 kg'), categoryKey('60-65kg'))
check('categoría: decimal con coma o punto', categoryKey('-62,5 kg'), categoryKey('-62.5kg'))
check('categoría: K-1 -70 no es un rango', categoryKey('K-1 -70'), 'k1 -70')
check('categoría: no repite la disciplina si ya está', categoryName('K-1', 'K1 Adulto -70'), 'K1 Adulto -70')
check('peso: rango', categoryTraits('Adulto 60 a 65 kg'), { gender: null, weightMin: 60, weightMax: 65 })
check('peso: más de', categoryTraits('Damas +70kg'), { gender: 'Femenino', weightMin: 70, weightMax: null })
check('peso: sin "kg" no se adivina', categoryTraits('Juvenil -18'), { gender: null, weightMin: null, weightMax: null })

check('persona: mismo nombre en otro orden y otra escritura', personKey('JUAN', 'PEREZ', 'Dragón Gym'), personKey('Pérez', 'Juan', 'dragon  gym'))
check('persona: otra escuela es otra persona', personKey('Juan', 'Pérez', 'Lobos') === personKey('Juan', 'Pérez', 'Tigres'), false)
check('nacimiento: fecha escrita', parseBirthYear('12/03/2005'), 2005)
check('nacimiento: una edad no es un año', parseBirthYear('23'), null)

const ids = new Set(RULESETS.map((r) => r.id))
check('modalidades: todas las adivinadas existen', ['K-1', 'Kickboxing', 'Light Contact', 'Point Fighting', 'BJJ', 'No-Gi', 'Sub only'].map(guessRuleset).every((id) => ids.has(id)), true)
check('modalidades: las que no se reconocen quedan vacías', ['Grappling', 'MMA', 'Boxeo', 'Karate', ''].map(guessRuleset), ['', '', '', '', ''])
check('modalidades: Kick Light no cae en kickboxing ring', guessRuleset('Kick Light'), 'kick-light')

const namesOnly = buildPlan(sanitizeRows([{ firstName: 'Ana', lastName: 'Paz' }, { firstName: 'Luis', lastName: 'Rey' }]), {}, none)
check('planilla solo con nombres: se cargan igual', [namesOnly.stats.newPeople, namesOnly.stats.withoutCategory, namesOnly.issues.length], [2, 2, 2])
const noCategory = buildPlan(sanitizeRows([{ firstName: 'Ana', team: 'Lobos' }, { firstName: 'Luis', team: 'Lobos', category: 'A', discipline: 'K-1' }]), {}, none)
check('con escuela y sin categoría: se carga sin inscribir', noCategory.issues, [{ line: 1, text: 'No tiene categoría: se carga sin inscribir.' }])

const hm = buildPlan(sanitizeRows([{ firstName: 'Ana', gender: 'M' }, { firstName: 'Luis', gender: 'H' }]), {}, none)
check('género: con H para hombre, la M es mujer', hm.people.map((p) => p.gender), ['Femenino', 'Masculino'])
const mf = buildPlan(sanitizeRows([{ firstName: 'Ana', gender: 'F' }, { firstName: 'Luis', gender: 'M' }]), {}, none)
check('género: con F, la M es masculino', mf.people.map((p) => p.gender), ['Femenino', 'Masculino'])

check('datos del navegador: basura no rompe', sanitizeRows([null, 7, { firstName: 5, category: '  A   B  ' }]).map((r) => [r.line, r.firstName, r.category]), [[1, '', ''], [2, '', ''], [3, '', 'A B']])
check('datos del navegador: si no es una lista, se rechaza', sanitizeRows('x'), null)
const many = Array.from({ length: 3001 }, (_, i) => ({ firstName: `P${i}` }))
check('tope de filas', buildPlan(sanitizeRows(many), {}, none).blockers.length, 1)
check('sin nombres no hay nada que importar', buildPlan(sanitizeRows([{ category: 'A' }]), {}, none).blockers, ['No encontré ningún competidor. Revisá qué columna tiene el nombre.'])

if (failed) {
  console.error(`\n${failed} pruebas fallaron`)
  process.exit(1)
}
console.log('\nTodas las pruebas de importación pasaron')
