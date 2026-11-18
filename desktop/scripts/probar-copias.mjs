import { randomBytes } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { changeCounter, createBackup, inspectBackup, restoreBackup } from '../lib/backup.js'
import { startDatabase } from '../lib/database.js'

const desktop = dirname(dirname(fileURLToPath(import.meta.url)))
const realMigrations = join(dirname(desktop), 'prisma', 'migrations')
const work = mkdtempSync(join(tmpdir(), 'cc-copias-'))

let failed = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FALLA'} ${name}${ok ? '' : `: dio ${JSON.stringify(got)}, se esperaba ${JSON.stringify(want)}`}`)
}
const fails = async (run) => {
  try {
    await run()
    return 'no falló'
  } catch (error) {
    return error.message
  }
}

const options = {
  binDir: join(desktop, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin'),
  dataDir: join(work, 'datos'),
  password: randomBytes(12).toString('hex'),
  log: () => {},
}

async function dump(client) {
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename",
  )
  const out = {}
  for (const { tablename } of tables.rows) {
    const rows = await client.query(`SELECT row_to_json(t)::text AS row FROM "${tablename}" t ORDER BY 1`)
    out[tablename] = rows.rows.map((r) => r.row)
  }
  return JSON.stringify(out)
}

const photo = randomBytes(60_000)
async function seed(client) {
  await client.query(`UPDATE "Organization" SET "name" = 'Liga "Ñandú" & Cía', "logo" = $1, "logoType" = 'image/png'`, [randomBytes(2000)])
  await client.query(`INSERT INTO "Tournament" ("id", "orgId", "name", "slug", "date", "mesaCode") VALUES ('t1', 'local-org', E'Copa\\nApertura', 'copa', '2027-03-20 00:00:00', 'ABC123')`)
  await client.query(`INSERT INTO "Area" ("id", "tournamentId", "name", "order", "judges") VALUES ('a1', 't1', 'Ring 1', 1, 3)`)
  await client.query(`INSERT INTO "Category" ("id", "tournamentId", "name", "ruleset", "weightMax", "rounds", "roundSeconds", "restSeconds", "areaId", "dqAt", "minusMode") VALUES ('c1', 't1', 'K-1 · Adulto -62,5 kg', 'kick-ring', 62.5, 3, 120, 60, 'a1', 3, 'RIVAL')`)
  for (const [id, first] of [['p1', 'Lucía'], ['p2', "D'Angelo"]]) {
    await client.query(`INSERT INTO "Participant" ("id", "tournamentId", "firstName", "lastName", "team", "weight", "checkedIn") VALUES ($1, 't1', $2, 'Gómez', NULL, 58.4, true)`, [id, first])
    await client.query(`INSERT INTO "Entry" ("id", "categoryId", "participantId") VALUES ($1, 'c1', $2)`, [`e-${id}`, id])
  }
  await client.query(`INSERT INTO "ParticipantPhoto" ("participantId", "data", "type") VALUES ('p1', $1, 'image/jpeg')`, [photo])
  await client.query(`INSERT INTO "Match" ("id", "categoryId", "round", "position", "redEntryId", "blueEntryId", "status", "phase", "clockStartedAt", "customRules") VALUES ('m1', 'c1', 1, 0, 'e-p1', 'e-p2', 'LIVE', 'ROUND', '2027-03-20 15:04:05.678', true)`)
  await client.query(`UPDATE "Area" SET "currentMatchId" = 'm1' WHERE "id" = 'a1'`)
  for (let i = 0; i < 1200; i++) {
    await client.query(`INSERT INTO "ScoreEvent" ("id", "matchId", "type", "corner", "value", "judge", "round") VALUES ($1, 'm1', 'JUDGE', $2, 1, $3, 1)`, [`s${i}`, i % 2 ? 'RED' : 'BLUE', (i % 3) + 1])
  }
}

