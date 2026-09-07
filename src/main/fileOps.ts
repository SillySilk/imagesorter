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

export interface BatchRenamePair { src: string; dest: string }
export type BatchRenameResult =
  | { ok: true; renamed: BatchRenamePair[] }
  | { ok: false; error: string; conflicts?: string[] }

// Windows and macOS volumes are case-insensitive, so `A.jpg` and `a.jpg` are the
// same file for conflict purposes. Linux keeps case significant.
const CASE_INSENSITIVE = process.platform === 'win32' || process.platform === 'darwin'
const pathKey = (p: string): string => CASE_INSENSITIVE ? path.resolve(p).toLowerCase() : path.resolve(p)

/**
 * Rename many files in one atomic-as-we-can-get pass.
 *
 * Two phases: every source first moves to a private temp name beside itself,
 * then every temp moves to its final name. A single-pass loop would clobber
 * itself the moment a destination is also a not-yet-moved source (shifting
 * `img_002 → img_001` while `img_001 → img_002` is still pending, which is
 * exactly what a re-number produces). Validation runs up front so a refusal
 * touches nothing; a mid-flight failure rolls every completed step back.
 */
export async function batchRename(pairs: BatchRenamePair[]): Promise<BatchRenameResult> {
  // Exact-string equality on purpose: a case-only rename (a.jpg → A.jpg) has
  // equal pathKeys but is real work the user asked for.
  const work = pairs.filter(p => p.src !== p.dest)

  const srcKeys = new Set(work.map(p => pathKey(p.src)))
  const destKeys = new Set<string>()
  const conflicts: string[] = []
  for (const p of work) {
    if (!fs.existsSync(p.src)) return { ok: false, error: `Source file not found: ${path.basename(p.src)}` }
    const dk = pathKey(p.dest)
    if (destKeys.has(dk)) return { ok: false, error: `Two files would both become ${path.basename(p.dest)}` }
    destKeys.add(dk)
    // A destination already on disk is fine only if it's one of ours — it will
    // have vacated its name by the time phase 2 needs it.
    if (fs.existsSync(p.dest) && !srcKeys.has(dk)) conflicts.push(p.dest)
  }
  if (conflicts.length > 0) {
    const n = conflicts.length
    return { ok: false, error: `${n} name${n === 1 ? ' is' : 's are'} already taken by files outside the queue.`, conflicts }
  }

  const token = `${process.pid}-${Date.now().toString(36)}`
  const temps = work.map((p, i) => path.join(path.dirname(p.src), `.aperture-rename-${token}-${i}.tmp`))

  // Phase 1: src → temp
  const parked: number[] = []
  for (let i = 0; i < work.length; i++) {
    try {
      fs.renameSync(work[i].src, temps[i])
      parked.push(i)
    } catch (e: unknown) {
      for (const j of parked) { try { fs.renameSync(temps[j], work[j].src) } catch { /* best effort */ } }
      return { ok: false, error: `Could not rename ${path.basename(work[i].src)}: ${String(e)}` }
    }
  }

  // Phase 2: temp → dest
  const landed: number[] = []
  for (let i = 0; i < work.length; i++) {
    try {
      fs.renameSync(temps[i], work[i].dest)
      landed.push(i)
    } catch (e: unknown) {
      for (const j of landed) { try { fs.renameSync(work[j].dest, work[j].src) } catch { /* best effort */ } }
      for (let j = i; j < work.length; j++) { try { fs.renameSync(temps[j], work[j].src) } catch { /* best effort */ } }
      return { ok: false, error: `Could not rename to ${path.basename(work[i].dest)}: ${String(e)}` }
    }
  }

  return { ok: true, renamed: work }
}
