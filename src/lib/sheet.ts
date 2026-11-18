import { strFromU8, unzipSync } from 'fflate'

export type Sheet = { name: string; rows: string[][] }

export class SheetError extends Error {}

export const MAX_FILE_BYTES = 10_000_000
const MAX_PART_BYTES = 60_000_000
const MAX_ROWS = 5000
const MAX_COLS = 40

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function xmlText(raw: string) {
  return raw
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, code: string) => {
      if (code[0] !== '#') return ENTITIES[code]
      const point = code[1] === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
    })
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

function richText(xml: string) {
  const visible = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')
  let out = ''
  for (const m of visible.matchAll(/<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g)) out += m[1] ?? ''
  return xmlText(out)
}

function attr(tag: string, name: string) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1] ?? null
}

function columnIndex(letters: string) {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function cellValue(attrs: string, body: string, strings: string[]) {
  const type = attr(attrs, 't') ?? 'n'
  if (type === 'inlineStr') return clean(richText(body))
  const raw = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body)?.[1] ?? ''
  if (type === 's') return clean(strings[Number(raw)] ?? '')
  if (type === 'e') return ''
  if (type === 'n') {
    const n = Number(raw)
    return raw && Number.isFinite(n) ? String(parseFloat(n.toPrecision(12))) : clean(raw)
  }
  return clean(xmlText(raw))
}

function parseSheet(xml: string, strings: string[]) {
  const rows: string[][] = []
  let nextRow = 0
  for (const rm of xml.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const ref = attr(rm[1], 'r')
    const index = ref ? Number(ref) - 1 : nextRow
    nextRow = index + 1
    if (!(index >= 0) || index >= MAX_ROWS) break
    const cells: string[] = []
    let col = 0
    for (const cm of (rm[2] ?? '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const letters = /^([A-Z]+)\d+$/.exec(attr(cm[1], 'r') ?? '')?.[1]
      if (letters) col = columnIndex(letters)
      const value = cellValue(cm[1], cm[2] ?? '', strings)
      if (value && col < MAX_COLS) {
        while (cells.length < col) cells.push('')
        cells[col] = value
      }
      col += 1
    }
    while (rows.length < index) rows.push([])
    rows[index] = cells
  }
  while (rows.length > 0 && rows[rows.length - 1].length === 0) rows.pop()
  return rows
}

function readXlsx(bytes: Uint8Array): Sheet[] {
  const parts = new Map<string, string>()
  try {
    const files = unzipSync(bytes, {
      filter: (file) => {
        if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedstrings\.xml|worksheets\/[^/]+\.xml)$/i.test(file.name)) {
          return false
        }
        if (file.originalSize > MAX_PART_BYTES) throw new SheetError('La planilla es demasiado grande.')
        return true
      },
    })
    for (const [name, data] of Object.entries(files)) parts.set(name.toLowerCase(), strFromU8(data))
  } catch (error) {
    if (error instanceof SheetError) throw error
    throw new SheetError('No se pudo abrir el archivo. Guardalo de nuevo como Libro de Excel (.xlsx) y probá otra vez.')
  }

  const strings: string[] = []
  for (const m of (parts.get('xl/sharedstrings.xml') ?? '').matchAll(
    /<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g,
  )) {
    strings.push(richText(m[1] ?? ''))
  }

  const targets = new Map<string, string>()
  for (const m of (parts.get('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<(?:\w+:)?Relationship\b([^>]*)>/g)) {
    const id = attr(m[1], 'Id')
    const target = attr(m[1], 'Target')
    if (id && target) targets.set(id, (target.startsWith('/') ? target.slice(1) : `xl/${target}`).toLowerCase())
  }

  const sheets: Sheet[] = []
  for (const m of (parts.get('xl/workbook.xml') ?? '').matchAll(/<(?:\w+:)?sheet\b([^>]*)>/g)) {
    const state = attr(m[1], 'state')
    if (state === 'hidden' || state === 'veryHidden') continue
    const id = attr(m[1], '\\w+:id')
    const xml = id ? parts.get(targets.get(id) ?? '') : undefined
    if (xml == null) continue
    sheets.push({ name: xmlText(attr(m[1], 'name') ?? '') || `Hoja ${sheets.length + 1}`, rows: parseSheet(xml, strings) })
  }
  if (sheets.length === 0) {
    const names = [...parts.keys()].filter((n) => n.startsWith('xl/worksheets/')).sort()
    names.forEach((n, i) => sheets.push({ name: `Hoja ${i + 1}`, rows: parseSheet(parts.get(n) ?? '', strings) }))
  }
  if (sheets.length === 0) throw new SheetError('El archivo no tiene ninguna hoja con datos.')
  return sheets
}

function decodeText(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

function countOutsideQuotes(line: string, separator: string) {
  let count = 0
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === separator && !quoted) count += 1
  }
  return count
}

function readDelimited(text: string): string[][] {
  let body = text
  let separator = ''
  const declared = /^sep=(.)\r?\n/i.exec(body)
  if (declared) {
    separator = declared[1]
    body = body.slice(declared[0].length)
  } else {
    const first = body.split(/\r?\n/).find((line) => line.trim()) ?? ''
    separator = ['\t', ';', ','].reduce((best, candidate) =>
      countOutsideQuotes(first, candidate) > countOutsideQuotes(first, best) ? candidate : best,
    )
  }

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const endCell = () => {
    if (row.length < MAX_COLS) row.push(clean(cell))
    cell = ''
  }
  const endRow = () => {
    endCell()
    while (row.length > 0 && !row[row.length - 1]) row.pop()
    rows.push(row)
    row = []
  }
  for (let i = 0; i < body.length && rows.length < MAX_ROWS; i++) {
    const ch = body[i]
    if (quoted) {
      if (ch !== '"') cell += ch
      else if (body[i + 1] === '"') {
        cell += '"'
        i += 1
      } else quoted = false
    } else if (ch === '"' && !cell) quoted = true
    else if (ch === separator) endCell()
    else if (ch === '\n') endRow()
    else if (ch !== '\r') cell += ch
  }
  if ((cell || row.length > 0) && rows.length < MAX_ROWS) endRow()
  while (rows.length > 0 && rows[rows.length - 1].length === 0) rows.pop()
  return rows
}

export function readTable(fileName: string, bytes: Uint8Array): Sheet[] {
  if (bytes.length === 0) throw new SheetError('El archivo está vacío.')
  if (bytes.length > MAX_FILE_BYTES) throw new SheetError('El archivo pesa más de 10 MB.')
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes)
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new SheetError(
      'Es un Excel de formato viejo (.xls) o tiene contraseña. Abrilo en Excel y usá Archivo → Guardar como → Libro de Excel (.xlsx).',
    )
  }
  const text = decodeText(bytes)
  if (text.includes('\u0000')) {
    throw new SheetError('No reconozco ese tipo de archivo. Subí un Excel (.xlsx) o un CSV.')
  }
  const rows = readDelimited(text)
  if (rows.length === 0) throw new SheetError('El archivo no tiene datos.')
  return [{ name: fileName.replace(/\.[^.]+$/, '') || 'Datos', rows }]
}
