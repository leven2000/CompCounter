export const EXTENSION = '.ccbackup'
export const FORMAT = 'compcounter-copia'
export const KINDS = ['auto', 'manual', 'previa']

const pad = (n) => String(n).padStart(2, '0')

export function fileName(date, kind) {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `compcounter-${day}-${time}-${kind}${EXTENSION}`
}

export function parseName(name) {
  const match = /^compcounter-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-([a-z]+)\.ccbackup$/.exec(name)
  if (!match || !KINDS.includes(match[7])) return null
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  return { name, kind: match[7], day: match.slice(1, 4).join(''), at: new Date(year, month - 1, day, hour, minute, second).getTime() }
}

export function expired(names, now, keepRecent = 48, keepDays = 30) {
  const autos = names
    .map(parseName)
    .filter((entry) => entry && entry.kind === 'auto')
    .sort((a, b) => b.at - a.at)
  const days = new Set()
  const remove = []
  autos.forEach((entry, index) => {
    if (index < keepRecent) {
      days.add(entry.day)
      return
    }
    const old = now - entry.at > keepDays * 86_400_000
    if (old || days.has(entry.day)) remove.push(entry.name)
    else days.add(entry.day)
  })
  return remove
}

export function overBudget(files, budget, keep = 3) {
  const autos = files
    .map((file) => ({ ...parseName(file.name), size: file.size }))
    .filter((entry) => entry.kind === 'auto')
    .sort((a, b) => b.at - a.at)
  const remove = []
  let total = 0
  autos.forEach((entry, index) => {
    total += entry.size
    if (index >= keep && total > budget) remove.push(entry.name)
  })
  return remove
}

export function checkHeader(header, applied) {
  if (!header || header.format !== FORMAT) return 'Ese archivo no es una copia de seguridad de CompCounter.'
  if (header.version !== 1) return 'Esa copia es de una versión más nueva de CompCounter. Actualizá el programa para restaurarla.'
  if (!Array.isArray(header.migrations) || !header.tables || typeof header.tables !== 'object') {
    return 'La copia está dañada: le falta el encabezado.'
  }
  const known = new Set(applied)
  if (header.migrations.some((name) => !known.has(name))) {
    return 'Esa copia es de una versión más nueva de CompCounter. Actualizá el programa para restaurarla.'
  }
  return null
}
