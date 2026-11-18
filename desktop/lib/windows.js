import { app, BrowserWindow, Menu, screen, session, shell } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const preload = join(dirname(dirname(fileURLToPath(import.meta.url))), 'preload.cjs')

const webPreferences = {
  preload,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  backgroundThrottling: false,
}

const isDisplay = (path) => path.startsWith('/tv/') || path.startsWith('/cartelera/')

export function createWindows(origin) {
  let main = null

  const ours = (url) => {
    try {
      return new URL(url).origin === origin
    } catch {
      return false
    }
  }

  const external = (url) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  }

  const options = (url) => {
    const path = new URL(url).pathname
    if (isDisplay(path)) {
      return { width: 1280, height: 720, backgroundColor: '#020617', autoHideMenuBar: true, webPreferences }
    }
    if (path.startsWith('/mesa/')) return { width: 1380, height: 900, backgroundColor: '#f1f5f9', webPreferences }
    return { width: 1240, height: 860, backgroundColor: '#f8fafc', webPreferences }
  }

  const existing = (url) => {
    const target = new URL(url)
    return BrowserWindow.getAllWindows().find((window) => {
      if (window.isDestroyed()) return false
      try {
        const current = new URL(window.webContents.getURL())
        return current.origin === target.origin && current.pathname === target.pathname
      } catch {
        return false
      }
    })
  }

  const focus = (window) => {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  const placeDisplay = (window) => {
    const primary = screen.getPrimaryDisplay().id
    const used = new Set(
      BrowserWindow.getAllWindows()
        .filter((other) => other !== window && !other.isDestroyed() && other.isFullScreen())
        .map((other) => screen.getDisplayMatching(other.getBounds()).id),
    )
    const target = screen.getAllDisplays().find((display) => display.id !== primary && !used.has(display.id))
    if (!target) return
    window.setBounds(target.workArea)
    window.setFullScreen(true)
  }

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (!ours(url)) {
        external(url)
        return { action: 'deny' }
      }
      const open = existing(url)
      if (open) {
        focus(open)
        return { action: 'deny' }
      }
      return { action: 'allow', overrideBrowserWindowOptions: options(url) }
    })
    contents.on('will-navigate', (event, url) => {
      if (ours(url)) return
      event.preventDefault()
      external(url)
    })
    contents.on('did-create-window', (window, details) => {
      if (isDisplay(new URL(details.url).pathname)) placeDisplay(window)
    })
    contents.on('before-input-event', (_inputEvent, input) => {
      if (input.type !== 'keyDown' || input.key !== 'Escape') return
      const window = BrowserWindow.fromWebContents(contents)
      if (window?.isFullScreen()) window.setFullScreen(false)
    })
  })

  const allowed = new Set(['fullscreen', 'clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(allowed.has(permission))
  })

  const openMain = () => {
    if (main && !main.isDestroyed()) {
      focus(main)
      return main
    }
    main = new BrowserWindow({ ...options(`${origin}/panel`), show: false })
    main.once('ready-to-show', () => main.show())
    void main.loadURL(`${origin}/panel`)
    return main
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Archivo',
        submenu: [
          { label: 'Panel principal', accelerator: 'Ctrl+1', click: openMain },
          { label: 'Abrir la carpeta de datos', click: () => void shell.openPath(app.getPath('userData')) },
          { type: 'separator' },
          { label: 'Salir', role: 'quit' },
        ],
      },
      {
        label: 'Ver',
        submenu: [
          { label: 'Pantalla completa', role: 'togglefullscreen', accelerator: 'F11' },
          { label: 'Recargar', role: 'reload' },
          { type: 'separator' },
          { label: 'Acercar', role: 'zoomIn' },
          { label: 'Alejar', role: 'zoomOut' },
          { label: 'Tamaño normal', role: 'resetZoom' },
          ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools' }]),
        ],
      },
      {
        label: 'Edición',
        submenu: [
          { label: 'Deshacer', role: 'undo' },
          { label: 'Rehacer', role: 'redo' },
          { type: 'separator' },
          { label: 'Cortar', role: 'cut' },
          { label: 'Copiar', role: 'copy' },
          { label: 'Pegar', role: 'paste' },
          { label: 'Seleccionar todo', role: 'selectAll' },
        ],
      },
    ]),
  )

  return { openMain }
}
