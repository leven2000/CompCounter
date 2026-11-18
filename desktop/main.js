import { app, BrowserWindow, dialog, ipcMain, session } from 'electron'
import { randomBytes, randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './lib/config.js'
import { startControllers } from './lib/controllers.js'
import { startDatabase } from './lib/database.js'
import { sessionToken, startServer } from './lib/server.js'
import { createWindows } from './lib/windows.js'

const here = dirname(fileURLToPath(import.meta.url))

if (process.env.COMPCOUNTER_DATA_DIR) app.setPath('userData', process.env.COMPCOUNTER_DATA_DIR)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const dataDir = app.getPath('userData')
const logFile = join(dataDir, 'registro.log')

function log(message) {
  try {
    appendFileSync(logFile, `${new Date().toISOString()} ${String(message).trimEnd()}\n`)
  } catch {}
}

function splash() {
  const window = new BrowserWindow({
    width: 420,
    height: 220,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#0f172a',
  })
  const html = `<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:#fff;font-family:Segoe UI,sans-serif">
    <div style="font-size:26px;font-weight:700;letter-spacing:.04em">CompCounter</div>
    <div style="margin-top:12px;font-size:14px;opacity:.7">Preparando la base local…</div></body>`
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  window.once('ready-to-show', () => window.show())
  return window
}

let cleanup = async () => {}

async function start() {
  mkdirSync(dataDir, { recursive: true })
  if (existsSync(logFile) && statSync(logFile).size > 5_000_000) writeFileSync(logFile, '')
  log(`Inicio de CompCounter ${app.getVersion()}`)

  const loading = splash()
  const { config, save } = loadConfig(dataDir)
  const serverDir = app.isPackaged ? join(process.resourcesPath, 'app-server') : join(here, 'app-server')
  if (!existsSync(join(serverDir, 'server.js'))) {
    throw new Error('Falta la aplicación compilada (app-server). Corré "npm run server" en la carpeta desktop.')
  }

  const database = await startDatabase({
    binDir: app.isPackaged
      ? join(process.resourcesPath, 'pg', 'bin')
      : join(here, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin'),
    dataDir,
    password: config.dbPassword,
    migrationsDir: join(serverDir, 'migrations'),
    log,
  })
  cleanup = async () => {
    await database.stop()
  }

  const key = randomBytes(32).toString('hex')
  const server = await startServer({
    dir: serverDir,
    log,
    env: {
      DATABASE_URL: database.url,
      AUTH_SECRET: config.authSecret,
      COMPCOUNTER_DESKTOP_KEY: key,
    },
  })

  const { origin } = server
  await session.defaultSession.cookies.set({
    url: origin,
    name: 'session',
    value: sessionToken(config.authSecret, database.userId),
    httpOnly: true,
    sameSite: 'lax',
    expirationDate: Math.floor(Date.now() / 1000) + 400 * 86_400,
  })

  const backendFile = !app.isPackaged && process.env.COMPCOUNTER_FAKE_CONTROLLERS
  const backend = backendFile
    ? (await import('./lib/fake-controllers.js')).createFake(backendFile)
    : (await import('./lib/xinput.js')).createXInput()

  const controllers = startControllers({
    backend,
    savedMapping: config.mapping,
    log,
    saveMapping(mapping) {
      config.mapping = mapping
      save()
    },
    async score(point) {
      const response = await fetch(`${origin}/api/desktop/judge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-compcounter-key': key },
        body: JSON.stringify({ ...point, clientId: randomUUID() }),
        signal: AbortSignal.timeout(4000),
      })
      return response.ok
    },
  })
  cleanup = async () => {
    controllers.stop()
    server.stop()
    await database.stop()
  }

  const trusted = (event) => {
    try {
      return new URL(event.senderFrame?.url ?? '').origin === origin
    } catch {
      return false
    }
  }
  const subscribers = new Map()
  const handle = (channel, fn) => ipcMain.handle(channel, (event, payload) => (trusted(event) ? fn(payload) : null))
  handle('controllers:get', () => controllers.current())
  handle('controllers:assign', (p) =>
    controllers.assign(
      String(p?.areaId ?? ''),
      Math.round(Number(p?.seat)) || 1,
      Array.isArray(p?.exclude) ? p.exclude.map(Number) : [],
    ),
  )
  handle('controllers:capture-button', () => controllers.captureButton())
  handle('controllers:cancel', () => controllers.cancel())
  handle('controllers:unassign', (slot) => controllers.unassign(Number(slot)))
  handle('controllers:set-mapping', (mapping) => controllers.setMapping(mapping))
  handle('controllers:identify', (slot) => controllers.identify(Number(slot)))
  ipcMain.on('controllers:subscribe', (event) => {
    if (!trusted(event) || subscribers.has(event.sender)) return
    const contents = event.sender
    const stop = controllers.subscribe((state) => {
      if (!contents.isDestroyed()) contents.send('controllers:state', state)
    })
    subscribers.set(contents, stop)
    contents.once('destroyed', () => {
      stop()
      subscribers.delete(contents)
    })
  })
  ipcMain.on('controllers:unsubscribe', (event) => {
    subscribers.get(event.sender)?.()
    subscribers.delete(event.sender)
  })

  const windows = createWindows(origin)
  app.on('second-instance', () => windows.openMain())
  const main = windows.openMain()
  main.once('ready-to-show', () => {
    if (!loading.isDestroyed()) loading.close()
  })

  server.child.once('exit', (code) => {
    if (quitting) return
    log(`El servidor terminó solo (código ${code})`)
    dialog.showErrorBox('CompCounter', 'La aplicación se detuvo de forma inesperada. Volvé a abrirla.')
    app.quit()
  })
}

let quitting = false
app.on('before-quit', (event) => {
  if (quitting) return
  quitting = true
  event.preventDefault()
  cleanup()
    .catch((error) => log(`Error al cerrar: ${error?.message ?? error}`))
    .finally(() => app.exit(0))
})
app.on('window-all-closed', () => app.quit())
process.on('uncaughtException', (error) => log(`Error no capturado: ${error?.stack ?? error}`))
process.on('unhandledRejection', (error) => log(`Promesa rechazada: ${error?.stack ?? error}`))

if (!app.requestSingleInstanceLock()) {
  app.exit(0)
} else {
  app
    .whenReady()
    .then(start)
    .catch((error) => {
      log(`No se pudo iniciar: ${error?.stack ?? error}`)
      dialog.showErrorBox('CompCounter no pudo iniciar', String(error?.message ?? error))
      quitting = true
      cleanup().finally(() => app.exit(1))
    })
}
