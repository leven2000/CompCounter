const { checkHeader, expired, fileName, FORMAT, overBudget, parseName } = await import('../desktop/lib/backup-core.js')

let failed = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${name}${ok ? '' : `: dio ${JSON.stringify(got)}, se esperaba ${JSON.stringify(want)}`}`)
}

const at = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute, 5)
const name = fileName(at(18, 9, 7), 'auto')
check('nombre del archivo', name, 'compcounter-20261118-090705-auto.ccbackup')
check('el nombre se vuelve a leer', [parseName(name).kind, parseName(name).at === at(18, 9, 7).getTime()], ['auto', true])
check('otros archivos de la carpeta se ignoran', [parseName('notas.txt'), parseName('compcounter-20261118-090705-raro.ccbackup')], [null, null])

const now = at(18, 20).getTime()
const today = Array.from({ length: 60 }, (_, i) => fileName(new Date(now - i * 5 * 60_000), 'auto'))
check('quedan las 48 automáticas más nuevas; las demás del mismo día se borran', expired(today, now).length, 60 - 48)
const older = [fileName(at(17, 9), 'auto'), fileName(at(17, 15), 'auto'), fileName(at(16, 22), 'auto'), fileName(at(10, 8), 'auto')]
check('de los días anteriores queda la última de cada día', expired([...today.slice(0, 48), ...older], now), [fileName(at(17, 9), 'auto')])
check('las de más de 30 días se borran', expired([...today.slice(0, 48), fileName(new Date(2026, 8, 1, 10, 0, 0), 'auto')], now), [fileName(new Date(2026, 8, 1, 10, 0, 0), 'auto')])
const kept = [fileName(new Date(2025, 0, 1, 10, 0, 0), 'manual'), fileName(new Date(2025, 0, 1, 11, 0, 0), 'previa'), 'fotos.zip']
check('las manuales, las previas y los archivos ajenos no se tocan', expired([...today, ...kept], now).some((n) => kept.includes(n)), false)
check('con pocas copias no se borra nada', expired(today.slice(0, 10), now), [])

const sized = (list, size) => list.map((file) => ({ name: file, size }))
check('tope de espacio: se borran las automáticas más viejas que lo pasan', overBudget(sized(today.slice(0, 10), 300), 1000), today.slice(3, 10))
check('tope de espacio: siempre quedan las 3 más nuevas', overBudget(sized(today.slice(0, 5), 5000), 1000), today.slice(3, 5))
check('tope de espacio: dentro del tope no se borra nada', overBudget(sized(today.slice(0, 10), 50), 1000), [])
check('tope de espacio: manuales, previas y archivos ajenos no cuentan ni se borran', overBudget([...sized(kept, 9000), ...sized(today.slice(0, 4), 10)], 1000), [])

const header = { format: FORMAT, version: 1, migrations: ['a', 'b'], tables: { Tournament: ['id'] } }
check('copia de esta versión: se acepta', checkHeader(header, ['a', 'b']), null)
check('copia de una versión anterior: se acepta', checkHeader(header, ['a', 'b', 'c']), null)
check('copia con una migración que este programa no conoce: se rechaza', checkHeader(header, ['a']) !== null, true)
check('formato desconocido: se rechaza', checkHeader({ ...header, format: 'otra-cosa' }, ['a', 'b']), 'Ese archivo no es una copia de seguridad de CompCounter.')
check('versión de formato futura: se rechaza', checkHeader({ ...header, version: 2 }, ['a', 'b']) !== null, true)
check('encabezado incompleto: se rechaza', checkHeader({ format: FORMAT, version: 1 }, []), 'La copia está dañada: le falta el encabezado.')
check('sin encabezado: se rechaza', checkHeader(null, []) !== null, true)

if (failed) {
  console.error(`\n${failed} pruebas fallaron`)
  process.exit(1)
}
console.log('\nTodas las pruebas de copias pasaron')
