import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const from = join(process.cwd(), 'node_modules', 'flag-icons', 'flags', '4x3')
const to = join(process.cwd(), 'public', 'flags')

if (existsSync(from)) {
  mkdirSync(to, { recursive: true })
  cpSync(from, to, { recursive: true })
}
