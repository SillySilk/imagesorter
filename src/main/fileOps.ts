import fs from 'fs'
import path from 'path'

function resolveConflict(dest: string): string {
  if (!fs.existsSync(dest)) return dest
  const dir = path.dirname(dest)
  const ext = path.extname(dest)
  const base = path.basename(dest, ext)
  let i = 1
  while (fs.existsSync(path.join(dir, `${base}_${i}${ext}`))) i++
  return path.join(dir, `${base}_${i}${ext}`)
}

export function moveFile(src: string, destDir: string): { ok: boolean; dest?: string; error?: string } {
  try {
    if (!fs.existsSync(src)) return { ok: false, error: 'Source file not found' }
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    const dest = resolveConflict(path.join(destDir, path.basename(src)))
    fs.renameSync(src, dest)
    return { ok: true, dest }
  } catch (e: unknown) {
    // Cross-device rename fallback
    try {
      const dest = resolveConflict(path.join(destDir, path.basename(src)))
      fs.copyFileSync(src, dest)
      fs.unlinkSync(src)
      return { ok: true, dest }
    } catch (e2: unknown) {
      return { ok: false, error: String(e2) }
    }
  }
}

export function copyFile(src: string, destDir: string): { ok: boolean; dest?: string; error?: string } {
  try {
    if (!fs.existsSync(src)) return { ok: false, error: 'Source file not found' }
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    const dest = resolveConflict(path.join(destDir, path.basename(src)))
    fs.copyFileSync(src, dest)
    return { ok: true, dest }
  } catch (e: unknown) {
    return { ok: false, error: String(e) }
  }
}

export function deleteFile(filePath: string): { ok: boolean; error?: string } {
  try {
    if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found' }
    fs.unlinkSync(filePath)
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: String(e) }
  }
}