let database = await startDatabase({ ...options, migrationsDir: realMigrations })
let client = await database.connect()
const copy = join(work, 'copia.ccbackup')
try {
  await seed(client)
  const before = await dump(client)
  const counter = await changeCounter(client)

  const made = await createBackup(client, copy, '0.0.0-prueba')
  const info = await inspectBackup(copy)
  check('la copia incluye todas las filas', [made.rows, info.rows, info.tables.ScoreEvent, info.tables.ParticipantPhoto], [1211, 1211, 1200, 1])
  check('la copia no toca la base', await dump(client) === before, true)

  await client.query(`DELETE FROM "Tournament"`)
  await client.query(`INSERT INTO "Tournament" ("id", "orgId", "name", "slug") VALUES ('otro', 'local-org', 'Otro', 'otro')`)
  check('la base cambió después de la copia', await dump(client) === before, false)

  await restoreBackup(client, copy)
  check('restaurar deja la base idéntica a la copia', await dump(client) === before, true)
  const stored = await client.query(`SELECT "data" FROM "ParticipantPhoto" WHERE "participantId" = 'p1'`)
  check('la foto vuelve byte por byte', Buffer.compare(stored.rows[0].data, photo), 0)
  const clock = await client.query(`SELECT to_char("clockStartedAt", 'YYYY-MM-DD HH24:MI:SS.MS') AS at FROM "Match"`)
  check('las fechas no se corren de hora', clock.rows[0].at, '2027-03-20 15:04:05.678')
  check('las claves foráneas siguen válidas', (await client.query(`SELECT count(*)::int AS n FROM "Entry" e JOIN "Participant" p ON p."id" = e."participantId"`)).rows[0].n, 2)

  const text = gunzipSync(readFileSync(copy)).toString('utf8').split('\n').filter(Boolean)
  const save = (name, list) => {
    const path = join(work, name)
    writeFileSync(path, gzipSync(list.join('\n') + '\n'))
    return path
  }

  const cut = join(work, 'cortada.ccbackup')
  writeFileSync(cut, readFileSync(copy).subarray(0, 9000))
  check('copia cortada: se rechaza', await fails(() => restoreBackup(client, cut)), 'La copia está dañada o incompleta: no se pudo leer.')
  check('copia sin el final: se rechaza', await fails(() => restoreBackup(client, save('sin-final.ccbackup', text.slice(0, -1)))), 'La copia está incompleta: se cortó mientras se guardaba.')
  const future = JSON.parse(text[0])
  future.migrations.push('29990101000000_del_futuro')
  check('copia de una versión más nueva: se rechaza', await fails(() => restoreBackup(client, save('futura.ccbackup', [JSON.stringify(future), ...text.slice(1)]))), 'Esa copia es de una versión más nueva de CompCounter. Actualizá el programa para restaurarla.')
  writeFileSync(join(work, 'otra-cosa.ccbackup'), gzipSync('{"hola":1}\n{"end":true,"rows":0}\n'))
  check('archivo que no es una copia: se rechaza', await fails(() => restoreBackup(client, join(work, 'otra-cosa.ccbackup'))), 'Ese archivo no es una copia de seguridad de CompCounter.')
  writeFileSync(join(work, 'texto.ccbackup'), 'esto no es gzip')
  check('archivo cualquiera: se rechaza', await fails(() => restoreBackup(client, join(work, 'texto.ccbackup'))), 'La copia está dañada o incompleta: no se pudo leer.')

  const broken = text.map((line) => (line.includes('"t":"ScoreEvent"') && line.includes('"id":"s700"') ? line.replace('"value":1', '"value":"muchos"') : line))
  check('falla a mitad de la restauración: avisa', (await fails(() => restoreBackup(client, save('rota.ccbackup', broken)))).includes('muchos'), true)
  check('después de todos los rechazos la base sigue intacta', await dump(client) === before, true)

  const header = JSON.parse(text[0])
  header.tables.Match = header.tables.Match.filter((column) => column !== 'customRules' && column !== 'dqAt')
  header.migrations = header.migrations.slice(0, -1)
  const old = [JSON.stringify(header), ...text.slice(1)]
  await restoreBackup(client, save('vieja.ccbackup', old))
  const defaults = await client.query(`SELECT "customRules", "dqAt", "status" FROM "Match"`)
  check('copia de una versión anterior: las columnas nuevas toman su valor por defecto', defaults.rows[0], { customRules: false, dqAt: null, status: 'LIVE' })

  await restoreBackup(client, copy)
  check('el contador de cambios detecta escrituras', (await changeCounter(client)) !== counter, true)
  await client.end()
  await database.stop()

  const partial = join(work, 'migraciones')
  cpSync(realMigrations, partial, { recursive: true })
  rmSync(join(partial, '20261116120000_sanciones_configurables'), { recursive: true })
  const second = { ...options, dataDir: join(work, 'datos-2') }
  database = await startDatabase({ ...second, migrationsDir: partial })
  client = await database.connect()
  await client.query(`INSERT INTO "Tournament" ("id", "orgId", "name", "slug") VALUES ('viejo', 'local-org', 'Torneo de la versión anterior', 'viejo')`)
  await client.end()
  await database.stop()

  let upgraded = null
  database = await startDatabase({
    ...second,
    migrationsDir: realMigrations,
    beforeUpgrade: async (connection) => {
      upgraded = await createBackup(connection, join(work, 'previa.ccbackup'), 'vieja')
    },
  })
  client = await database.connect()
  check('actualización: se guarda una copia antes de cambiar la base', upgraded?.rows, 3)
  check('actualización: los datos siguen y la base queda al día', (await client.query(`SELECT t."name", (SELECT count(*)::int FROM information_schema.columns WHERE table_name = 'Match' AND column_name = 'customRules') AS nueva FROM "Tournament" t`)).rows[0], { name: 'Torneo de la versión anterior', nueva: 1 })
  await restoreBackup(client, join(work, 'previa.ccbackup'))
  check('actualización: la copia previa se puede restaurar en la versión nueva', (await client.query(`SELECT "name" FROM "Tournament"`)).rows[0].name, 'Torneo de la versión anterior')
} finally {
  await client.end().catch(() => {})
  await database.stop()
  rmSync(work, { recursive: true, force: true })
}

if (failed) {
  console.error(`\n${failed} pruebas fallaron`)
  process.exit(1)
}
console.log('\nTodas las pruebas de copia y restauración pasaron')
