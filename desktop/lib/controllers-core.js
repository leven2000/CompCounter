export const SLOTS = 4

const BUTTON_BITS = [
  ['UP', 0x0001],
  ['DOWN', 0x0002],
  ['LEFT', 0x0004],
  ['RIGHT', 0x0008],
  ['START', 0x0010],
  ['BACK', 0x0020],
  ['L3', 0x0040],
  ['R3', 0x0080],
  ['LB', 0x0100],
  ['RB', 0x0200],
  ['A', 0x1000],
  ['B', 0x2000],
  ['X', 0x4000],
  ['Y', 0x8000],
]

export const BUTTONS = [
  { id: 'A', label: 'A' },
  { id: 'B', label: 'B' },
  { id: 'X', label: 'X' },
  { id: 'Y', label: 'Y' },
  { id: 'LB', label: 'LB (botón superior izquierdo)' },
  { id: 'RB', label: 'RB (botón superior derecho)' },
  { id: 'LT', label: 'LT (gatillo izquierdo)' },
  { id: 'RT', label: 'RT (gatillo derecho)' },
  { id: 'BACK', label: 'Vista (botón chico izquierdo)' },
  { id: 'START', label: 'Menú (botón chico derecho)' },
  { id: 'UP', label: 'Cruceta arriba' },
  { id: 'DOWN', label: 'Cruceta abajo' },
  { id: 'LEFT', label: 'Cruceta izquierda' },
  { id: 'RIGHT', label: 'Cruceta derecha' },
  { id: 'L3', label: 'Clic de la palanca izquierda' },
  { id: 'R3', label: 'Clic de la palanca derecha' },
]

export const ACTIONS = {
  RED_PLUS: { corner: 'RED', value: 1 },
  RED_MINUS: { corner: 'RED', value: -1 },
  BLUE_PLUS: { corner: 'BLUE', value: 1 },
  BLUE_MINUS: { corner: 'BLUE', value: -1 },
}

export const DEFAULT_MAPPING = { RED_PLUS: 'B', RED_MINUS: 'START', BLUE_PLUS: 'X', BLUE_MINUS: 'BACK' }

const TRIGGER_PRESS = 120
const TRIGGER_RELEASE = 60

export function readButtons(raw, previous) {
  const down = new Set()
  for (const [name, bit] of BUTTON_BITS) if (raw.buttons & bit) down.add(name)
  if (raw.lt >= (previous.has('LT') ? TRIGGER_RELEASE : TRIGGER_PRESS)) down.add('LT')
  if (raw.rt >= (previous.has('RT') ? TRIGGER_RELEASE : TRIGGER_PRESS)) down.add('RT')
  return down
}

export function newPresses(previous, current) {
  return [...current].filter((button) => !previous.has(button))
}

export function sameSet(a, b) {
  return a.size === b.size && [...a].every((item) => b.has(item))
}

export function checkMapping(input) {
  const known = new Set(BUTTONS.map((b) => b.id))
  const mapping = {}
  for (const action of Object.keys(ACTIONS)) {
    const button = input && typeof input === 'object' ? input[action] : null
    if (typeof button !== 'string' || !known.has(button)) return { ok: false, error: 'Falta elegir un botón.' }
    mapping[action] = button
  }
  if (new Set(Object.values(mapping)).size !== Object.keys(mapping).length) {
    return { ok: false, error: 'Cada acción necesita un botón distinto.' }
  }
  return { ok: true, mapping }
}

export function actionFor(mapping, button) {
  const action = Object.keys(ACTIONS).find((name) => mapping[name] === button)
  return action ? ACTIONS[action] : null
}

export function createState() {
  return Array.from({ length: SLOTS }, () => ({
    connected: false,
    down: new Set(),
    seat: null,
    suspect: false,
    overlap: false,
  }))
}

export function assign(state, slot, areaId, seat) {
  for (const other of state) {
    if (other.seat && other.seat.areaId === areaId && other.seat.seat === seat) {
      other.seat = null
      other.suspect = false
    }
  }
  state[slot].seat = { areaId, seat }
  state[slot].suspect = false
  state[slot].overlap = false
}

export function unassign(state, slot) {
  state[slot].seat = null
  state[slot].suspect = false
  state[slot].overlap = false
}

export function setConnected(state, slot, connected) {
  const current = state[slot]
  if (current.connected === connected) return false
  current.connected = connected
  current.down = new Set()
  if (!connected) {
    if (!current.seat) return true
    const others = state.filter((other) => other !== current && other.seat && !other.connected)
    current.overlap = others.length > 0
    for (const other of others) other.overlap = true
    return true
  }
  if (current.seat && current.overlap) current.suspect = true
  current.overlap = false
  return true
}

export function canScore(slot) {
  return slot.connected && slot.seat != null && !slot.suspect
}

export function snapshot(state) {
  return state.map((slot, index) => ({
    slot: index,
    connected: slot.connected,
    down: [...slot.down],
    areaId: slot.seat?.areaId ?? null,
    seat: slot.seat?.seat ?? null,
    suspect: slot.suspect,
  }))
}
