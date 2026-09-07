import { describe, it, expect } from 'vitest'
import { buildRenamePlan, expandPattern } from '../../src/renderer/src/utils/renamePattern'

const f = (full_path: string) => ({ full_path, filename: full_path.split(/[\\/]/).pop()! })

describe('expandPattern', () => {
  it('replaces a run of # with the number zero-padded to the run length', () => {
    expect(expandPattern('Vacation_###', 7)).toBe('Vacation_007')
  })

  it('does not truncate a number wider than the run', () => {
    expect(expandPattern('img_##', 123)).toBe('img_123')
  })

  it('fills every # run with the same number', () => {
    expect(expandPattern('#-shot-###', 4)).toBe('4-shot-004')
  })
})

describe('buildRenamePlan', () => {
  it('numbers files in queue order from the start number and keeps each extension', () => {
    const plan = buildRenamePlan(
      [f('D:\\lib\\zzz.jpg'), f('D:\\lib\\aaa.PNG'), f('D:\\lib\\mid.mp4')],
      'trip_##', 5
    )
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.pairs.map(p => p.dest)).toEqual([
      'D:\\lib\\trip_05.jpg',
      'D:\\lib\\trip_06.PNG',
      'D:\\lib\\trip_07.mp4'
    ])
  })

  it('keeps each file in its own folder and its own separator style', () => {
    const plan = buildRenamePlan([f('D:\\lib\\sub\\a.jpg'), f('/mnt/pics/b.jpg')], 'n_#', 1)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.pairs[0].dest).toBe('D:\\lib\\sub\\n_1.jpg')
    expect(plan.pairs[1].dest).toBe('/mnt/pics/n_2.jpg')
  })

  it('handles a file with no extension', () => {
    const plan = buildRenamePlan([f('D:\\lib\\README')], 'doc_#', 1)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.pairs[0].dest).toBe('D:\\lib\\doc_1')
  })

  it('refuses a pattern with no # placeholder', () => {
    const plan = buildRenamePlan([f('D:\\lib\\a.jpg')], 'photo', 1)
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.error).toMatch(/#/)
  })

  it('refuses characters Windows will not accept in a filename', () => {
    expect(buildRenamePlan([f('D:\\lib\\a.jpg')], 'a:b_#', 1).ok).toBe(false)
    expect(buildRenamePlan([f('D:\\lib\\a.jpg')], 'a\\b_#', 1).ok).toBe(false)
  })

  it('refuses an empty pattern', () => {
    expect(buildRenamePlan([f('D:\\lib\\a.jpg')], '   ', 1).ok).toBe(false)
  })

  it('refuses a start number below zero or non-integer', () => {
    expect(buildRenamePlan([f('D:\\lib\\a.jpg')], 'a_#', -1).ok).toBe(false)
    expect(buildRenamePlan([f('D:\\lib\\a.jpg')], 'a_#', 1.5).ok).toBe(false)
  })

  it('reports oldName and newName for the preview', () => {
    const plan = buildRenamePlan([f('D:\\lib\\IMG_4021.jpg')], 'beach_###', 1)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.pairs[0].oldName).toBe('IMG_4021.jpg')
    expect(plan.pairs[0].newName).toBe('beach_001.jpg')
  })
})
