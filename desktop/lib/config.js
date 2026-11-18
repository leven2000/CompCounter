import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (file) => {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'))
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

const secret = (value, bytes) =>
  typeof value === 'string' && value.length >= bytes ? value : randomBytes(bytes).toString('hex')

export function loadConfig(dir) {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'config.json')
  const backup = join(dir, 'config.respaldo.json')
  const saved = read(file) ?? read(backup) ?? {}
  const config = {
    authSecret: secret(saved.authSecret, 32),
    dbPassword: secret(saved.dbPassword, 24),
    mapping: saved.mapping && typeof saved.mapping === 'object' ? saved.mapping : null,
    backupDir: typeof saved.backupDir === 'string' && saved.backupDir ? saved.backupDir : null,
  }
  const save = () => {
    const temp = `${file}.tmp`
    writeFileSync(temp, JSON.stringify(config, null, 2))
    if (existsSync(file)) copyFileSync(file, backup)
    renameSync(temp, file)
  }
  if (config.authSecret !== saved.authSecret || config.dbPassword !== saved.dbPassword) save()
  return { config, save }
}
