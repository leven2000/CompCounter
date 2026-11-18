import { writeFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'

const HEADERS = [
  'Nombre',
  'Apellido',
  'Escuela',
  'Disciplina',
  'Categoría',
  'Género',
  'Año de nacimiento',
  'Cinturón o nivel',
  'Peso',
  'País',
]

const NOTES = [
  ['Solo el nombre es obligatorio. Disciplina y categoría hacen falta para que quede inscripto.'],
  ['Si alguien compite en dos categorías, va una fila por cada una.'],
  ['Escribí cada categoría siempre igual: de ahí se crean solas.'],
  [],
]

const EXAMPLES = [
  ['Lucía', 'Gómez', 'Dragón Gym', 'K-1', 'Adulto -60 kg Femenino', 'Femenino', 2005, '', 58.4, 'Argentina'],
  ['Martín', 'de la Fuente', 'Dragón Gym', 'K-1', 'Adulto -70 kg Masculino', 'Masculino', 1996, '', 69.5, 'Argentina'],
  ['Martín', 'de la Fuente', 'Dragón Gym', 'Light Contact', 'Adulto -70 kg Masculino', 'Masculino', 1996, '', 69.5, 'Argentina'],
  ['Ana', 'Pérez', 'Escuela del Sol', 'Jiu-Jitsu', 'Azul -64 kg Femenino', 'Femenino', 2001, 'Azul', 62.4, 'Uruguay'],
]

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
const TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml'

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const letter = (index) => String.fromCharCode(65 + index)

function cell(value, ref, style) {
  if (value === '' || value == null) return ''
  const s = style ? ` s="${style}"` : ''
  if (typeof value === 'number') return `<c r="${ref}"${s}><v>${value}</v></c>`
  return `<c r="${ref}" t="inlineStr"${s}><is><t>${escape(value)}</t></is></c>`
}

function sheet(rows, headerIndex) {
  const body = rows
    .map((row, r) => {
      const cells = row.map((value, c) => cell(value, `${letter(c)}${r + 1}`, r === headerIndex ? 1 : 0)).join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  return (
    `${XML}<worksheet xmlns="${MAIN}">` +
    `<cols><col min="1" max="${HEADERS.length}" width="24" customWidth="1"/></cols>` +
    `<sheetData>${body}</sheetData></worksheet>`
  )
}

const files = {
  '[Content_Types].xml':
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${TYPE}.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TYPE}.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="${TYPE}.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="${TYPE}.styles+xml"/>` +
    '</Types>',
  '_rels/.rels':
    `${XML}<Relationships xmlns="${PKG}">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>',
  'xl/workbook.xml':
    `${XML}<workbook xmlns="${MAIN}" xmlns:r="${REL}">` +
    '<sheets><sheet name="Competidores" sheetId="1" r:id="rId1"/><sheet name="Ejemplo" sheetId="2" r:id="rId2"/></sheets>' +
    '</workbook>',
  'xl/_rels/workbook.xml.rels':
    `${XML}<Relationships xmlns="${PKG}">` +
    `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/>` +
    `<Relationship Id="rId3" Type="${REL}/styles" Target="styles.xml"/>` +
    '</Relationships>',
  'xl/styles.xml':
    `${XML}<styleSheet xmlns="${MAIN}">` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '</styleSheet>',
  'xl/worksheets/sheet1.xml': sheet([HEADERS], 0),
  'xl/worksheets/sheet2.xml': sheet([...NOTES, HEADERS, ...EXAMPLES], NOTES.length),
}

const out = new URL('../public/plantilla-competidores.xlsx', import.meta.url)
writeFileSync(out, zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)]))))
console.log('Plantilla escrita en public/plantilla-competidores.xlsx')
