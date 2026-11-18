import { execFile, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'

const USER = 'compcounter'
const DATABASE = 'compcounter'
export const LOCAL_ORG = 'local-org'
export const LOCAL_USER = 'local-user'

const run = (file, args) =>
  new Promise((resolve) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      resolve({ ok: !error, output: `${stdout}${stderr}` })
    })
  })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function initialise(initdb, dir, password, log) {
  const passwordFile = join(tmpdir(), `compcounter-${randomUUID()}`)
  writeFileSync(passwordFile, `${password}\n`)
  try {
    const result = await run(initdb, [
      `--pgdata=${dir}`,
      '--auth=scram-sha-256',
      `--username=${USER}`,
      `--pwfile=${passwordFile}`,
      '--encoding=UTF8',
      '--locale-provider=icu',
      '--icu-locale=es',
      '--locale=C',
      '--lc-messages=C',
    ])
    log(result.output)
    if (!result.ok) throw new Error(`No se pudo crear la base local.\n${result.output.slice(-600)}`)
  } finally {
    rmSync(passwordFile, { force: true })
  }
}

async function connect(port, password, database) {
  const client = new pg.Client({ host: '127.0.0.1', port, user: USER, password, database })
  client.on('error', () => {})
  await client.connect()
  return client
}

async function waitReady(port, password, child, tail) {
  const deadline = Date.now() + 90_000
  let last = ''
  while (Date.now() < deadline) {
    if (child.exitCode != null) break
    try {
      return await connect(port, password, 'postgres')
    } catch (error) {
      last = String(error?.message ?? error)
      await sleep(250)
    }
  }
  throw new Error(`La base local no arrancó.\n${tail().slice(-600) || last}`)
}

async function migrate(client, migrationsDir, log, beforeUpgrade) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`)
  const done = await client.query(
    'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL',
  )
  const applied = new Set(done.rows.map((row) => row.migration_name))
  const names = readdirSync(migrationsDir)
    .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
    .sort()
  const pending = names.filter((name) => !applied.has(name))
  if (pending.length > 0 && applied.size > 0 && beforeUpgrade) await beforeUpgrade(client)
  for (const name of pending) {
    const sql = readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8')
    log(`Aplicando migración ${name}`)
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query(
        'INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count") VALUES ($1, $2, $3, now(), 1)',
        [randomUUID(), createHash('sha256').update(sql).digest('hex'), name],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw new Error(`Falló la migración ${name}: ${error.message}`)
    }
  }
}

async function ensureLocalUser(client) {
  await client.query(
    `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt") VALUES ($1, 'CompCounter', 'local', now())
     ON CONFLICT ("id") DO NOTHING`,
    [LOCAL_ORG],
  )
  await client.query(
    `INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "orgId")
     VALUES ($1, 'local@compcounter.invalid', 'Organizador', '!', 'ORGANIZER', $2)
     ON CONFLICT ("id") DO NOTHING`,
    [LOCAL_USER, LOCAL_ORG],
  )
}

export async function startDatabase({ binDir, dataDir, password, migrationsDir, log, beforeUpgrade }) {
  const initdb = join(binDir, 'initdb.exe')
  const pg_ctl = join(binDir, 'pg_ctl.exe')
  const postgres = join(binDir, 'postgres.exe')
  const dir = join(dataDir, 'base')
  const marker = join(dataDir, 'base-lista')

  if (existsSync(dir) && !existsSync(marker)) {
    renameSync(dir, join(dataDir, `base-incompleta-${Date.now()}`))
  }
  if (!existsSync(dir)) {
    await initialise(initdb, dir, password, log)
    writeFileSync(marker, new Date().toISOString())
  } else if (existsSync(join(dir, 'postmaster.pid'))) {
    await run(pg_ctl, ['stop', '-D', dir, '-m', 'fast', '-w', '-t', '20'])
  }

  const port = await freePort()
  let output = ''
  const child = spawn(postgres, ['-D', dir, '-p', String(port), '-c', 'listen_addresses=127.0.0.1'], {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  })
  child.stderr.on('data', (chunk) => {
    output = `${output}${chunk}`.slice(-4000)
    log(String(chunk))
  })

  const stop = async () => {
    if (child.exitCode != null) return
    const exited = new Promise((resolve) => child.once('exit', resolve))
    await run(pg_ctl, ['stop', '-D', dir, '-m', 'fast', '-w', '-t', '20'])
    const closed = await Promise.race([exited.then(() => true), sleep(3000).then(() => false)])
    if (!closed && child.pid) await run('taskkill', ['/pid', String(child.pid), '/f', '/t'])
  }

  try {
    const admin = await waitReady(port, password, child, () => output)
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DATABASE])
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${DATABASE}"`)
    await admin.end()

    const client = await connect(port, password, DATABASE)
    try {
      await migrate(client, migrationsDir, log, beforeUpgrade)
      await ensureLocalUser(client)
    } finally {
      await client.end()
    }
  } catch (error) {
    await stop()
    throw error
  }

  return {
    url: `postgresql://${USER}:${password}@127.0.0.1:${port}/${DATABASE}`,
    userId: LOCAL_USER,
    connect: () => connect(port, password, DATABASE),
    stop,
  }
}
