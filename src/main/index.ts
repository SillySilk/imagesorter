import { app, BrowserWindow, ipcMain, dialog, protocol, shell, Menu, clipboard, nativeImage, net } from 'electron'
import { join, extname } from 'path'
import { pathToFileURL } from 'url'
import { statSync } from 'fs'
import { ConfigManager, DEFAULT_CONFIG, VALID_ACTIONS } from './config'
import { RecursiveScanner } from './scanner'
import { moveFile, copyFile, deleteFile } from './fileOps'
import { getImageMetadata, getThumbnail, getHistogram } from './imageInfo'

let configManager: ConfigManager

const MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp',
  '.svg', '.avif', '.heic', '.heif', '.mp4', '.webm', '.mov', '.avi', '.mkv'
])

// Formats Chromium can't decode natively but sharp can — transcode these to
// PNG on the fly so they display in an <img>. (PSD/RAW are unsupported by
// sharp and intentionally left to fail rather than fake support.)
const TRANSCODE_EXTS = new Set(['.heic', '.heif', '.tif', '.tiff'])

// The aperture:// scheme must be registered as privileged before app-ready so
// it can stream video and act as a secure context for <img>/fetch.
protocol.registerSchemesAsPrivileged([
  { scheme: 'aperture', privileges: { secure: true, stream: true, bypassCSP: true, supportFetchAPI: true } }
])

function extractFilePath(argv: string[]): string | null {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('-') || arg === '.') continue
    try {
      const stat = statSync(arg)
      if (stat.isFile() && MEDIA_EXTS.has(extname(arg).toLowerCase())) return arg
    } catch { /* not a valid path */ }
  }
  return null
}

let pendingFilePath: string | null = extractFilePath(process.argv)

// Single instance lock — focus existing window if already running
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}
app.on('second-instance', (_event, argv) => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
    const filePath = extractFilePath(argv)
    if (filePath) win.webContents.send('app:openFile', filePath)
  }
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0c080d',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: join(__dirname, '../../resources/icon.ico')
  })

  win.on('ready-to-show', () => { win.show(); win.maximize() })

  // Custom protocol for serving local image/video files. HEIC/HEIF/TIFF are
  // transcoded to PNG via sharp (with EXIF orientation applied); everything
  // else is streamed straight from disk so Chromium handles it natively.
  protocol.handle('aperture', async (request) => {
    const filePath = decodeURIComponent(request.url.slice('aperture://'.length))
    if (TRANSCODE_EXTS.has(extname(filePath).toLowerCase())) {
      try {
        const sharp = (await import('sharp')).default
        const buf = await sharp(filePath).rotate().png().toBuffer()
        return new Response(buf, { headers: { 'content-type': 'image/png' } })
      } catch (e) {
        console.warn('Transcode failed, serving raw:', filePath, e)
      }
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  configManager = new ConfigManager()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ===== IPC Handlers =====

ipcMain.handle('config:load', () => configManager.config)

ipcMain.handle('config:save', (_e, config) => {
  const ok = configManager.save(config)
  return { ok }
})

ipcMain.handle('config:reset', () => DEFAULT_CONFIG)

ipcMain.handle('config:path', () => configManager.getConfigPath())

ipcMain.handle('config:valid-actions', () => Array.from(VALID_ACTIONS))

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images & Videos', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'avif', 'heic', 'heif', 'mp4', 'webm', 'mov', 'avi', 'mkv'] }]
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:confirm', async (_e, { title, message, detail }: { title: string; message: string; detail?: string }) => {
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showMessageBox(win!, {
    type: 'question',
    buttons: ['Cancel', 'Confirm'],
    defaultId: 1,
    cancelId: 0,
    title,
    message,
    detail
  })
  return result.response === 1
})

ipcMain.handle('scanner:scan', (_e, { dir, recursive, fileTypes }: { dir: string; recursive: boolean; fileTypes: string[] }) => {
  return RecursiveScanner.scan(dir, recursive, fileTypes)
})

ipcMain.handle('file:move', (_e, { src, destDir }: { src: string; destDir: string }) => moveFile(src, destDir))

ipcMain.handle('file:copy', (_e, { src, destDir }: { src: string; destDir: string }) => copyFile(src, destDir))

ipcMain.handle('file:delete', (_e, { filePath }: { filePath: string }) => deleteFile(filePath))

ipcMain.handle('image:metadata', (_e, { filePath }: { filePath: string }) => getImageMetadata(filePath))

ipcMain.handle('image:thumbnail', (_e, { filePath, width, height }: { filePath: string; width: number; height: number }) =>
  getThumbnail(filePath, width, height)
)

ipcMain.handle('image:histogram', (_e, { filePath }: { filePath: string }) => getHistogram(filePath))

ipcMain.handle('shell:showInExplorer', (_e, { filePath }: { filePath: string }) => shell.showItemInFolder(filePath))

ipcMain.handle('shell:openExternal', (_e, { filePath }: { filePath: string }) => shell.openPath(filePath))

ipcMain.handle('shell:contextMenu', (_e, { filePath }: { filePath: string }) => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return
  const menu = Menu.buildFromTemplate([
    {
      label: 'Show in Explorer',
      click: () => shell.showItemInFolder(filePath)
    },
    {
      label: 'Open with Default App',
      click: () => shell.openPath(filePath)
    },
    { type: 'separator' },
    {
      label: 'Copy File Path',
      click: () => { clipboard.writeText(filePath) }
    }
  ])
  menu.popup({ window: win })
})

