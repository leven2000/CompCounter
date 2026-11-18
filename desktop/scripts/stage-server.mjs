import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktop = dirname(dirname(fileURLToPath(import.meta.url)))
const root = dirname(desktop)
const standalone = join(root, '.next', 'standalone')
const out = join(desktop, 'app-server')

if (!existsSync(join(standalone, 'server.js'))) {
  console.error('Falta .next/standalone. Corré antes el build con COMPCOUNTER_DESKTOP=1.')
  process.exit(1)
}

const skip = (path) => {
  const name = basename(path)
  return name.startsWith('.env') || /\.tmp\d*$/.test(name) || /^query_(engine|compiler)_bg\./.test(name)
}

rmSync(out, { recursive: true, force: true })
cpSync(standalone, out, { recursive: true, dereference: true, filter: (source) => !skip(source) })
cpSync(join(root, '.next', 'static'), join(out, '.next', 'static'), { recursive: true })
cpSync(join(root, 'public'), join(out, 'public'), { recursive: true })
cpSync(join(root, 'prisma', 'migrations'), join(out, 'migrations'), { recursive: true })

const leaked = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name.startsWith('.env')) leaked.push(path)
    else if (statSync(path).isDirectory() && name !== 'node_modules') walk(path)
  }
}
walk(out)
if (leaked.length > 0) {
  console.error(`Quedaron archivos de entorno en la salida:\n${leaked.join('\n')}`)
  process.exit(1)
}

console.log('Servidor preparado en desktop/app-server')
