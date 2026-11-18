const { cpSync, existsSync } = require('node:fs')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  const from = join(context.packager.projectDir, 'app-server', 'node_modules')
  const to = join(context.appOutDir, 'resources', 'app-server', 'node_modules')
  cpSync(from, to, { recursive: true })
  if (!existsSync(join(to, 'next', 'package.json'))) {
    throw new Error('No se copiaron las dependencias del servidor al paquete')
  }
}
