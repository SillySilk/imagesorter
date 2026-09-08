import fs from 'fs'
import path from 'path'
import { trashFile } from './trash'
import { PSD_EXTS, loadPsdAsSharp } from './psd'

export type ConvertFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'

export interface RenameConvertJob { src: string; dest: string }
export interface RenameConvertSuccess { src: string; dest: string; trashId: string }
export interface RenameConvertFailure { src: string; error: string }
export interface RenameConvertResult {
  ok: boolean
  succeeded: RenameConvertSuccess[]
  failed: RenameConvertFailure[]
}

/**
 * Batch Rename's "convert as you rename" path. `dest` is already the final
 * pattern name (computed by the renderer's buildRenamePlan), so this writes
 * straight there — no separate rename step needed.
 *
 * Per-file, not all-or-nothing: one bad file shouldn't block the rest, so
 * failures are collected and returned rather than aborting the batch.
 *
 * The source is never touched until the converted bytes are safely on disk:
 * sharp writes to a temp file beside `dest` first, and only once that
 * succeeds does the original move to Trash (reversible) and the temp file
 * take its final name.
 */
export async function renameConvert(
  jobs: RenameConvertJob[],
  format: ConvertFormat,
  quality: number
): Promise<RenameConvertResult> {
  const sharp = (await import('sharp')).default
  const succeeded: RenameConvertSuccess[] = []
  const failed: RenameConvertFailure[] = []

  for (const job of jobs) {
    try {
      if (fs.existsSync(job.dest)) {
        failed.push({ src: job.src, error: `${path.basename(job.dest)} already exists` })
        continue
      }
      const ext = path.extname(job.src).toLowerCase()
      const buf = await fs.promises.readFile(job.src)
      const loadSource = (): Promise<ReturnType<typeof sharp>> =>
        PSD_EXTS.has(ext) ? loadPsdAsSharp(buf) : Promise.resolve(sharp(buf))
      let pipeline = (await loadSource()).rotate()

      const q = Math.max(1, Math.min(100, Math.round(quality)))
      switch (format) {
        case 'png': pipeline = pipeline.png({ compressionLevel: 9 }); break
        case 'webp': pipeline = pipeline.webp({ quality: q }); break
        case 'avif': pipeline = pipeline.avif({ quality: q }); break
        case 'tiff': pipeline = pipeline.tiff({ quality: q }); break
        default: pipeline = pipeline.jpeg({ quality: q }); break
      }

      const tmp = path.join(
        path.dirname(job.dest),
        `.aperture-convert-${process.pid}-${Date.now().toString(36)}-${succeeded.length + failed.length}.tmp`
      )
      await pipeline.toFile(tmp)

      const trashRes = await trashFile(job.src)
      if (!trashRes.ok || !trashRes.entry) {
        try { fs.unlinkSync(tmp) } catch { /* best effort */ }
        failed.push({ src: job.src, error: trashRes.error || 'Could not move the original to Trash' })
        continue
      }

      fs.renameSync(tmp, job.dest)
      succeeded.push({ src: job.src, dest: job.dest, trashId: trashRes.entry.id })
    } catch (e) {
      failed.push({ src: job.src, error: String(e) })
    }
  }

  return { ok: failed.length < jobs.length, succeeded, failed }
}
