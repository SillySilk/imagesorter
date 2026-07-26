import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// trash.ts resolves its directory from Electron's userData path.
let userData: string
vi.mock('electron', () => ({
  app: { getPath: () => userData }
}))

const { trashFile, restoreFromTrash, trashInfo, emptyTrash } = await import('../../src/main/trash')

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aperture-trash-'))
  userData = path.join(dir, 'userData')
  fs.mkdirSync(userData, { recursive: true })
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (p: string, body = 'body'): string => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, body)
  return p
}

const library = (name: string, body = 'body'): string => write(path.join(dir, 'library', name), body)

describe('trashFile', () => {
  it('removes the file from its original location and records an entry', async () => {
    const file = library('a.jpg')

    const res = await trashFile(file)

    expect(res.ok).toBe(true)
    expect(res.entry?.originalPath).toBe(file)
    expect(res.entry?.filename).toBe('a.jpg')
    expect(fs.existsSync(file)).toBe(false)
    expect(fs.existsSync(res.entry!.trashPath)).toBe(true)
    expect(fs.readFileSync(res.entry!.trashPath, 'utf8')).toBe('body')
  })

  it('keeps two identically-named files apart in the trash', async () => {
    const a = await trashFile(library('dup.jpg', 'first'))
    const b = await trashFile(write(path.join(dir, 'other', 'dup.jpg'), 'second'))

    expect(a.entry!.trashPath).not.toBe(b.entry!.trashPath)
    expect(fs.readFileSync(a.entry!.trashPath, 'utf8')).toBe('first')
    expect(fs.readFileSync(b.entry!.trashPath, 'utf8')).toBe('second')
    expect(trashInfo().count).toBe(2)
  })

  it('reports a missing source instead of throwing', async () => {
    const res = await trashFile(path.join(dir, 'ghost.jpg'))
    expect(res.ok).toBe(false)
    expect(trashInfo().count).toBe(0)
  })
})

describe('restoreFromTrash', () => {
  it('puts the file back at its exact original path', async () => {
    const file = library('a.jpg', 'body')
    const { entry } = await trashFile(file)

    const res = await restoreFromTrash(entry!.id)

    expect(res.ok).toBe(true)
    expect(res.restoredPath).toBe(file)
    expect(fs.readFileSync(file, 'utf8')).toBe('body')
    expect(fs.existsSync(entry!.trashPath)).toBe(false)
    expect(trashInfo().count).toBe(0)
  })

  it('does not clobber a file that claimed the original name while it was away', async () => {
    const file = library('a.jpg', 'original')
    const { entry } = await trashFile(file)
    write(file, 'impostor')

    const res = await restoreFromTrash(entry!.id)

    expect(res.ok).toBe(true)
    expect(res.restoredPath).toBe(path.join(dir, 'library', 'a_1.jpg'))
    expect(fs.readFileSync(file, 'utf8')).toBe('impostor')
    expect(fs.readFileSync(res.restoredPath!, 'utf8')).toBe('original')
  })

  it('recreates the original directory if it was removed', async () => {
    const file = library('a.jpg')
    const { entry } = await trashFile(file)
    fs.rmSync(path.join(dir, 'library'), { recursive: true, force: true })

    const res = await restoreFromTrash(entry!.id)

    expect(res.ok).toBe(true)
    expect(fs.existsSync(file)).toBe(true)
  })

  it('fails cleanly on an unknown id', async () => {
    const res = await restoreFromTrash('nope')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not found/i)
  })

  it('drops the stale record when the trashed file vanished externally', async () => {
    const { entry } = await trashFile(library('a.jpg'))
    fs.unlinkSync(entry!.trashPath)

    const res = await restoreFromTrash(entry!.id)

    expect(res.ok).toBe(false)
    expect(trashInfo().count).toBe(0)
  })

  it('cannot restore the same entry twice', async () => {
    const { entry } = await trashFile(library('a.jpg'))
    expect((await restoreFromTrash(entry!.id)).ok).toBe(true)
    expect((await restoreFromTrash(entry!.id)).ok).toBe(false)
  })
})

describe('trashInfo / emptyTrash', () => {
  it('reports count and total bytes', async () => {
    await trashFile(library('a.jpg', 'abcde'))
    await trashFile(library('b.jpg', 'xy'))

    const info = trashInfo()
    expect(info.count).toBe(2)
    expect(info.bytes).toBe(7)
  })

  it('starts empty', () => {
    expect(trashInfo()).toEqual({ count: 0, bytes: 0 })
  })

  it('deletes every trashed file and clears the manifest', async () => {
    const a = await trashFile(library('a.jpg'))
    const b = await trashFile(library('b.jpg'))

    const res = emptyTrash()

    expect(res.ok).toBe(true)
    expect(res.count).toBe(2)
    expect(res.failed).toBe(0)
    expect(fs.existsSync(a.entry!.trashPath)).toBe(false)
    expect(fs.existsSync(b.entry!.trashPath)).toBe(false)
    expect(trashInfo()).toEqual({ count: 0, bytes: 0 })
  })

  it('leaves nothing restorable after emptying', async () => {
    const { entry } = await trashFile(library('a.jpg'))
    emptyTrash()
    expect((await restoreFromTrash(entry!.id)).ok).toBe(false)
  })
})
