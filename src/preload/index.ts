import { contextBridge, ipcRenderer } from 'electron'
import type { Config } from '../main/config'
import type { FileInfo } from '../main/scanner'
import type { TrashEntry } from '../main/trash'

export type ConvertFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'
export type ConvertResize = { mode: 'none' } | { mode: 'long'; px: number } | { mode: 'pct'; pct: number }

const api = {
  config: {
    load: (): Promise<Config> => ipcRenderer.invoke('config:load'),
    save: (config: Config): Promise<{ ok: boolean }> => ipcRenderer.invoke('config:save', config),
    reset: (): Promise<Config> => ipcRenderer.invoke('config:reset'),
    path: (): Promise<string> => ipcRenderer.invoke('config:path'),
    validActions: (): Promise<string[]> => ipcRenderer.invoke('config:valid-actions')
  },
  dialog: {
    openFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile'),
    openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
    saveAs: (opts: { filePath: string }): Promise<{ ok: boolean; destPath?: string; error?: string }> =>
      ipcRenderer.invoke('dialog:saveAs', opts),
    confirm: (opts: { title: string; message: string; detail?: string }): Promise<boolean> =>
      ipcRenderer.invoke('dialog:confirm', opts)
  },
  scanner: {
    scan: (opts: { dir: string; recursive: boolean; fileTypes: string[] }): Promise<FileInfo[]> =>
      ipcRenderer.invoke('scanner:scan', opts)
  },
  file: {
    move: (opts: { src: string; destDir: string }): Promise<{ ok: boolean; dest?: string; error?: string }> =>
      ipcRenderer.invoke('file:move', opts),
    copy: (opts: { src: string; destDir: string }): Promise<{ ok: boolean; dest?: string; error?: string }> =>
      ipcRenderer.invoke('file:copy', opts),
    delete: (opts: { filePath: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('file:delete', opts),
    /** Recoverable delete into the app-managed trash. Undoable via file.restore. */
    trash: (opts: { filePath: string }): Promise<{ ok: boolean; entry?: TrashEntry; error?: string }> =>
      ipcRenderer.invoke('file:trash', opts),
    restore: (opts: { trashId: string }): Promise<{ ok: boolean; restoredPath?: string; error?: string }> =>
      ipcRenderer.invoke('file:restore', opts),
    /** Exact-path move — undo needs this because the file may have been
     * renamed to `foo_1.jpg` on its way out. */
    moveTo: (opts: { src: string; destPath: string }): Promise<{ ok: boolean; dest?: string; error?: string }> =>
      ipcRenderer.invoke('file:moveTo', opts)
  },
  trash: {
    info: (): Promise<{ count: number; bytes: number }> => ipcRenderer.invoke('trash:info'),
    empty: (): Promise<{ ok: boolean; count: number; failed: number }> => ipcRenderer.invoke('trash:empty')
  },
  image: {
    metadata: (opts: { filePath: string }) => ipcRenderer.invoke('image:metadata', opts),
    thumbnail: (opts: { filePath: string; width: number; height: number }): Promise<string> =>
      ipcRenderer.invoke('image:thumbnail', opts),
    histogram: (opts: { filePath: string }): Promise<number[]> =>
      ipcRenderer.invoke('image:histogram', opts),
    copyToClipboard: (opts: { filePath: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('image:copyToClipboard', opts),
    copyRegion: (opts: { filePath: string; x: number; y: number; width: number; height: number }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('image:copyRegion', opts),
    saveRegion: (opts: { filePath: string; x: number; y: number; width: number; height: number; destDir: string }): Promise<{ ok: boolean; dest?: string; error?: string }> =>
      ipcRenderer.invoke('image:saveRegion', opts)
  },
  upscale: {
    process: (opts: { filePath: string; scale: 2 | 3 | 4; kernel: string; outputFormat: 'source' | 'png' | 'jpeg'; destDir: string | null }): Promise<{ ok: boolean; outputPath?: string; error?: string }> =>
      ipcRenderer.invoke('upscale:process', opts)
  },
  convert: {
    process: (opts: {
      filePath: string
      format: ConvertFormat
      quality: number
      resize: ConvertResize
      stripMetadata: boolean
      destDir: string | null
      mirrorFrom?: string | null
    }): Promise<{ ok: boolean; outputPath?: string; bytes?: number; error?: string }> =>
      ipcRenderer.invoke('convert:process', opts)
  },
  shell: {
    showInExplorer: (opts: { filePath: string }) => ipcRenderer.invoke('shell:showInExplorer', opts),
    openExternal: (opts: { filePath: string }) => ipcRenderer.invoke('shell:openExternal', opts),
    contextMenu: (opts: { filePath: string }) => ipcRenderer.invoke('shell:contextMenu', opts)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    print: (opts: { filePath: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('window:print', opts)
  },
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    getPendingFile: (): Promise<string | null> => ipcRenderer.invoke('app:getPendingFile'),
    // Both return an unsubscribe function. Without one, StrictMode's double
    // effect invocation stacks a second listener and every canvas action fires
    // twice — a context-menu Reject would remove two images while recording
    // only one undo entry.
    onOpenFile: (callback: (filePath: string) => void): (() => void) => {
      const handler = (_event: unknown, filePath: string): void => callback(filePath)
      ipcRenderer.on('app:openFile', handler)
      return () => { ipcRenderer.removeListener('app:openFile', handler) }
    },
    onCanvasAction: (callback: (payload: { type: string }) => void): (() => void) => {
      const handler = (_event: unknown, payload: { type: string }): void => callback(payload)
      ipcRenderer.on('canvas:action', handler)
      return () => { ipcRenderer.removeListener('canvas:action', handler) }
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
