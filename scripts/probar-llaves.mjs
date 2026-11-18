const { bracketSize, checkLeaves, defaultLeaves, disciplineOf, mergedName, mergeProblem, pickFormat } = await import(
  '../src/lib/bracket-core.ts'
)

let failed = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${name}${ok ? '' : `: dio ${JSON.stringify(got)}, se esperaba ${JSON.stringify(want)}`}`)
}

check('automático: 3 inscriptos, todos contra todos', pickFormat(3, 'AUTO', 'AUTO', 3), 'ROUND_ROBIN')
check('automático: 4 inscriptos, eliminación', pickFormat(4, 'AUTO', 'AUTO', 3), 'SINGLE')
check('automático con tope 4: 4 inscriptos, todos contra todos', pickFormat(4, 'AUTO', 'AUTO', 4), 'ROUND_ROBIN')
check('torneo siempre eliminación: 2 inscriptos', pickFormat(2, 'AUTO', 'SINGLE', 3), 'SINGLE')
check('torneo siempre todos contra todos: 6 inscriptos', pickFormat(6, 'AUTO', 'ROUND_ROBIN', 3), 'ROUND_ROBIN')
check('todos contra todos con 9 pasa a eliminación', pickFormat(9, 'AUTO', 'ROUND_ROBIN', 3), 'SINGLE')
check('la categoría manda sobre el torneo', pickFormat(3, 'SINGLE', 'ROUND_ROBIN', 3), 'SINGLE')
check('la categoría pide todos contra todos', pickFormat(5, 'ROUND_ROBIN', 'SINGLE', 3), 'ROUND_ROBIN')
check('un solo inscripto: sin llave', pickFormat(1, 'AUTO', 'AUTO', 3), null)

check('tamaño para 2, 3, 5, 8 y 9', [2, 3, 5, 8, 9].map(bracketSize), [2, 4, 8, 8, 16])
check('lugares por defecto con 5', defaultLeaves(['a', 'b', 'c', 'd', 'e']), ['a', 'e', 'b', null, 'c', null, 'd', null])
check('lugares por defecto: válidos', checkLeaves(defaultLeaves(['a', 'b', 'c', 'd', 'e']), ['a', 'b', 'c', 'd', 'e']), null)

const ids = ['a', 'b', 'c', 'd']
check('a mano: válida', checkLeaves(['a', 'b', 'c', 'd'], ids), null)
check('a mano: con pase libre', checkLeaves(['a', null, 'c', 'd'], ids), null)
check('a mano: repetido', checkLeaves(['a', 'a', 'c', 'd'], ids), 'Pusiste al mismo competidor en dos lugares.')
check('a mano: ajeno', checkLeaves(['a', 'x', 'c', 'd'], ids), 'Hay un competidor que no es de esta categoría.')
check('a mano: uno solo', checkLeaves(['a', null], ids), 'Hacen falta al menos dos competidores en la llave.')
check('a mano: pelea vacía', Boolean(checkLeaves(['a', 'b', null, null], ids)?.startsWith('La pelea 2')), true)
check('a mano: tamaño raro', checkLeaves(['a', 'b', 'c'], ids), 'La llave no tiene un tamaño válido.')

const cat = (id, name, ruleset = 'kick-light') => ({ id, name, ruleset, tournamentId: 't' })
check('disciplina del nombre', disciplineOf('Kick Light · Adulto -69 kg'), 'kick light')
check('fusión: misma disciplina', mergeProblem(cat('1', 'Kick Light · A'), cat('2', 'Kick Light · B')), null)
check(
  'fusión: Kick Light con Light Contact, no',
  mergeProblem(cat('1', 'Kick Light · A'), cat('2', 'Light Contact · A')),
  'Solo se pueden fusionar categorías de la misma disciplina.',
)
check(
  'fusión: otra modalidad, no',
  mergeProblem(cat('1', 'A'), cat('2', 'B', 'bjj')),
  'Solo se pueden fusionar categorías de la misma disciplina.',
)
check('fusión: la misma, no', mergeProblem(cat('1', 'A'), cat('1', 'A')), 'Elegí dos categorías distintas.')
check('fusión: sin disciplina en el nombre', mergeProblem(cat('1', 'Adulto -69'), cat('2', 'Adulto -74')), null)
check(
  'nombre fusionado',
  mergedName('Kick Light · Adulto Masculino -84 kg', 'Kick Light · Adulto Masculino +84 kg'),
  'Kick Light · Adulto Masculino -84 kg + Adulto Masculino +84 kg',
)

console.log(failed ? `\n${failed} FALLARON` : '\nTodo bien')
process.exit(failed ? 1 : 0)
