import { app, BrowserWindow, ipcMain, dialog, protocol, shell, Menu } from 'electron'
import { join } from 'path'
import { ConfigManager, DEFAULT_CONFIG, VALID_ACTIONS } from './config'
import { RecursiveScanner } from './scanner'
import { moveFile, copyFile, deleteFile } from './fileOps'
import { getImageMetadata, getThumbnail, getHistogram } from './imageInfo'

let configManager: ConfigManager

// Single instance lock — focus existing window if already running
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) { if (win.isMinimized()) win.restore(); win.focus() }
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

  // Custom protocol for serving local image/video files
  protocol.registerFileProtocol('aperture', (request, callback) => {
    const url = request.url.replace('aperture://', '')
    try {
      callback({ path: decodeURIComponent(url) })
    } catch {
      callback({ error: -2 })
    }
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
      click: () => {
        const { clipboard } = require('electron')
        clipboard.writeText(filePath)
      }
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

ipcMain.handle('app:version', () => app.getVersion())
