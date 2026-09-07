/**
 * Batch-rename pattern logic. Pure — no Node, no DOM — so the preview in the
 * panel and the plan sent to the main process are guaranteed to agree.
 *
 * `#` is the counter placeholder: each run of hashes becomes the sequence
 * number zero-padded to the run's length (`img_###` → `img_001`). Extensions
 * are never part of the pattern; the original one is carried over as-is.
 */

export interface RenamePair {
  src: string
  dest: string
  oldName: string
  newName: string
}

export type RenamePlan =
  | { ok: true; pairs: RenamePair[] }
  | { ok: false; error: string }

// Windows' reserved filename characters. macOS/Linux allow most of these, but
// refusing them everywhere keeps a library portable between machines.
const ILLEGAL = /[\\/:*?"<>|]/

export function expandPattern(pattern: string, n: number): string {
  return pattern.replace(/#+/g, run => String(n).padStart(run.length, '0'))
}

const splitExt = (filename: string): { stem: string; ext: string } => {
  const dot = filename.lastIndexOf('.')
  // A leading dot is a hidden-file marker, not an extension separator.
  if (dot <= 0) return { stem: filename, ext: '' }
  return { stem: filename.slice(0, dot), ext: filename.slice(dot) }
}

export function buildRenamePlan(
  files: { full_path: string; filename: string }[],
  pattern: string,
  start: number
): RenamePlan {
  const p = pattern.trim()
  if (!p) return { ok: false, error: 'Enter a name pattern.' }
  if (!p.includes('#')) return { ok: false, error: 'Add at least one # where the number should go.' }
  if (ILLEGAL.test(p)) return { ok: false, error: 'Names can’t contain \\ / : * ? " < > |' }
  if (!Number.isInteger(start) || start < 0) return { ok: false, error: 'Start number must be a whole number of 0 or more.' }

  const pairs = files.map((f, i) => {
    const { ext } = splitExt(f.filename)
    const newName = expandPattern(p, start + i) + ext
    // Keep whatever separator the path already uses so the result round-trips
    // through the scanner unchanged.
    const cut = Math.max(f.full_path.lastIndexOf('\\'), f.full_path.lastIndexOf('/'))
    const dir = cut >= 0 ? f.full_path.slice(0, cut + 1) : ''
    return { src: f.full_path, dest: dir + newName, oldName: f.filename, newName }
  })
  return { ok: true, pairs }
}
