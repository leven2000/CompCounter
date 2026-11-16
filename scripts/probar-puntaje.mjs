const { computeScore, dqLimit, getRuleset, readSanctions, sanctionsSummary, scoreOptions } = await import(
  '../src/lib/rules.ts'
)

let failed = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${name}${ok ? '' : `: dio ${JSON.stringify(got)}, se esperaba ${JSON.stringify(want)}`}`)
}

const ev = (type, corner, value = 1, judge = null, round = 1) => ({ type, corner, value, judge, round })
const times = (n, make) => Array.from({ length: n }, make)
const base = { autoLadder: true, dqAt: null, minusMode: null, minusValue: null }
const cards = (result) => result.judges.map((j) => [j.red, j.blue])

const kick = getRuleset('kick-ring')
const clicks = [1, 2, 3].flatMap((seat) => [ev('JUDGE', 'RED', 5, seat), ev('JUDGE', 'BLUE', 4, seat)])

let options = scoreOptions(kick, base)
let result = computeScore(kick, [...clicks, ev('MINUS', 'RED')], 3, 3, options)
check('kickboxing por defecto: el punto negativo resta 3 por juez', cards(result), [[2, 4], [2, 4], [2, 4]])
check('kickboxing por defecto: descalifica a las 4 advertencias', dqLimit(kick, options), 4)

result = computeScore(kick, [...clicks, ev('JUDGE', 'RED', -1, 1)], 3, 3, options)
check('una corrección de mesa resta en la tarjeta de ese juez', cards(result), [[4, 4], [5, 4], [5, 4]])

result = computeScore(kick, [...clicks, ev('KD', 'BLUE')], 3, 3, options)
check('el knockdown suma 1 por juez', cards(result), [[5, 5], [5, 5], [5, 5]])
check('empate en tarjetas sin decisión: faltan decisiones', result.suggestion.winner, null)

result = computeScore(kick, [...clicks, ev('JUDGE', 'BLUE', 1, 1, 3)], 3, 3, options)
check('el último round desempata la tarjeta', [cards(result)[0], result.judges[0].favor], [[5, 5], 'BLUE'])

options = scoreOptions(kick, { ...base, minusMode: 'RIVAL', minusValue: 1 })
result = computeScore(kick, [...clicks, ev('MINUS', 'RED')], 3, 3, options)
check('suma al rival: 1 por juez para el rival', cards(result), [[5, 5], [5, 5], [5, 5]])
check('suma al rival: el sancionado conserva el conteo', result.sides.RED.minusTotal, 1)

options = scoreOptions(kick, { ...base, minusMode: 'RIVAL' })
result = computeScore(kick, [...clicks, ev('MINUS', 'RED')], 3, 3, options)
check('suma al rival sin valor: usa el de la modalidad', result.judges[0].blue, 7)

options = scoreOptions(kick, { ...base, dqAt: 3 })
result = computeScore(kick, times(2, () => ev('WARN', 'BLUE')), 3, 3, options)
check('límite 3: con 2 advertencias no descalifica', result.sides.BLUE.dq, false)
check('límite 3: la escalera intermedia sigue', result.sides.BLUE.minusTotal, 1)
result = computeScore(kick, times(3, () => ev('WARN', 'BLUE')), 3, 3, options)
check('límite 3: con 3 descalifica y sugiere al rival', [result.sides.BLUE.dq, result.suggestion], [
  true,
  { winner: 'RED', reason: 'Descalificación' },
])

options = scoreOptions(kick, { ...base, dqAt: 6 })
result = computeScore(kick, times(5, () => ev('WARN', 'RED')), 3, 3, options)
check('límite 6: reemplaza el paso de la modalidad', result.sides.RED.dq, false)

options = scoreOptions(kick, { ...base, dqAt: 0 })
result = computeScore(kick, times(9, () => ev('WARN', 'RED')), 3, 3, options)
check('límite 0: nunca descalifica', result.sides.RED.dq, false)

options = scoreOptions(kick, { ...base, autoLadder: false, dqAt: 2 })
result = computeScore(kick, times(2, () => ev('WARN', 'RED')), 3, 3, options)
check('sin sanciones automáticas, el límite descalifica directo', [result.sides.RED.dq, result.sides.RED.minusTotal], [
  true,
  0,
])

options = scoreOptions(kick, { ...base, autoLadder: false })
result = computeScore(kick, times(5, () => ev('WARN', 'RED')), 3, 3, options)
check('sin sanciones automáticas y sin límite, no descalifica', result.sides.RED.dq, false)

const bjj = getRuleset('bjj')
options = scoreOptions(bjj, base)
check('jiu-jitsu por defecto: sin punto negativo', options.minusEnabled, false)
result = computeScore(bjj, [ev('POINT', 'RED', 4), ev('MINUS', 'RED')], 0, 1, options)
check('jiu-jitsu por defecto: un punto negativo no cuenta', [result.sides.RED.score, result.sides.BLUE.score], [4, 0])
result = computeScore(bjj, times(4, () => ev('PEN', 'RED')), 0, 1, options)
check(
  'jiu-jitsu por defecto: escalera de penalizaciones',
  [result.sides.RED.dq, result.sides.BLUE.score, result.sides.BLUE.advTotal],
  [true, 2, 1],
)
result = computeScore(bjj, [ev('ADV', 'RED')], 0, 1, options)
check('jiu-jitsu: con puntos iguales definen las ventajas', result.suggestion, { winner: 'RED', reason: 'Ventajas' })

options = scoreOptions(bjj, { ...base, minusMode: 'RIVAL' })
result = computeScore(bjj, [ev('POINT', 'RED', 4), ev('MINUS', 'RED'), ev('MINUS', 'RED')], 0, 1, options)
check('jiu-jitsu, suma al rival: 1 por cada negativo', [result.sides.RED.score, result.sides.BLUE.score], [4, 2])

options = scoreOptions(bjj, { ...base, minusMode: 'SUBTRACT', minusValue: 2 })
result = computeScore(bjj, [ev('POINT', 'RED', 4), ev('MINUS', 'RED')], 0, 1, options)
check('jiu-jitsu, resta al sancionado con valor 2', [result.sides.RED.score, result.sides.BLUE.score], [2, 0])

options = scoreOptions(bjj, { ...base, dqAt: 2 })
result = computeScore(bjj, times(2, () => ev('PEN', 'BLUE')), 0, 1, options)
check('jiu-jitsu, límite 2: cuenta penalizaciones', result.sides.BLUE.dq, true)

const point = getRuleset('point-fighting')
result = computeScore(point, [ev('POINT', 'RED', 3), ev('POINT', 'RED', 3), ev('POINT', 'RED', 3), ev('POINT', 'RED', 1)], 0, 3, scoreOptions(point, base))
check('point fighting: avisa la diferencia de 10', result.leadReached, true)

const category = { ...base, minusMode: 'RIVAL', minusValue: 1 }
options = scoreOptions(kick, category, { customRules: false, dqAt: 9, minusMode: 'SUBTRACT', minusValue: 5 })
check('pelea sin reglas propias: usa las de la categoría', [options.minusToRival, options.minusValue, options.dqAt], [
  true,
  1,
  null,
])
options = scoreOptions(kick, category, { customRules: true, dqAt: 2, minusMode: null, minusValue: null })
check('pelea con reglas propias: reemplaza las de la categoría', [options.minusToRival, options.minusValue, options.dqAt], [
  false,
  3,
  2,
])

check('lectura de formulario vacío', readSanctions({ dqAt: '', minusMode: '', minusValue: '' }), {
  dqAt: null,
  minusMode: null,
  minusValue: null,
})
check('lectura fuera de rango o inválida', readSanctions({ dqAt: '99', minusMode: 'x', minusValue: '0' }), {
  dqAt: 20,
  minusMode: null,
  minusValue: 1,
})
check('lectura de valores válidos', readSanctions({ dqAt: 3, minusMode: 'RIVAL', minusValue: '2' }), {
  dqAt: 3,
  minusMode: 'RIVAL',
  minusValue: 2,
})
check(
  'resumen para la mesa y el acta',
  sanctionsSummary(kick, { dqAt: 3, minusEnabled: true, minusToRival: true, minusValue: 1 }),
  'Descalificación a las 3 advertencias · Punto negativo: suma 1 al rival por juez',
)

console.log(failed === 0 ? 'Puntaje y sanciones: todo en orden.' : `${failed} pruebas fallaron.`)
process.exit(failed === 0 ? 0 : 1)
