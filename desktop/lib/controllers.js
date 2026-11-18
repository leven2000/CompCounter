import {
  actionFor,
  assign,
  BUTTONS,
  canScore,
  checkMapping,
  createState,
  DEFAULT_MAPPING,
  newPresses,
  readButtons,
  sameSet,
  setConnected,
  SLOTS,
  snapshot,
  unassign,
} from './controllers-core.js'

const POLL_MS = 8
const PROBE_MS = 1500

export function startControllers({ backend, savedMapping, saveMapping, score, log }) {
  const state = createState()
  const listeners = new Set()
  const nextProbe = Array.from({ length: SLOTS }, () => 0)
  const checked = checkMapping(savedMapping)
  let mapping = checked.ok ? checked.mapping : { ...DEFAULT_MAPPING }
  let capture = null

  const current = () => ({
    slots: snapshot(state),
    mapping,
    buttons: BUTTONS,
    capture: capture ? { type: capture.type, areaId: capture.areaId, seat: capture.seat } : null,
  })

  const notify = () => {
    const value = current()
    for (const listener of listeners) listener(value)
  }

  const pulse = (slot, ms) => {
    try {
      backend.vibrate(slot, 0.7)
      setTimeout(() => {
        try {
          backend.vibrate(slot, 0)
        } catch {}
      }, ms)
    } catch {}
  }

  const endCapture = (result) => {
    if (!capture) return
    const { resolve, timer } = capture
    clearTimeout(timer)
    capture = null
    resolve(result)
    notify()
  }

  const beginCapture = (type, extra, timeoutMs) => {
    endCapture({ ok: false })
    return new Promise((resolve) => {
      capture = {
        type,
        ...extra,
        resolve,
        timer: setTimeout(() => endCapture({ ok: false }), timeoutMs),
      }
      notify()
    })
  }

  const press = (slot, button) => {
    if (capture) {
      if (capture.exclude?.includes(slot)) return
      if (capture.type === 'assign') {
        assign(state, slot, capture.areaId, capture.seat)
        pulse(slot, 250)
      }
      endCapture({ ok: true, slot, button })
      return
    }
    const entry = state[slot]
    if (!canScore(entry)) return
    const action = actionFor(mapping, button)
    if (!action) return
    score({ ...entry.seat, ...action })
      .then((ok) => {
        if (ok) pulse(slot, action.value === 1 ? 80 : 200)
      })
      .catch((error) => log(`No se pudo enviar el punto: ${error?.message ?? error}`))
  }

  const tick = () => {
    const now = Date.now()
    let changed = false
    for (let slot = 0; slot < SLOTS; slot++) {
      const entry = state[slot]
      if (!entry.connected && now < nextProbe[slot]) continue
      let raw = null
      try {
        raw = backend.read(slot)
      } catch (error) {
        log(`Error leyendo el control ${slot + 1}: ${error?.message ?? error}`)
      }
      if (!raw) {
        nextProbe[slot] = now + PROBE_MS
        if (setConnected(state, slot, false)) changed = true
        continue
      }
      if (setConnected(state, slot, true)) changed = true
      const down = readButtons(raw, entry.down)
      if (sameSet(down, entry.down)) continue
      const pressed = newPresses(entry.down, down)
      entry.down = down
      changed = true
      for (const button of pressed) press(slot, button)
    }
    if (changed) notify()
  }

  const timer = setInterval(tick, POLL_MS)

  return {
    current,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    assign: (areaId, seat, exclude) => beginCapture('assign', { areaId, seat, exclude }, 30_000),
    captureButton: () => beginCapture('button', {}, 20_000),
    cancel: () => endCapture({ ok: false }),
    unassign(slot) {
      if (!state[slot]) return
      unassign(state, slot)
      notify()
    },
    setMapping(input) {
      const result = checkMapping(input)
      if (!result.ok) return result
      mapping = result.mapping
      saveMapping(mapping)
      notify()
      return { ok: true }
    },
    identify(slot) {
      if (state[slot]?.connected) pulse(slot, 500)
    },
    stop() {
      clearInterval(timer)
      endCapture({ ok: false })
    },
  }
}
