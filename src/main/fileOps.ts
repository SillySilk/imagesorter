import fs from 'fs'
import path from 'path'

export function resolveConflict(dest: string): string {
  if (!fs.existsSync(dest)) return dest
  const dir = path.dirname(dest)
  const ext = path.extname(dest)
  const base = path.basename(dest, ext)
  let i = 1
  while (fs.existsSync(path.join(dir, `${base}_${i}${ext}`))) i++
  return path.join(dir, `${base}_${i}${ext}`)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Move `src` to an exact destination path.
 *
 * Callers that only know a destination *directory* should use `moveFile`.
 * Undo needs this exact-path form: `resolveConflict` may have renamed a file to
 * `foo_1.jpg` on the way out, and putting it back as `foo.jpg` is impossible
 * through a directory-only API.
 */
export async function movePath(src: string, dest: string): Promise<{ ok: boolean; dest?: string; error?: string }> {
  if (!fs.existsSync(src)) return { ok: false, error: 'Source file not found' }
  const destDir = path.dirname(dest)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  // Fast path: same-volume rename. This succeeds even when the source is held
  // open by the viewer (rename doesn't require delete access), so it's the
  // common case for keep/reject within one drive.
  try {
    fs.renameSync(src, dest)
    return { ok: true, dest }
  } catch {
    // Cross-volume (EXDEV) or otherwise un-renamable: copy, then delete the
    // original. The delete can transiently fail with EPERM if the viewer still
    // holds the file open (e.g. immediately after navigating to it), so retry
    // briefly. If it never releases, roll back the copy so we don't leave a
    // duplicate behind, and report failure.
    try {
      fs.copyFileSync(src, dest)
    } catch (e: unknown) {
      return { ok: false, error: String(e) }
    }
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        fs.unlinkSync(src)
        return { ok: true, dest }
      } catch (e: unknown) {
        if (attempt === 19) {
          try { fs.unlinkSync(dest) } catch { /* leave nothing half-moved */ }
          return { ok: false, error: String(e) }
        }
        await sleep(100)
      }
    }
    return { ok: false, error: 'unreachable' }
  }
}

export async function moveFile(src: string, destDir: string, overwrite = true): Promise<{ ok: boolean; dest?: string; error?: string }> {
  if (!fs.existsSync(src)) return { ok: false, error: 'Source file not found' }
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  // overwrite: replace a same-named file at the destination. Otherwise keep both
  // by suffixing the name (_1, _2, …). rename and copyFileSync both overwrite an
  // existing destination by default, so the plain target path is all we need.
  const dest = overwrite
    ? path.join(destDir, path.basename(src))
    : resolveConflict(path.join(destDir, path.basename(src)))

  return movePath(src, dest)
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
