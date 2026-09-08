import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// renameConvert -> trash.ts resolves its directory from Electron's userData path.
let userData: string
vi.mock('electron', () => ({
  app: { getPath: () => userData }
}))

const { renameConvert } = await import('../../src/main/renameConvert')
const { trashInfo, restoreFromTrash } = await import('../../src/main/trash')

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aperture-renameconvert-'))
  userData = path.join(dir, 'userData')
  fs.mkdirSync(userData, { recursive: true })
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

async function makePng(name: string, color = '#123456'): Promise<string> {
  const sharp = (await import('sharp')).default
  const file = path.join(dir, name)
  await sharp({ create: { width: 4, height: 4, channels: 3, background: color } }).png().toFile(file)
  return file
}

describe('renameConvert', () => {
  it('writes the converted file at dest and trashes the original', async () => {
    const src = await makePng('a.png')
    const dest = path.join(dir, 'trip_01.jpg')

    const res = await renameConvert([{ src, dest }], 'jpeg', 90)

    expect(res.ok).toBe(true)
    expect(res.failed).toEqual([])
    expect(res.succeeded).toEqual([{ src, dest, trashId: expect.any(String) }])
    expect(fs.existsSync(dest)).toBe(true)
    expect(fs.existsSync(src)).toBe(false)
    expect(trashInfo().count).toBe(1)
  })

  it('produces a real JPEG at dest, decodable back to the source dimensions', async () => {
    const src = await makePng('b.png')
    const dest = path.join(dir, 'out.jpg')

    await renameConvert([{ src, dest }], 'jpeg', 90)

    const sharp = (await import('sharp')).default
    const meta = await sharp(dest).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(4)
    expect(meta.height).toBe(4)
  })

  it('converts several files independently', async () => {
    const a = await makePng('a.png')
    const b = await makePng('b.png')
    const destA = path.join(dir, 'one.jpg')
    const destB = path.join(dir, 'two.jpg')

    const res = await renameConvert([{ src: a, dest: destA }, { src: b, dest: destB }], 'jpeg', 90)

    expect(res.ok).toBe(true)
    expect(res.succeeded).toHaveLength(2)
    expect(fs.existsSync(destA)).toBe(true)
    expect(fs.existsSync(destB)).toBe(true)
  })

  it('refuses a dest that already exists, without touching the source', async () => {
    const src = await makePng('a.png')
    const dest = path.join(dir, 'taken.jpg')
    fs.writeFileSync(dest, 'already here')

    const res = await renameConvert([{ src, dest }], 'jpeg', 90)

    expect(res.ok).toBe(false)
    expect(res.succeeded).toEqual([])
    expect(res.failed[0].src).toBe(src)
    expect(res.failed[0].error).toMatch(/already exists/)
    expect(fs.existsSync(src)).toBe(true)
    expect(fs.readFileSync(dest, 'utf8')).toBe('already here')
    expect(trashInfo().count).toBe(0)
  })

  it('reports a missing source as a failure instead of throwing', async () => {
    const src = path.join(dir, 'ghost.png')
    const dest = path.join(dir, 'out.jpg')

    const res = await renameConvert([{ src, dest }], 'jpeg', 90)

    expect(res.ok).toBe(false)
    expect(res.failed[0].src).toBe(src)
    expect(fs.existsSync(dest)).toBe(false)
  })

  it('one bad file does not block the rest of the batch', async () => {
    const good = await makePng('good.png')
    const ghost = path.join(dir, 'ghost.png')
    const destGood = path.join(dir, 'good.jpg')
    const destGhost = path.join(dir, 'ghost.jpg')

    const res = await renameConvert(
      [{ src: ghost, dest: destGhost }, { src: good, dest: destGood }],
      'jpeg', 90
    )

    expect(res.ok).toBe(true)
    expect(res.succeeded).toEqual([{ src: good, dest: destGood, trashId: expect.any(String) }])
    expect(res.failed).toEqual([{ src: ghost, error: expect.any(String) }])
  })

  it('the trashed original can be restored back to its exact original path', async () => {
    const src = await makePng('a.png')
    const dest = path.join(dir, 'trip_01.jpg')

    const res = await renameConvert([{ src, dest }], 'jpeg', 90)
    const restored = await restoreFromTrash(res.succeeded[0].trashId)

    expect(restored.ok).toBe(true)
    expect(restored.restoredPath).toBe(src)
    expect(fs.existsSync(src)).toBe(true)
  })

  it('supports png (lossless) with no quality-related failure', async () => {
    const src = await makePng('a.png')
    const dest = path.join(dir, 'out.png')

    const res = await renameConvert([{ src, dest }], 'png', 100)

    expect(res.ok).toBe(true)
    expect(fs.existsSync(dest)).toBe(true)
  })
})
