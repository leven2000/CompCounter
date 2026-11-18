const {
  actionFor,
  assign,
  canScore,
  checkMapping,
  createState,
  DEFAULT_MAPPING,
  newPresses,
  readButtons,
  setConnected,
  snapshot,
  unassign,
} = await import('../desktop/lib/controllers-core.js')
const { startControllers } = await import('../desktop/lib/controllers.js')

let failed = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${name}${ok ? '' : `: dio ${JSON.stringify(got)}, se esperaba ${JSON.stringify(want)}`}`)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const B = 0x2000
const X = 0x4000
const START = 0x0010
const none = new Set()

check('botones: B y X a la vez', [...readButtons({ buttons: B | X, lt: 0, rt: 0 }, none)], ['B', 'X'])
check('gatillo: hace falta apretarlo bastante', [...readButtons({ buttons: 0, lt: 100, rt: 130 }, none)], ['RT'])
check('gatillo: ya apretado, no se suelta por un temblor', [...readButtons({ buttons: 0, lt: 70, rt: 50 }, new Set(['LT', 'RT']))], ['LT'])
check('solo cuenta al apretar, no mientras se mantiene', newPresses(new Set(['B']), new Set(['B', 'X'])), ['X'])

check('botones de fábrica', [actionFor(DEFAULT_MAPPING, 'B'), actionFor(DEFAULT_MAPPING, 'X'), actionFor(DEFAULT_MAPPING, 'START'), actionFor(DEFAULT_MAPPING, 'BACK'), actionFor(DEFAULT_MAPPING, 'A')], [
  { corner: 'RED', value: 1 },
  { corner: 'BLUE', value: 1 },
  { corner: 'RED', value: -1 },
  { corner: 'BLUE', value: -1 },
  null,
])
check('mapeo: dos acciones con el mismo botón se rechaza', checkMapping({ ...DEFAULT_MAPPING, RED_MINUS: 'B' }).ok, false)
check('mapeo: botón inexistente se rechaza', checkMapping({ ...DEFAULT_MAPPING, RED_PLUS: 'TURBO' }).ok, false)
check('mapeo: basura se rechaza', [checkMapping(null).ok, checkMapping('x').ok], [false, false])
check('mapeo: válido', checkMapping({ RED_PLUS: 'RB', RED_MINUS: 'RT', BLUE_PLUS: 'LB', BLUE_MINUS: 'LT' }).ok, true)

const seats = (state) => snapshot(state).map((s) => (s.seat == null ? '-' : `${s.seat}${s.suspect ? '?' : ''}`)).join(' ')
let state = createState()
for (const slot of [0, 1, 2]) setConnected(state, slot, true)
assign(state, 0, 'ring', 1)
assign(state, 1, 'ring', 2)
assign(state, 2, 'ring', 3)
check('asignación inicial', seats(state), '1 2 3 -')
assign(state, 3, 'ring', 2)
check('un juez tiene un solo control: el anterior queda libre', seats(state), '1 - 3 2')
assign(state, 3, 'tatami', 1)
check('un control tiene un solo juez', snapshot(state)[3], { slot: 3, connected: false, down: [], areaId: 'tatami', seat: 1, suspect: false })
unassign(state, 3)
assign(state, 1, 'ring', 2)

setConnected(state, 0, false)
check('apagado no puntúa', canScore(state[0]), false)
setConnected(state, 0, true)
check('un solo control se apaga y vuelve: sigue siendo de su juez', [seats(state), canScore(state[0])], ['1 2 3 -', true])

setConnected(state, 0, false)
setConnected(state, 1, false)
setConnected(state, 1, true)
setConnected(state, 0, true)
check('dos apagados a la vez: al volver pueden estar cruzados', seats(state), '1? 2? 3 -')
check('un control en duda no puntúa', [canScore(state[0]), canScore(state[1]), canScore(state[2])], [false, false, true])
assign(state, 1, 'ring', 1)
assign(state, 0, 'ring', 2)
check('reasignar confirma de quién es cada uno', [seats(state), canScore(state[0]), canScore(state[1])], ['2 1 3 -', true, true])

state = createState()
for (const slot of [0, 1, 2, 3]) setConnected(state, slot, true)
assign(state, 0, 'ring', 1)
setConnected(state, 3, false)
setConnected(state, 0, false)
setConnected(state, 0, true)
check('un control sin asignar apagado no pone en duda a los demás', seats(state), '1 - - -')

const pads = [{ buttons: 0 }, { buttons: 0 }, null, null]
const sent = []
const buzz = []
let accept = true
const service = startControllers({
  backend: {
    read: (slot) => (pads[slot] ? { buttons: pads[slot].buttons, lt: 0, rt: 0 } : null),
    vibrate: (slot, strength) => buzz.push(`${slot}:${strength}`),
  },
  savedMapping: { RED_PLUS: 'B', RED_MINUS: 'START', BLUE_PLUS: 'X', BLUE_MINUS: 'BACK' },
  saveMapping: () => {},
  log: () => {},
  score: async (point) => {
    sent.push(`${point.areaId}/${point.seat}/${point.corner}/${point.value}`)
    return accept
  },
})
const tap = async (slot, buttons) => {
  pads[slot] = { buttons }
  await sleep(40)
  pads[slot] = { buttons: 0 }
  await sleep(40)
}
await sleep(40)
check('servicio: detecta los conectados', service.current().slots.map((s) => s.connected), [true, true, false, false])
await tap(0, B)
check('servicio: sin asignar, un botón no hace nada', sent, [])

let pending = service.assign('ring', 1, [])
await tap(1, B)
check('servicio: el primero que aprieta queda asignado', await pending, { ok: true, slot: 1, button: 'B' })
check('servicio: apretar para asignar no suma puntos', sent, [])
pending = service.assign('ring', 2, [1])
await tap(1, X)
await tap(0, X)
check('servicio: ignora al que ya fue asignado en esta tanda', (await pending).slot, 0)

buzz.length = 0
await tap(1, B)
await tap(0, X)
await tap(0, START)
await sleep(260)
check('servicio: cada botón manda su punto al juez correcto', sent, ['ring/1/RED/1', 'ring/2/BLUE/1', 'ring/2/RED/-1'])
check('servicio: vibra cuando el punto quedó registrado', buzz.filter((b) => b.endsWith(':0.7')).length, 3)

buzz.length = 0
accept = false
await tap(1, B)
await sleep(120)
check('servicio: si el servidor lo rechaza, no vibra', buzz, [])

pads[1] = { buttons: B }
await sleep(120)
check('servicio: mantener apretado cuenta una sola vez', sent.filter((s) => s === 'ring/1/RED/1').length, 3)
pads[1] = { buttons: 0 }

check('servicio: botón repetido en el mapeo se rechaza', service.setMapping({ RED_PLUS: 'B', RED_MINUS: 'B', BLUE_PLUS: 'X', BLUE_MINUS: 'BACK' }).ok, false)
pending = service.captureButton()
await tap(0, 0x0200)
check('servicio: captura de botón para el mapeo', (await pending).button, 'RB')
pending = service.assign('ring', 3, [])
service.cancel()
check('servicio: cancelar la asignación', await pending, { ok: false })
service.stop()

if (failed) {
  console.error(`\n${failed} pruebas fallaron`)
  process.exit(1)
}
console.log('\nTodas las pruebas de controles pasaron')
