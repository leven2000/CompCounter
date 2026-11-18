import { app, BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(dirname(fileURLToPath(import.meta.url))), 'build', 'icon.png')
const html = `<body style="margin:0;background:transparent">
  <div style="width:512px;height:512px;border-radius:104px;background:#b91c1c;display:flex;align-items:center;justify-content:center;font:900 330px 'Segoe UI',Arial,sans-serif;color:#fff">C</div>
</body>`

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  })
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 400))
  const image = await window.webContents.capturePage()
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, image.resize({ width: 512, height: 512 }).toPNG())
  app.quit()
})
