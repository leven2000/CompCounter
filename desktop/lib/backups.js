import { app, dialog, shell } from 'electron'
import { accessSync, constants, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, parse, resolve } from 'node:path'
import { changeCounter, createBackup, inspectBackup, restoreBackup } from './backup.js'
import { expired, EXTENSION, fileName, overBudget } from './backup-core.js'

const FIRST_CHECK = 60_000
const INTERVAL = 5 * 60_000
const SLOW_INTERVAL = 20 * 60_000
const HEAVY_BYTES = 100_000_000
const SLOW_MS = 20_000
const BUDGET_BYTES = 2_000_000_000

export function createBackups({ connect, config, save, log, stopServer }) {
  const fallback = join(app.getPath('documents'), 'CompCounter', 'Copias de seguridad')
  const state = { lastAt: null, lastFile: null, error: null, busy: false }
  let counter = null
  let timer = null
  let heavy = false
  let queue = Promise.resolve()

  const folder = () => config.backupDir || fallback
  const disk = (path) => parse(resolve(path)).root.toLowerCase()
  const status = () => ({
    dir: folder(),
    isDefault: !config.backupDir,
    sameDisk: disk(folder()) === disk(app.getPath('userData')),
    ...state,
  })

  const usable = (dir) => {
    try {
      mkdirSync(dir, { recursive: true })
      accessSync(dir, constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  async function copy(kind, given) {
    const client = given ?? (await connect())
    try {
      let dir = folder()
      let warning = null
      if (!usable(dir)) {
        warning = `No se pudo guardar en ${dir}. La copia quedó en ${fallback}.`
        dir = fallback
        mkdirSync(dir, { recursive: true })
      }
      const file = join(dir, fileName(new Date(), kind))
      const before = await changeCounter(client)
      const started = Date.now()
      await createBackup(client, file, app.getVersion())
      counter = before
      heavy = statSync(file).size > HEAVY_BYTES || Date.now() - started > SLOW_MS
      Object.assign(state, { lastAt: Date.now(), lastFile: file, error: warning })
      const old = new Set(expired(readdirSync(dir), Date.now()))
      const rest = readdirSync(dir)
        .filter((name) => name.endsWith(EXTENSION) && !old.has(name))
        .map((name) => ({ name, size: statSync(join(dir, name)).size }))
      for (const name of [...old, ...overBudget(rest, BUDGET_BYTES)]) rmSync(join(dir, name), { force: true })
      return file
    } catch (error) {
      state.error = `No se pudo hacer la copia de seguridad: ${error.message}`
      log(state.error)
      throw error
    } finally {
      if (!given) await client.end().catch(() => {})
    }
  }

  const enqueue = (task) => {
    const run = queue.then(async () => {
      state.busy = true
      try {
        return await task()
      } finally {
        state.busy = false
      }
    })
    queue = run.catch(() => {})
    return run
  }

  async function ifChanged() {
    const client = await connect()
    try {
      if ((await changeCounter(client)) === counter) return null
      return await copy('auto', client)
    } finally {
      await client.end().catch(() => {})
    }
  }

  const schedule = (ms) => {
    timer = setTimeout(() => {
      enqueue(ifChanged)
        .catch(() => {})
        .finally(() => schedule(heavy ? SLOW_INTERVAL : INTERVAL))
    }, ms)
  }

  async function restoreFile(file, { withoutSafetyCopy = false } = {}) {
    if (!withoutSafetyCopy) await enqueue(() => copy('previa'))
    clearTimeout(timer)
    await stopServer()
    let failure = null
    await enqueue(async () => {
      const client = await connect()
      try {
        await restoreBackup(client, file)
      } catch (error) {
        failure = error
      } finally {
        await client.end().catch(() => {})
      }
    })
    if (failure) log(`No se pudo restaurar ${file}: ${failure.message}`)
    else log(`Copia restaurada: ${file}`)
    return failure
  }

  async function restore(window) {
    const picked = await dialog.showOpenDialog(window, {
      title: 'Restaurar una copia de seguridad',
      defaultPath: folder(),
      properties: ['openFile'],
      filters: [{ name: 'Copias de CompCounter', extensions: ['ccbackup'] }],
    })
    if (picked.canceled || !picked.filePaths[0]) return { ok: false }
    const file = picked.filePaths[0]
    let info
    try {
      info = await inspectBackup(file)
    } catch (error) {
      dialog.showMessageBoxSync(window, { type: 'error', title: 'CompCounter', message: error.message })
      return { ok: false, error: error.message }
    }
    const when = new Date(info.header.createdAt).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
    const tournaments = info.tables.Tournament ?? 0
    const answer = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: 'Restaurar una copia de seguridad',
      message: `¿Reemplazar todo lo que hay ahora por la copia del ${when}?`,
      detail: `La copia tiene ${tournaments} ${tournaments === 1 ? 'torneo' : 'torneos'} y ${info.tables.Participant ?? 0} competidores. Lo que hay ahora se guarda antes en otra copia. Al terminar, CompCounter se cierra y vuelve a abrirse.`,
      buttons: ['Cancelar', 'Restaurar'],
      defaultId: 0,
      cancelId: 0,
    })
    if (answer !== 1) return { ok: false }

    let failure
    try {
      failure = await restoreFile(file)
    } catch (error) {
      const proceed = dialog.showMessageBoxSync(window, {
        type: 'warning',
        title: 'CompCounter',
        message: 'No se pudo guardar una copia de lo que hay ahora.',
        detail: `${error.message}\n\n¿Restaurar de todos modos?`,
        buttons: ['Cancelar', 'Restaurar de todos modos'],
        defaultId: 0,
        cancelId: 0,
      })
      if (proceed !== 1) return { ok: false }
      failure = await restoreFile(file, { withoutSafetyCopy: true })
    }
    dialog.showMessageBoxSync({
      type: failure ? 'error' : 'info',
      title: 'CompCounter',
      message: failure ? 'No se pudo restaurar la copia. No se cambió nada.' : 'Copia restaurada.',
      detail: failure ? failure.message : 'CompCounter se va a abrir de nuevo.',
    })
    app.relaunch()
    app.quit()
    return { ok: !failure }
  }

  return {
    status,
    restore,
    restoreFile,
    async start() {
      schedule(FIRST_CHECK)
      const dir = folder()
      const hasCopies = usable(dir) && readdirSync(dir).some((name) => name.endsWith(EXTENSION))
      if (!hasCopies) return
      const client = await connect()
      try {
        counter = await changeCounter(client)
      } finally {
        await client.end().catch(() => {})
      }
    },
    beforeUpgrade: (client) => enqueue(() => copy('previa', client)),
    async now() {
      await enqueue(() => copy('manual')).catch(() => {})
      return status()
    },
    async chooseFolder(window) {
      const picked = await dialog.showOpenDialog(window, {
        title: 'Carpeta para las copias de seguridad',
        defaultPath: folder(),
        properties: ['openDirectory', 'createDirectory'],
      })
      const dir = picked.filePaths[0]
      if (picked.canceled || !dir) return status()
      if (!usable(dir)) {
        state.error = `No se puede escribir en ${dir}.`
        return status()
      }
      config.backupDir = dir
      save()
      await enqueue(() => copy('manual')).catch(() => {})
      return status()
    },
    defaultFolder() {
      config.backupDir = null
      save()
      state.error = null
      return status()
    },
    openFolder() {
      const dir = usable(folder()) ? folder() : fallback
      mkdirSync(dir, { recursive: true })
      void shell.openPath(dir)
    },
    async stop() {
      clearTimeout(timer)
      await Promise.race([
        enqueue(ifChanged).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 20_000)),
      ])
    },
  }
}
