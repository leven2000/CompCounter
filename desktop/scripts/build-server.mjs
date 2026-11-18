import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

const build = spawnSync('npm run build', {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, COMPCOUNTER_DESKTOP: '1', NEXT_TELEMETRY_DISABLED: '1' },
})
if (build.status !== 0) process.exit(build.status ?? 1)

await import('./stage-server.mjs')
