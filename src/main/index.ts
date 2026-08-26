import { app, BrowserWindow, ipcMain, dialog, protocol, shell, Menu, clipboard, nativeImage, net } from 'electron'
import { join, extname, basename, dirname, relative, isAbsolute } from 'path'
import { pathToFileURL } from 'url'
import { statSync, createReadStream, existsSync, mkdirSync } from 'fs'
import { copyFile as fsCopyFile, stat, readFile } from 'fs/promises'
import { Readable } from 'stream'
import { ConfigManager, DEFAULT_CONFIG, VALID_ACTIONS } from './config'
import { RecursiveScanner } from './scanner'
import { moveFile, movePath, copyFile, deleteFile, resolveConflict } from './fileOps'
import { trashFile, restoreFromTrash, trashInfo, emptyTrash } from './trash'
import { getImageMetadata, getThumbnail, getHistogram } from './imageInfo'
import { PSD_EXTS, loadPsdAsSharp } from './psd'

let configManager: ConfigManager

const MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp',
  '.svg', '.avif', '.heic', '.heif', '.psd', '.psb', '.mp4', '.webm', '.mov', '.avi', '.mkv'
])

// Formats Chromium can't decode natively — transcode these to PNG on the fly
// so they display in an <img>. HEIC/TIFF go through sharp directly; PSD/PSB
// go through ag-psd first since sharp/libvips can't read them (see ./psd).
// RAW camera formats are still unsupported and intentionally left to fail
// rather than fake support.
const TRANSCODE_EXTS = new Set(['.heic', '.heif', '.tif', '.tiff', '.psd', '.psb'])

// Video formats are served with HTTP range support so the player can seek.
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv'])
const VIDEO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska'
}

