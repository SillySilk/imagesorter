import fs from 'fs'
import path from 'path'

export interface FileInfo {
  filename: string
  relative_path: string
  full_path: string
  type: 'image' | 'video'
}

const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.bmp', '.webp', '.svg',
  '.psd', '.heic', '.tiff', '.tif', '.gif', '.avif',
  '.cr2', '.nef', '.arw', '.dng', '.raw'
])

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi'])

function getFileType(filename: string): 'image' | 'video' | null {
  const ext = path.extname(filename).toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  return null
}

function filterByTypes(filename: string, fileTypes: string[]): boolean {
  if (!fileTypes || fileTypes.length === 0) return getFileType(filename) !== null
  const ext = path.extname(filename).toLowerCase().replace('.', '')
  const type = getFileType(filename)
  // Always allow video types through regardless of file_types filter
  if (type === 'video') return true
  return fileTypes.includes(ext)
}

export class RecursiveScanner {
  static scan(rootDir: string, recursive: boolean, fileTypes: string[] = []): FileInfo[] {
    if (recursive) return RecursiveScanner.scanRecursive(rootDir, fileTypes)
    return RecursiveScanner.scanFlat(rootDir, fileTypes)
  }

  private static scanFlat(rootDir: string, fileTypes: string[]): FileInfo[] {
    const results: FileInfo[] = []
    try {
      for (const filename of fs.readdirSync(rootDir)) {
        const fullPath = path.join(rootDir, filename)
        if (!fs.statSync(fullPath).isFile()) continue
        const type = getFileType(filename)
        if (!type) continue
        if (!filterByTypes(filename, fileTypes)) continue
        results.push({ filename, relative_path: '', full_path: fullPath, type })
      }
    } catch (e) {
      console.error(`Error scanning directory ${rootDir}:`, e)
    }
    return results
  }

  private static scanRecursive(rootDir: string, fileTypes: string[]): FileInfo[] {
    const results: FileInfo[] = []
    const walk = (dir: string) => {
      let entries: string[]
      try { entries = fs.readdirSync(dir) } catch { return }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        let stat: fs.Stats
        try { stat = fs.statSync(fullPath) } catch { continue }
        if (stat.isSymbolicLink()) continue
        if (stat.isDirectory()) { walk(fullPath); continue }
        const type = getFileType(entry)
        if (!type) continue
        if (!filterByTypes(entry, fileTypes)) continue
        const relPath = path.relative(rootDir, dir)
        results.push({
          filename: entry,
          relative_path: relPath === '.' ? '' : relPath,
          full_path: fullPath,
          type
        })
      }
    }
    walk(rootDir)
    return results
  }
}
