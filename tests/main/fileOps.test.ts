import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { resolveConflict, movePath, moveFile, copyFile, deleteFile } from '../../src/main/fileOps'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aperture-fileops-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (p: string, body = 'x'): string => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, body)
  return p
}

describe('resolveConflict', () => {
  it('returns the path unchanged when nothing is there', () => {
    const target = path.join(dir, 'a.jpg')
    expect(resolveConflict(target)).toBe(target)
  })

  it('suffixes _1 when the name is taken', () => {
    const target = write(path.join(dir, 'a.jpg'))
    expect(resolveConflict(target)).toBe(path.join(dir, 'a_1.jpg'))
  })

  it('keeps counting past existing suffixes', () => {
    write(path.join(dir, 'a.jpg'))
    write(path.join(dir, 'a_1.jpg'))
    write(path.join(dir, 'a_2.jpg'))
    expect(resolveConflict(path.join(dir, 'a.jpg'))).toBe(path.join(dir, 'a_3.jpg'))
  })

  it('preserves a multi-dot filename stem', () => {
    write(path.join(dir, 'shot.2024.raw.jpg'))
    expect(resolveConflict(path.join(dir, 'shot.2024.raw.jpg')))
      .toBe(path.join(dir, 'shot.2024.raw_1.jpg'))
  })
})

describe('movePath', () => {
  it('moves to an exact destination path, renaming as it goes', async () => {
    const src = write(path.join(dir, 'src', 'a.jpg'), 'body')
    const dest = path.join(dir, 'dst', 'renamed.jpg')

    const res = await movePath(src, dest)

    expect(res.ok).toBe(true)
    expect(res.dest).toBe(dest)
    expect(fs.existsSync(src)).toBe(false)
    expect(fs.readFileSync(dest, 'utf8')).toBe('body')
  })

  it('creates missing destination directories', async () => {
    const src = write(path.join(dir, 'a.jpg'))
    const dest = path.join(dir, 'deep', 'deeper', 'a.jpg')
    expect((await movePath(src, dest)).ok).toBe(true)
    expect(fs.existsSync(dest)).toBe(true)
  })

  it('reports failure for a missing source instead of throwing', async () => {
    const res = await movePath(path.join(dir, 'ghost.jpg'), path.join(dir, 'out.jpg'))
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not found/i)
  })

  it('restores a conflict-renamed file back to its original name — the undo case', async () => {
    // This is exactly why undo can't use moveFile: the file left as `a.jpg` and
    // landed as `a_1.jpg`, and it has to come back as `a.jpg`.
    const original = path.join(dir, 'src', 'a.jpg')
    fs.mkdirSync(path.dirname(original), { recursive: true })
    const parked = write(path.join(dir, 'keep', 'a_1.jpg'), 'body')

    const res = await movePath(parked, original)

    expect(res.ok).toBe(true)
    expect(res.dest).toBe(original)
    expect(fs.readFileSync(original, 'utf8')).toBe('body')
    expect(fs.existsSync(parked)).toBe(false)
  })
})

describe('moveFile', () => {
  it('overwrites a same-named file when overwrite is on', async () => {
    const src = write(path.join(dir, 'src', 'a.jpg'), 'new')
    const destDir = path.join(dir, 'dst')
    write(path.join(destDir, 'a.jpg'), 'old')

    const res = await moveFile(src, destDir, true)

    expect(res.ok).toBe(true)
    expect(fs.readFileSync(path.join(destDir, 'a.jpg'), 'utf8')).toBe('new')
    expect(fs.readdirSync(destDir)).toEqual(['a.jpg'])
  })

  it('keeps both files when overwrite is off', async () => {
    const src = write(path.join(dir, 'src', 'a.jpg'), 'new')
    const destDir = path.join(dir, 'dst')
    write(path.join(destDir, 'a.jpg'), 'old')

    const res = await moveFile(src, destDir, false)

    expect(res.ok).toBe(true)
    expect(res.dest).toBe(path.join(destDir, 'a_1.jpg'))
    expect(fs.readFileSync(path.join(destDir, 'a.jpg'), 'utf8')).toBe('old')
    expect(fs.readFileSync(path.join(destDir, 'a_1.jpg'), 'utf8')).toBe('new')
  })

  it('creates the destination folder if it does not exist', async () => {
    const src = write(path.join(dir, 'a.jpg'))
    const destDir = path.join(dir, 'brand', 'new')
    expect((await moveFile(src, destDir)).ok).toBe(true)
    expect(fs.existsSync(path.join(destDir, 'a.jpg'))).toBe(true)
  })
})

describe('copyFile / deleteFile', () => {
  it('copies without removing the source, never overwriting', () => {
    const src = write(path.join(dir, 'a.jpg'), 'body')
    const destDir = path.join(dir, 'dst')
    write(path.join(destDir, 'a.jpg'), 'existing')

    const res = copyFile(src, destDir)

    expect(res.ok).toBe(true)
    expect(res.dest).toBe(path.join(destDir, 'a_1.jpg'))
    expect(fs.existsSync(src)).toBe(true)
    expect(fs.readFileSync(path.join(destDir, 'a.jpg'), 'utf8')).toBe('existing')
  })

  it('deletes a file and reports a missing one', () => {
    const p = write(path.join(dir, 'a.jpg'))
    expect(deleteFile(p).ok).toBe(true)
    expect(fs.existsSync(p)).toBe(false)
    expect(deleteFile(p).ok).toBe(false)
  })
})