ipcMain.handle('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.handle('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.handle('window:close', () => BrowserWindow.getFocusedWindow()?.close())

ipcMain.handle('upscale:process', async (_e, {
  filePath, scale, kernel, outputFormat, destDir
}: { filePath: string; scale: 2 | 3 | 4; kernel: string; outputFormat: 'source' | 'png' | 'jpeg'; destDir: string | null }) => {
  try {
    const sharp = (await import('sharp')).default
    const { join, dirname, basename, extname } = await import('path')

    const meta = await sharp(filePath).metadata()
    const newWidth = (meta.width || 0) * scale
    const newHeight = (meta.height || 0) * scale

    const origExt = extname(filePath)
    const origBase = basename(filePath, origExt)
    const ext = outputFormat === 'png' ? '.png' : outputFormat === 'jpeg' ? '.jpg' : origExt
    const outName = `${origBase}_${scale}x${ext}`
    const outDir = destDir || dirname(filePath)
    const outputPath = join(outDir, outName)

    let pipeline = sharp(filePath).resize(newWidth, newHeight, { kernel: kernel as any, fit: 'fill' })
    if (outputFormat === 'png') pipeline = pipeline.png({ compressionLevel: 8 })
    else if (outputFormat === 'jpeg') pipeline = pipeline.jpeg({ quality: 95 })

    await pipeline.toFile(outputPath)
    return { ok: true, outputPath }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.handle('image:copyToClipboard', async (_e, { filePath }: { filePath: string }) => {
  try {
    const sharp = (await import('sharp')).default
    const buffer = await sharp(filePath).png().toBuffer()
    clipboard.writeImage(nativeImage.createFromBuffer(buffer))
    return { ok: true }
  } catch {
    try {
      clipboard.writeImage(nativeImage.createFromPath(filePath))
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }
})

ipcMain.handle('image:copyRegion', async (_e, { filePath, x, y, width, height }: { filePath: string; x: number; y: number; width: number; height: number }) => {
  try {
    const sharp = (await import('sharp')).default
    const buffer = await sharp(filePath)
      .extract({ left: x, top: y, width, height })
      .png()
      .toBuffer()
    clipboard.writeImage(nativeImage.createFromBuffer(buffer))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.handle('app:version', () => app.getVersion())

ipcMain.handle('app:getPendingFile', () => {
  const f = pendingFilePath
  pendingFilePath = null
  return f
})