// Images are served from an in-memory buffer (read once, handle closed
// immediately) rather than a lingering file:// fetch. A streamed/cached file
// handle keeps the source file open, which makes a cross-volume "keep" move
// fail at unlink (EPERM) — the file can't be deleted while the viewer holds it.
const IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif', '.svg': 'image/svg+xml'
}

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
  win.webContents.on('context-menu', (e) => { e.preventDefault() })

  // Custom protocol for serving local image/video files. HEIC/HEIF/TIFF are
  // transcoded to PNG via sharp (with EXIF orientation applied); everything
  // else is streamed straight from disk so Chromium handles it natively.
  protocol.handle('aperture', async (request) => {
    const filePath = decodeURIComponent(request.url.slice('aperture://'.length))
    const ext = extname(filePath).toLowerCase()

    if (TRANSCODE_EXTS.has(ext)) {
      try {
        const fileBuf = await readFile(filePath)
        const source = PSD_EXTS.has(ext)
          ? await loadPsdAsSharp(fileBuf)
          : (await import('sharp')).default(fileBuf)
        const buf = await source.rotate().png().toBuffer()
        return new Response(buf, { headers: { 'content-type': 'image/png' } })
      } catch (e) {
        console.warn('Transcode failed, serving raw:', filePath, e)
      }
    }

    // Serve videos with HTTP range support. When the user scrubs the progress
    // bar, Chromium issues a `Range: bytes=…` request for the target slice;
    // without a 206/Accept-Ranges response the <video> is treated as
    // non-seekable beyond what is already buffered. We answer ranges with a
    // streamed partial response so seeking to any point works instantly.
    if (VIDEO_EXTS.has(ext)) {
      try {
        const { size } = await stat(filePath)
        const contentType = VIDEO_MIME[ext] || 'application/octet-stream'
        const rangeHeader = request.headers.get('Range')
        const match = rangeHeader && /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())

        if (match) {
          let start = match[1] ? parseInt(match[1], 10) : 0
          let end = match[2] ? parseInt(match[2], 10) : size - 1
          if (isNaN(start)) start = 0
          if (isNaN(end) || end >= size) end = size - 1
          if (start > end || start >= size) {
            return new Response(null, {
              status: 416,
              headers: { 'content-range': `bytes */${size}` }
            })
          }
          const stream = createReadStream(filePath, { start, end })
          return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 206,
            headers: {
              'content-type': contentType,
              'content-range': `bytes ${start}-${end}/${size}`,
              'accept-ranges': 'bytes',
              'content-length': String(end - start + 1)
            }
          })
        }

        // No range requested: serve the whole file but advertise range support
        // so the player knows it can seek.
        const stream = createReadStream(filePath)
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 200,
          headers: {
            'content-type': contentType,
            'accept-ranges': 'bytes',
            'content-length': String(size)
          }
        })
      } catch (e) {
        console.warn('Video serve failed, falling back:', filePath, e)
      }
    }

    // Serve known image types from a buffer so no file handle lingers (see
    // IMAGE_MIME note). Anything else falls back to a direct file fetch.
    const imgMime = IMAGE_MIME[ext]
    if (imgMime) {
      try {
        const buf = await readFile(filePath)
        return new Response(buf, { headers: { 'content-type': imgMime } })
      } catch (e) {
        console.warn('Image read failed, falling back to fetch:', filePath, e)
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

app.whenReady().then(async () => {
  // Disable libvips' operation cache. By default sharp keeps recently-processed
  // input files open (cached file descriptors), which on Windows blocks
  // deleting/moving them — the Inspector runs sharp on every displayed image
  // for metadata/histogram/thumbnails, so the current file would stay locked
  // and a cross-volume "keep" move failed at unlink with EPERM. With the cache
  // off, sharp releases the handle as soon as each operation finishes.
  try { (await import('sharp')).default.cache(false) } catch (e) { console.warn('sharp.cache(false) failed:', e) }
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

ipcMain.handle('dialog:saveAs', async (_e, { filePath }: { filePath: string }) => {
  const ext = extname(filePath)
  const base = basename(filePath, ext)
  const result = await dialog.showSaveDialog({
    defaultPath: join(dirname(filePath), base + '_copy' + ext),
    filters: [
      { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
      { name: 'PNG', extensions: ['png'] },
      { name: 'WebP', extensions: ['webp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (result.canceled || !result.filePath) return { ok: false }
  const destExt = extname(result.filePath).toLowerCase()
  const srcExt = ext.toLowerCase()
  try {
    const sameFormat = destExt === srcExt || (new Set([destExt, srcExt]).size === 1)
      || (destExt === '.jpg' && srcExt === '.jpeg') || (destExt === '.jpeg' && srcExt === '.jpg')
    if (sameFormat) {
      await fsCopyFile(filePath, result.filePath)
    } else {
      const sharp = (await import('sharp')).default
      await sharp(filePath).rotate().toFile(result.filePath)
    }
    return { ok: true, destPath: result.filePath }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.handle('window:print', async (_e, { filePath }: { filePath: string }) => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return { ok: false }
  try {
    const ext = extname(filePath).toLowerCase()
    const source = PSD_EXTS.has(ext)
      ? await loadPsdAsSharp(await readFile(filePath))
      : (await import('sharp')).default(filePath)
    const buf = await source.rotate().png().toBuffer()
    const b64 = buf.toString('base64')
    const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;background:#fff}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="data:image/png;base64,${b64}"></body></html>`
    const printWin = new BrowserWindow({ show: false, parent: win, webPreferences: { sandbox: false } })
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    printWin.webContents.print({}, () => printWin.close())
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images & Videos', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'avif', 'heic', 'heif', 'psd', 'psb', 'mp4', 'webm', 'mov', 'avi', 'mkv'] }]
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

ipcMain.handle('file:move', (_e, { src, destDir }: { src: string; destDir: string }) => moveFile(src, destDir, configManager.config.options.overwrite_existing))

ipcMain.handle('file:copy', (_e, { src, destDir }: { src: string; destDir: string }) => copyFile(src, destDir))

ipcMain.handle('file:delete', (_e, { filePath }: { filePath: string }) => deleteFile(filePath))

// Recoverable delete — moves to the app-managed trash so Ctrl+Z can undo it.
// The permanent `file:delete` above stays for the explicitly-labelled
// "Delete Permanently" context-menu item.
ipcMain.handle('file:trash', (_e, { filePath }: { filePath: string }) => trashFile(filePath))

ipcMain.handle('file:restore', (_e, { trashId }: { trashId: string }) => restoreFromTrash(trashId))

ipcMain.handle('trash:info', () => trashInfo())

ipcMain.handle('trash:empty', () => emptyTrash())

// Exact-path move, used by undo to put a kept/rejected file back where it was.
// `moveFile` can't do this: it takes a destination directory, and the file may
// have been renamed to `foo_1.jpg` by resolveConflict on the way out.
ipcMain.handle('file:moveTo', (_e, { src, destPath }: { src: string; destPath: string }) =>
  movePath(src, resolveConflict(destPath)))

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
      label: 'Reject (Move to Reject folder)',
      click: () => win.webContents.send('canvas:action', { type: 'reject' })
    },
    {
      label: 'Delete Permanently',
      click: () => win.webContents.send('canvas:action', { type: 'delete' })
    },
    { type: 'separator' },
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

    const origExt = extname(filePath)
    const psdBuf = PSD_EXTS.has(origExt.toLowerCase()) ? await readFile(filePath) : null
    const loadSource = () => psdBuf ? loadPsdAsSharp(psdBuf) : Promise.resolve(sharp(filePath))

    const meta = await (await loadSource()).metadata()
    const newWidth = (meta.width || 0) * scale
    const newHeight = (meta.height || 0) * scale

    const origBase = basename(filePath, origExt)
    // sharp can't write PSD back out — "source" format for a PSD input falls
    // back to PNG instead of failing at toFile() on an unencodable extension.
    const ext = outputFormat === 'png' ? '.png' : outputFormat === 'jpeg' ? '.jpg' : (psdBuf ? '.png' : origExt)
    const outName = `${origBase}_${scale}x${ext}`
    const outDir = destDir || dirname(filePath)
    const outputPath = join(outDir, outName)

    let pipeline = (await loadSource()).resize(newWidth, newHeight, { kernel: kernel as any, fit: 'fill' })
    if (outputFormat === 'png') pipeline = pipeline.png({ compressionLevel: 8 })
    else if (outputFormat === 'jpeg') pipeline = pipeline.jpeg({ quality: 95 })

    await pipeline.toFile(outputPath)
    return { ok: true, outputPath }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

type ConvertFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'
type ConvertResize = { mode: 'none' } | { mode: 'long'; px: number } | { mode: 'pct'; pct: number }

const CONVERT_EXT: Record<ConvertFormat, string> = {
  jpeg: '.jpg', png: '.png', webp: '.webp', avif: '.avif', tiff: '.tif'
}

ipcMain.handle('convert:process', async (_e, {
  filePath, format, quality, resize, stripMetadata, destDir, mirrorFrom
}: {
  filePath: string
  format: ConvertFormat
  quality: number
  resize: ConvertResize
  stripMetadata: boolean
  destDir: string | null
  mirrorFrom?: string | null
}) => {
  try {
    const sharp = (await import('sharp')).default
    const ext = extname(filePath).toLowerCase()

    // Hand sharp the bytes, not the path. sharp(path) holds the source file
    // open while libvips works, and this app moves and deletes those files.
    const buf = await readFile(filePath)
    const loadSource = () => PSD_EXTS.has(ext) ? loadPsdAsSharp(buf) : Promise.resolve(sharp(buf))
    const meta = await (await loadSource()).metadata()

    // .rotate() bakes EXIF orientation into the pixels and drops the orientation
    // tag. Without it, stripping metadata silently rotates the image.
    let pipeline = (await loadSource()).rotate()

    if (resize.mode === 'long' && resize.px > 0) {
      // Square bounding box + 'inside' scales the longest edge to px whichever
      // way the image is oriented.
      pipeline = pipeline.resize({ width: resize.px, height: resize.px, fit: 'inside', withoutEnlargement: true })
    } else if (resize.mode === 'pct' && resize.pct > 0 && resize.pct !== 100) {
      // Orientation 5-8 means .rotate() swaps the axes, so the pre-rotation
      // width is not the width we're scaling. Set width only and let sharp
      // derive height, which preserves aspect either way.
      const swapped = (meta.orientation || 1) >= 5
      const srcW = swapped ? (meta.height || 0) : (meta.width || 0)
      if (srcW > 0) {
        pipeline = pipeline.resize({ width: Math.max(1, Math.round(srcW * resize.pct / 100)) })
      }
    }

    const q = Math.max(1, Math.min(100, Math.round(quality)))
    switch (format) {
      case 'png': pipeline = pipeline.png({ compressionLevel: 9 }); break
      case 'webp': pipeline = pipeline.webp({ quality: q }); break
      case 'avif': pipeline = pipeline.avif({ quality: q }); break
      case 'tiff': pipeline = pipeline.tiff({ quality: q }); break
      default: pipeline = pipeline.jpeg({ quality: q }); break
    }

    // sharp strips metadata by default, so the flag reads inverted here.
    if (!stripMetadata) pipeline = pipeline.withMetadata()

    let outDir = destDir || dirname(filePath)
    // Batch with a custom output dir can mirror the source tree. Guard against
    // a file outside mirrorFrom producing a '..' path that escapes destDir.
    if (destDir && mirrorFrom) {
      const rel = relative(mirrorFrom, dirname(filePath))
      if (rel && !rel.startsWith('..') && !isAbsolute(rel)) outDir = join(destDir, rel)
    }
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

    // resolveConflict guarantees we never overwrite anything — including the
    // source itself when the target format matches the source format.
    const base = basename(filePath, extname(filePath))
    const outputPath = resolveConflict(join(outDir, base + CONVERT_EXT[format]))

    await pipeline.toFile(outputPath)
    const { size } = await stat(outputPath)
    return { ok: true, outputPath, bytes: size }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.handle('image:copyToClipboard', async (_e, { filePath }: { filePath: string }) => {
  try {
    const sharp = (await import('sharp')).default
    const buffer = await sharp(await readFile(filePath)).png().toBuffer()
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
    const buffer = await sharp(await readFile(filePath))
      .extract({ left: x, top: y, width, height })
      .png()
      .toBuffer()
    clipboard.writeImage(nativeImage.createFromBuffer(buffer))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

// Save a cropped region as a new file in destDir, preserving the original's
// format (sharp infers the encoder from the destination extension). Used by the
// sort-mode "extract & reject" crop: the kept region is written here, then the
// renderer rejects the original. Name conflicts get a numeric suffix.
ipcMain.handle('image:saveRegion', async (_e, { filePath, x, y, width, height, destDir }: { filePath: string; x: number; y: number; width: number; height: number; destDir: string }) => {
  try {
    if (!destDir) return { ok: false, error: 'No destination folder configured' }
    const sharp = (await import('sharp')).default
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
    const target = join(destDir, basename(filePath))
    const dest = configManager.config.options.overwrite_existing ? target : resolveConflict(target)
    await sharp(await readFile(filePath)).extract({ left: x, top: y, width, height }).toFile(dest)
    return { ok: true, dest }
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
