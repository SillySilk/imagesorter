import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { batchRename } from '../../src/main/fileOps'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aperture-rename-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (name: string, body = name): string => {
  const p = path.join(dir, name)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, body)
  return p
}

const read = (name: string): string => fs.readFileSync(path.join(dir, name), 'utf8')
const listing = (): string[] => fs.readdirSync(dir).filter(n => !n.startsWith('.')).sort()

describe('batchRename', () => {
  it('renames every pair and reports them back', async () => {
    const a = write('a.jpg')
    const b = write('b.jpg')
    const res = await batchRename([
      { src: a, dest: path.join(dir, 'x_1.jpg') },
      { src: b, dest: path.join(dir, 'x_2.jpg') }
    ])
    expect(res.ok).toBe(true)
    expect(listing()).toEqual(['x_1.jpg', 'x_2.jpg'])
    expect(read('x_1.jpg')).toBe('a.jpg')
    expect(read('x_2.jpg')).toBe('b.jpg')
  })

  // The whole reason for the two-phase dance: a naive loop would rename
  // img_002 → img_001 straight over the top of a file that hasn't moved yet.
  it('swaps names within the set without clobbering', async () => {
    const one = write('img_001.jpg', 'ONE')
    const two = write('img_002.jpg', 'TWO')
    const res = await batchRename([
      { src: two, dest: one },
      { src: one, dest: two }
    ])
    expect(res.ok).toBe(true)
    expect(read('img_001.jpg')).toBe('TWO')
    expect(read('img_002.jpg')).toBe('ONE')
  })

  it('shifts a whole numbered sequence by one without loss', async () => {
    const files = [1, 2, 3].map(n => write(`s_${n}.jpg`, `S${n}`))
    const res = await batchRename(files.map((src, i) => ({ src, dest: path.join(dir, `s_${i + 2}.jpg`) })))
    expect(res.ok).toBe(true)
    expect(listing()).toEqual(['s_2.jpg', 's_3.jpg', 's_4.jpg'])
    expect(read('s_2.jpg')).toBe('S1')
    expect(read('s_4.jpg')).toBe('S3')
  })

  it('refuses when a target is held by a file outside the set, changing nothing', async () => {
    const a = write('a.jpg')
    const b = write('b.jpg')
    write('x_2.jpg', 'STRANGER')
    const res = await batchRename([
      { src: a, dest: path.join(dir, 'x_1.jpg') },
      { src: b, dest: path.join(dir, 'x_2.jpg') }
    ])
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.conflicts).toEqual([path.join(dir, 'x_2.jpg')])
    expect(listing()).toEqual(['a.jpg', 'b.jpg', 'x_2.jpg'])
    expect(read('x_2.jpg')).toBe('STRANGER')
  })

  it('refuses when two pairs share a destination', async () => {
    const a = write('a.jpg')
    const b = write('b.jpg')
    const res = await batchRename([
      { src: a, dest: path.join(dir, 'same.jpg') },
      { src: b, dest: path.join(dir, 'same.jpg') }
    ])
    expect(res.ok).toBe(false)
    expect(listing()).toEqual(['a.jpg', 'b.jpg'])
  })

  it('refuses when a source is missing, changing nothing', async () => {
    const a = write('a.jpg')
    const res = await batchRename([
      { src: a, dest: path.join(dir, 'x_1.jpg') },
      { src: path.join(dir, 'ghost.jpg'), dest: path.join(dir, 'x_2.jpg') }
    ])
    expect(res.ok).toBe(false)
    expect(listing()).toEqual(['a.jpg'])
  })

  it('treats a pair whose name does not change as a no-op', async () => {
    const a = write('keep.jpg', 'K')
    const b = write('b.jpg')
    const res = await batchRename([
      { src: a, dest: a },
      { src: b, dest: path.join(dir, 'moved.jpg') }
    ])
    expect(res.ok).toBe(true)
    expect(listing()).toEqual(['keep.jpg', 'moved.jpg'])
    expect(read('keep.jpg')).toBe('K')
  })

  it('leaves no temp files behind', async () => {
    const a = write('a.jpg')
    await batchRename([{ src: a, dest: path.join(dir, 'z.jpg') }])
    expect(fs.readdirSync(dir)).toEqual(['z.jpg'])
  })
})
