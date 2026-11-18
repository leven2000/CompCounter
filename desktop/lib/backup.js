import { once } from 'node:events'
import { createReadStream, createWriteStream, renameSync, rmSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { pipeline } from 'node:stream/promises'
import { createGunzip, createGzip } from 'node:zlib'
import { checkHeader, FORMAT } from './backup-core.js'

const ident = (name) => `"${String(name).replaceAll('"', '""')}"`

async function listTables(client) {
  const result = await client.query(`
    SELECT c.relname AS name,
      ARRAY(
        SELECT a.attname::text FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
      ) AS columns,
      ARRAY(
        SELECT a.attname::text
        FROM pg_index i
        CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, position)
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
        WHERE i.indrelid = c.oid AND i.indisprimary
        ORDER BY k.position
      ) AS key,
      EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.atttypid = 'bytea'::regtype
      ) AS heavy
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
    ORDER BY c.relname`)
  return result.rows
}

async function appliedMigrations(client) {
  const result = await client.query(
    'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL ORDER BY "migration_name"',
  )
  return result.rows.map((row) => row.migration_name)
}

export async function changeCounter(client) {
  const result = await client.query(
    'SELECT COALESCE(sum(n_tup_ins + n_tup_upd + n_tup_del), 0)::text AS total FROM pg_stat_user_tables',
  )
  return result.rows[0].total
}

export async function createBackup(client, file, app) {
  const temp = `${file}.tmp`
  const gzip = createGzip({ level: 6 })
  const written = pipeline(gzip, createWriteStream(temp))
  written.catch(() => {})
  const write = async (line) => {
    if (!gzip.write(`${line}\n`)) await once(gzip, 'drain')
  }
  let rows = 0
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    try {
      const tables = await listTables(client)
      await write(
        JSON.stringify({
          format: FORMAT,
          version: 1,
          createdAt: new Date().toISOString(),
          app,
          migrations: await appliedMigrations(client),
          tables: Object.fromEntries(tables.map((table) => [table.name, table.columns])),
        }),
      )
      for (const table of tables) {
        const order = table.key.length > 0 ? table.key.map(ident).join(', ') : '1'
        const size = table.heavy ? 10 : 500
        for (let offset = 0; ; offset += size) {
          const page = await client.query(
            `SELECT row_to_json(t)::text AS row FROM ${ident(table.name)} t ORDER BY ${order} LIMIT ${size} OFFSET ${offset}`,
          )
          for (const item of page.rows) await write(`{"t":${JSON.stringify(table.name)},"r":${item.row}}`)
          rows += page.rows.length
          if (page.rows.length < size) break
        }
      }
      await write(JSON.stringify({ end: true, rows }))
    } finally {
      await client.query('ROLLBACK').catch(() => {})
    }
    gzip.end()
    await written
    renameSync(temp, file)
  } catch (error) {
    gzip.destroy()
    rmSync(temp, { force: true })
    throw error
  }
  return { rows }
}

async function* lines(file) {
  const reader = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity })
  for await (const line of reader) if (line) yield line
}

export async function inspectBackup(file) {
  let header = null
  let rows = 0
  let ended = false
  const tables = {}
  try {
    for await (const line of lines(file)) {
      const item = JSON.parse(line)
      if (!header) {
        header = item
        continue
      }
      if (item.end) {
        ended = item.rows === rows
        continue
      }
      if (typeof item.t !== 'string' || !item.r || typeof item.r !== 'object') throw new Error('fila inválida')
      tables[item.t] = (tables[item.t] ?? 0) + 1
      rows += 1
    }
  } catch {
    throw new Error('La copia está dañada o incompleta: no se pudo leer.')
  }
  if (!header || header.format !== FORMAT) throw new Error('Ese archivo no es una copia de seguridad de CompCounter.')
  if (!ended) throw new Error('La copia está incompleta: se cortó mientras se guardaba.')
  return { header, rows, tables }
}

export async function restoreBackup(client, file) {
  const info = await inspectBackup(file)
  const problem = checkHeader(info.header, await appliedMigrations(client))
  if (problem) throw new Error(problem)

  const current = await listTables(client)
  const byName = new Map(current.map((table) => [table.name, table]))
  const columnsOf = (name) => {
    const saved = new Set(Array.isArray(info.header.tables[name]) ? info.header.tables[name] : [])
    return byName.get(name).columns.filter((column) => saved.has(column))
  }

  await client.query('BEGIN')
  try {
    await client.query("SET LOCAL session_replication_role = 'replica'")
    if (current.length > 0) {
      await client.query(`TRUNCATE TABLE ${current.map((table) => ident(table.name)).join(', ')} CASCADE`)
    }
    const pending = new Map()
    const flush = async (name) => {
      const batch = pending.get(name)
      if (!batch || batch.rows.length === 0) return
      const columns = columnsOf(name).map(ident).join(', ')
      if (columns) {
        await client.query(
          `INSERT INTO ${ident(name)} (${columns}) SELECT ${columns} FROM json_populate_recordset(null::${ident(name)}, $1::json)`,
          [`[${batch.rows.join(',')}]`],
        )
      }
      pending.set(name, { rows: [], bytes: 0 })
    }
    let first = true
    for await (const line of lines(file)) {
      if (first) {
        first = false
        continue
      }
      const item = JSON.parse(line)
      if (item.end || !byName.has(item.t)) continue
      const batch = pending.get(item.t) ?? { rows: [], bytes: 0 }
      const text = JSON.stringify(item.r)
      batch.rows.push(text)
      batch.bytes += text.length
      pending.set(item.t, batch)
      if (batch.rows.length >= 200 || batch.bytes > 8_000_000) await flush(item.t)
    }
    for (const name of pending.keys()) await flush(name)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
  return info
}
