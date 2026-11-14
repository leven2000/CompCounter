import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const databaseDir = join(process.cwd(), '.pgdata')
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port: 5433,
  persistent: true,
})

if (!existsSync(join(databaseDir, 'PG_VERSION'))) {
  await pg.initialise()
}
await pg.start()
try {
  await pg.createDatabase('torneos_dev')
} catch {}

console.log('Postgres local listo en el puerto 5433 (Ctrl+C para detenerlo)')

const stop = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
