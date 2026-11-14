export type LiveRole = 'TV' | 'TABLE' | 'JUDGE'

type Client = {
  id: number
  areaId: string
  role: LiveRole
  seat: number
  matchId: string | null
  send: (payload: string) => void
}

type Bus = {
  seq: number
  clients: Map<number, Client>
  timers: Map<string, ReturnType<typeof setTimeout>>
  pending: Map<string, Promise<void>>
}

const g = globalThis as unknown as { __liveBus?: Bus }

const bus: Bus =
  g.__liveBus ??
  (g.__liveBus = { seq: 0, clients: new Map(), timers: new Map(), pending: new Map() })

export function addClient(client: Omit<Client, 'id'>) {
  const id = ++bus.seq
  bus.clients.set(id, { ...client, id })
  return id
}

export function removeClient(id: number) {
  bus.clients.delete(id)
}

export function broadcast(areaId: string, payload: string) {
  for (const client of bus.clients.values()) {
    if (client.areaId !== areaId) continue
    try {
      client.send(payload)
    } catch {
      bus.clients.delete(client.id)
    }
  }
}

export function presence(areaId: string, matchId: string | null) {
  let table = false
  const judges = new Set<number>()
  for (const client of bus.clients.values()) {
    if (client.areaId !== areaId) continue
    if (client.role === 'TABLE') table = true
    if (client.role === 'JUDGE' && client.matchId === matchId) judges.add(client.seat)
  }
  return { table, judges: [...judges].sort((a, b) => a - b) }
}

export function setTimer(areaId: string, ms: number, fn: () => void) {
  clearTimer(areaId)
  bus.timers.set(
    areaId,
    setTimeout(() => {
      bus.timers.delete(areaId)
      fn()
    }, Math.max(0, ms)),
  )
}

export function clearTimer(areaId: string) {
  const t = bus.timers.get(areaId)
  if (t) clearTimeout(t)
  bus.timers.delete(areaId)
}

export function coalesce(areaId: string, run: () => Promise<void>) {
  const existing = bus.pending.get(areaId)
  if (existing) return existing
  const p = new Promise<void>((resolve) => setTimeout(resolve, 25))
    .then(() => {
      bus.pending.delete(areaId)
      return run()
    })
    .catch(() => {
      bus.pending.delete(areaId)
    })
  bus.pending.set(areaId, p)
  return p
}
