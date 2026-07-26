import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { movePath, resolveConflict } from './fileOps'

/**
 * App-managed trash.
 *
 * Deleted files move here rather than to the Windows Recycle Bin because the
 * Recycle Bin has no practical programmatic restore from Electron, and the
 * Delete key is undoable. Nothing is removed automatically — Preferences →
 * General exposes an Empty Trash control.
 */

export interface TrashEntry {
  id: string
  originalPath: string
  trashPath: string
  filename: string
  deletedAt: string
  size: number
}

function trashDir(): string {
  return path.join(app.getPath('userData'), 'trash')
}

function manifestPath(): string {
  return path.join(trashDir(), 'manifest.json')
}

function readManifest(): TrashEntry[] {
  try {
    const p = manifestPath()
    if (!fs.existsSync(p)) return []
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
    return Array.isArray(raw) ? raw : []
  } catch (e) {
    console.error('Trash manifest read error:', e)
    return []
  }
}

function writeManifest(entries: TrashEntry[]): void {
  const dir = trashDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(manifestPath(), JSON.stringify(entries, null, 2), 'utf-8')
}

// Counter disambiguates files trashed within the same millisecond.
let counter = 0
function nextId(): string {
  return `${Date.now().toString(36)}${(counter++).toString(36)}`
}

export async function trashFile(filePath: string): Promise<{ ok: boolean; entry?: TrashEntry; error?: string }> {
  if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found' }

  const dir = trashDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  let size = 0
  try { size = fs.statSync(filePath).size } catch { /* size is informational only */ }

  const id = nextId()
  const filename = path.basename(filePath)
  // Id prefix keeps two same-named files from colliding inside the trash.
  const target = resolveConflict(path.join(dir, `${id}__${filename}`))

  const res = await movePath(filePath, target)
  if (!res.ok || !res.dest) return { ok: false, error: res.error || 'Move to trash failed' }

  const entry: TrashEntry = {
    id,
    originalPath: filePath,
    trashPath: res.dest,
    filename,
    deletedAt: new Date().toISOString(),
    size
  }
  const entries = readManifest()
  entries.push(entry)
  writeManifest(entries)
  return { ok: true, entry }
}

export async function restoreFromTrash(id: string): Promise<{ ok: boolean; restoredPath?: string; error?: string }> {
  const entries = readManifest()
  const idx = entries.findIndex(e => e.id === id)
  if (idx === -1) return { ok: false, error: 'Trash entry not found' }

  const entry = entries[idx]
  if (!fs.existsSync(entry.trashPath)) {
    // Trash was emptied or tampered with externally — drop the stale record.
    entries.splice(idx, 1)
    writeManifest(entries)
    return { ok: false, error: 'Trashed file is no longer present' }
  }

  // Something may have taken the original name since deletion, so don't clobber it.
  const target = resolveConflict(entry.originalPath)
  const res = await movePath(entry.trashPath, target)
  if (!res.ok || !res.dest) return { ok: false, error: res.error || 'Restore failed' }

  entries.splice(idx, 1)
  writeManifest(entries)
  return { ok: true, restoredPath: res.dest }
}

export function trashInfo(): { count: number; bytes: number } {
  const entries = readManifest()
  return {
    count: entries.length,
    bytes: entries.reduce((sum, e) => sum + (e.size || 0), 0)
  }
}

export function emptyTrash(): { ok: boolean; count: number; failed: number } {
  const entries = readManifest()
  const remaining: TrashEntry[] = []
  let count = 0

  for (const entry of entries) {
    try {
      if (fs.existsSync(entry.trashPath)) fs.unlinkSync(entry.trashPath)
      count++
    } catch (e) {
      // Keep the record so a locked file isn't silently orphaned on disk.
      console.error('Trash delete error:', e)
      remaining.push(entry)
    }
  }

  writeManifest(remaining)
  return { ok: true, count, failed: remaining.length }
}
