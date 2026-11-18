import { appendFileSync, readFileSync } from 'node:fs'

export function createFake(file) {
  let slots = []
  const reload = () => {
    try {
      const value = JSON.parse(readFileSync(file, 'utf8'))
      slots = Array.isArray(value) ? value : []
    } catch {}
  }
  reload()
  setInterval(reload, 25).unref()

  return {
    read(slot) {
      const entry = slots[slot]
      if (!entry) return null
      return { buttons: Number(entry.buttons) || 0, lt: Number(entry.lt) || 0, rt: Number(entry.rt) || 0 }
    },
    vibrate(slot, strength) {
      try {
        appendFileSync(`${file}.vibra`, `${slot} ${strength}\n`)
      } catch {}
    },
  }
}
