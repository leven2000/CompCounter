import { utilityProcess } from 'electron'
import { createHmac } from 'node:crypto'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { freePort } from './database.js'

const PREFERRED_PORT = 47615

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isFree(port) {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })
}

async function choosePort() {
  for (let port = PREFERRED_PORT; port < PREFERRED_PORT + 10; port++) {
    if (await isFree(port)) return port
  }
  return freePort()
}

export function sessionToken(secret, userId) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${encode({ alg: 'HS256' })}.${encode({ uid: userId, iat: now, exp: now + 400 * 86_400 })}`
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`
}

export async function startServer({ dir, env, log }) {
  const port = await choosePort()
  const origin = `http://127.0.0.1:${port}`
  let output = ''
  const child = utilityProcess.fork(join(dir, 'server.js'), [], {
    cwd: dir,
    stdio: 'pipe',
    serviceName: 'CompCounter',
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      COMPCOUNTER_DESKTOP: '1',
    },
  })
  let exited = false
  child.once('exit', () => {
    exited = true
  })
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on('data', (chunk) => {
      output = `${output}${chunk}`.slice(-4000)
      log(String(chunk))
    })
  }

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline && !exited) {
    try {
      const response = await fetch(`${origin}/api/desktop/ping`, {
        headers: { 'x-compcounter-key': env.COMPCOUNTER_DESKTOP_KEY },
        signal: AbortSignal.timeout(2000),
      })
      if (response.ok) return { origin, child, stop: () => child.kill() }
    } catch {}
    await sleep(200)
  }
  child.kill()
  throw new Error(`La aplicación no arrancó.\n${output.slice(-600)}`)
}
