import { contextBridge, ipcRenderer } from 'electron'
import type { Config } from '../main/config'
import type { FileInfo } from '../main/scanner'

const api = {
  config: {
    load: (): Promise<Config> => ipcRenderer.invoke('config:load'),
    save: (config: Config): Promise<{ ok: boolean }> => ipcRenderer.invoke('config:save', config),
    reset: (): Promise<Config> => ipcRenderer.invoke('config:reset'),
    path: (): Promise<string> => ipcRenderer.invoke('config:path'),
    validActions: (): Promise<string[]> => ipcRenderer.invoke('config:valid-actions')
  },
  dialog: {
    openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
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
      ipcRenderer.invoke('file:delete', opts)
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
      ipcRenderer.invoke('image:copyRegion', opts)
  },
  upscale: {
    process: (opts: { filePath: string; scale: 2 | 3 | 4; kernel: string; outputFormat: 'source' | 'png' | 'jpeg'; destDir: string | null }): Promise<{ ok: boolean; outputPath?: string; error?: string }> =>
      ipcRenderer.invoke('upscale:process', opts)
  },
  shell: {
    showInExplorer: (opts: { filePath: string }) => ipcRenderer.invoke('shell:showInExplorer', opts),
    openExternal: (opts: { filePath: string }) => ipcRenderer.invoke('shell:openExternal', opts),
    contextMenu: (opts: { filePath: string }) => ipcRenderer.invoke('shell:contextMenu', opts)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    getPendingFile: (): Promise<string | null> => ipcRenderer.invoke('app:getPendingFile'),
    onOpenFile: (callback: (filePath: string) => void): void => {
      ipcRenderer.on('app:openFile', (_event, filePath: string) => callback(filePath))
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
