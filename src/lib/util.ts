import { randomInt } from 'node:crypto'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newCode(length = 6) {
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return out
}

export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function slugify(text: string) {
  const base = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'torneo'
}

export function str(form: FormData, key: string) {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export function optStr(form: FormData, key: string) {
  return str(form, key) || null
}

export function num(form: FormData, key: string) {
  const raw = str(form, key).replace(',', '.')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function int(form: FormData, key: string, fallback: number) {
  const n = num(form, key)
  return n == null ? fallback : Math.round(n)
}

export function isHexColor(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v)
}

export function formatDate(d: Date | null) {
  if (!d) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' }).format(d)
}

export function weightLabel(min: number | null, max: number | null) {
  if (min != null && max != null) return `${min}–${max} kg`
  if (max != null) return `hasta ${max} kg`
  if (min != null) return `más de ${min} kg`
  return ''
}
