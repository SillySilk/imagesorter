// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type { Config } from '../../src/main/config'

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\fake\\userData' } }))

const { reducer, initialState } = await import('../../src/renderer/src/context/AppContext')
type AppState = typeof initialState
type FileInfo = AppState['files'][number]

const mkFile = (name: string): FileInfo => ({
  filename: name,
  relative_path: name,
  full_path: `D:\\lib\\${name}`,
  type: 'image'
})

const A = mkFile('a.jpg')
const B = mkFile('b.jpg')
const C = mkFile('c.jpg')
const D = mkFile('d.jpg')

const stateWith = (over: Partial<AppState> = {}): AppState => ({
  ...initialState,
  files: [A, B, C, D],
  currentIndex: 1,
  ...over
})

const undoFor = (file: FileInfo, index: number, over = {}): AppState['undoEntry'] => ({
  id: 1,
  kind: 'delete' as const,
  file,
  index,
  originalPath: file.full_path,
  ...over
})

describe('REMOVE_FILE', () => {
  it('drops the file and lands on the next one by holding the index', () => {
    const next = reducer(stateWith(), { type: 'REMOVE_FILE', payload: B.full_path })
    expect(next.files).toEqual([A, C, D])
    expect(next.currentIndex).toBe(1)
    expect(next.files[next.currentIndex]).toBe(C)
  })

  it('clamps to the last remaining file when removing the final one', () => {
    const next = reducer(stateWith({ currentIndex: 3 }), { type: 'REMOVE_FILE', payload: D.full_path })
    expect(next.files).toEqual([A, B, C])
    expect(next.currentIndex).toBe(2)
  })

  it('survives removing the only file', () => {
    const next = reducer(stateWith({ files: [A], currentIndex: 0 }), { type: 'REMOVE_FILE', payload: A.full_path })
    expect(next.files).toEqual([])
    expect(next.currentIndex).toBe(0)
  })

  it('resets zoom and pan', () => {
    const next = reducer(
      stateWith({ zoom: 3, fitMode: false, panOffset: { x: 50, y: 20 } }),
      { type: 'REMOVE_FILE', payload: B.full_path }
    )
    expect(next.zoom).toBe(1)
    expect(next.fitMode).toBe(true)
    expect(next.panOffset).toEqual({ x: 0, y: 0 })
  })
})

describe('RECORD_ACTION', () => {
  it('counts the action and arms undo', () => {
    const entry = undoFor(B, 1)
    const next = reducer(stateWith(), { type: 'RECORD_ACTION', payload: { kind: 'delete', undo: entry } })
    expect(next.sessionStats).toEqual({ kept: 0, rejected: 0, deleted: 1 })
    expect(next.undoEntry).toBe(entry)
  })

  it('routes each kind to its own counter', () => {
    let s = stateWith()
    s = reducer(s, { type: 'RECORD_ACTION', payload: { kind: 'keep', undo: undoFor(A, 0, { kind: 'keep' }) } })
    s = reducer(s, { type: 'RECORD_ACTION', payload: { kind: 'reject', undo: undoFor(B, 1, { kind: 'reject' }) } })
    s = reducer(s, { type: 'RECORD_ACTION', payload: { kind: 'reject', undo: undoFor(C, 2, { kind: 'reject' }) } })
    expect(s.sessionStats).toEqual({ kept: 1, rejected: 2, deleted: 0 })
  })

  it('counts a permanent delete but leaves nothing to undo', () => {
    // undo: null means the action happened and is not reversible. Ctrl+Z must
    // not reach past it to undo some earlier, still-armed action.
    const armed = reducer(stateWith(), { type: 'RECORD_ACTION', payload: { kind: 'keep', undo: undoFor(A, 0, { kind: 'keep' }) } })
    const next = reducer(armed, { type: 'RECORD_ACTION', payload: { kind: 'delete', undo: null } })
    expect(next.sessionStats).toEqual({ kept: 1, rejected: 0, deleted: 1 })
    expect(next.undoEntry).toBeNull()
  })
})

describe('UNDO_RESTORE', () => {
  const armed = (kind: 'keep' | 'reject' | 'delete', file: FileInfo, index: number, id = 7): AppState =>
    reducer(
      reducer(stateWith(), { type: 'RECORD_ACTION', payload: { kind, undo: undoFor(file, index, { kind, id }) } }),
      { type: 'REMOVE_FILE', payload: file.full_path }
    )

  it('re-inserts the file at its original index and selects it', () => {
    const s = armed('delete', B, 1)
    expect(s.files).toEqual([A, C, D])

    const next = reducer(s, { type: 'UNDO_RESTORE', payload: { file: B, index: 1, kind: 'delete', id: 7 } })

    expect(next.files).toEqual([A, B, C, D])
    expect(next.currentIndex).toBe(1)
    expect(next.files[next.currentIndex]).toBe(B)
  })

  it('decrements the counter for the kind it restored', () => {
    const s = armed('reject', B, 1)
    expect(s.sessionStats.rejected).toBe(1)
    const next = reducer(s, { type: 'UNDO_RESTORE', payload: { file: B, index: 1, kind: 'reject', id: 7 } })
    expect(next.sessionStats).toEqual({ kept: 0, rejected: 0, deleted: 0 })
  })

  it('uses the payload kind, not whatever is currently armed', () => {
    // A cull landing while the restore was in flight replaces undoEntry. Reading
    // the kind back off state would decrement the wrong counter.
    let s = armed('delete', B, 1)
    s = reducer(s, { type: 'RECORD_ACTION', payload: { kind: 'keep', undo: undoFor(C, 1, { kind: 'keep', id: 99 }) } })
    expect(s.sessionStats).toEqual({ kept: 1, rejected: 0, deleted: 1 })

    const next = reducer(s, { type: 'UNDO_RESTORE', payload: { file: B, index: 1, kind: 'delete', id: 7 } })

    expect(next.sessionStats).toEqual({ kept: 1, rejected: 0, deleted: 0 })
  })

  it('keeps a newer undo entry that was armed while the restore was in flight', () => {
    let s = armed('delete', B, 1)
    const newer = undoFor(C, 1, { kind: 'keep', id: 99 })
    s = reducer(s, { type: 'RECORD_ACTION', payload: { kind: 'keep', undo: newer } })

    const next = reducer(s, { type: 'UNDO_RESTORE', payload: { file: B, index: 1, kind: 'delete', id: 7 } })

    expect(next.undoEntry).toBe(newer)
  })

  it('clears the slot when it still holds the entry being restored', () => {
    const s = armed('delete', B, 1)
    const next = reducer(s, { type: 'UNDO_RESTORE', payload: { file: B, index: 1, kind: 'delete', id: 7 } })
    expect(next.undoEntry).toBeNull()
  })

  it('never drives a counter below zero', () => {
    const next = reducer(stateWith(), { type: 'UNDO_RESTORE', payload: { file: B, index: 1, kind: 'keep', id: 1 } })
    expect(next.sessionStats.kept).toBe(0)
  })

  it('clamps an index that no longer fits the shortened list', () => {
    const s = stateWith({ files: [A], currentIndex: 0 })
    const next = reducer(s, { type: 'UNDO_RESTORE', payload: { file: D, index: 9, kind: 'delete', id: 1 } })
    expect(next.files).toEqual([A, D])
    expect(next.currentIndex).toBe(1)
  })

  it('restores a file whose path changed to dodge a name collision', () => {
    const s = armed('delete', B, 1)
    const renamed: FileInfo = { ...B, full_path: 'D:\\lib\\b_1.jpg', filename: 'b_1.jpg' }
    const next = reducer(s, { type: 'UNDO_RESTORE', payload: { file: renamed, index: 1, kind: 'delete', id: 7 } })
    expect(next.files[1]).toBe(renamed)
  })
})

describe('SET_FILES', () => {
  it('bumps filesToken so the thumbnail cache knows this is a new folder', () => {
    const next = reducer(stateWith(), { type: 'SET_FILES', payload: [A, B] })
    expect(next.filesToken).toBe(initialState.filesToken + 1)
  })

  it('clears session counters and any armed undo', () => {
    let s = reducer(stateWith(), { type: 'RECORD_ACTION', payload: { kind: 'delete', undo: undoFor(B, 1) } })
    s = reducer(s, { type: 'SET_FILES', payload: [A, B] })
    expect(s.sessionStats).toEqual({ kept: 0, rejected: 0, deleted: 0 })
    expect(s.undoEntry).toBeNull()
    expect(s.currentIndex).toBe(0)
  })

  it('does not bump filesToken for REMOVE_FILE — that is not a new folder', () => {
    const next = reducer(stateWith(), { type: 'REMOVE_FILE', payload: B.full_path })
    expect(next.filesToken).toBe(initialState.filesToken)
  })
})

describe('config actions and the active mode', () => {
  const cfg = (over: Partial<Config> = {}): Config =>
    ({ app_mode: 'sort', utilities: {}, options: {} , ...over } as unknown as Config)

  it('UPDATE_CONFIG leaves the active mode alone', () => {
    // Regression: persisting convert settings dispatched SET_CONFIG, which
    // recomputes mode from app_mode. A user who had switched to View was snapped
    // back to Sort, where left-click is 'keep' — so their next canvas click
    // moved a file.
    const s = stateWith({ mode: 'view' })
    const next = reducer(s, { type: 'UPDATE_CONFIG', payload: cfg({ app_mode: 'sort' }) })
    expect(next.mode).toBe('view')
    expect(next.config).toBeTruthy()
  })

  it('SET_CONFIG still applies app_mode, which is what a real load should do', () => {
    const s = stateWith({ mode: 'view' })
    const next = reducer(s, { type: 'SET_CONFIG', payload: cfg({ app_mode: 'sort' }) })
    expect(next.mode).toBe('sort')
  })

  it("SET_CONFIG with app_mode 'last' preserves the current mode", () => {
    const s = stateWith({ mode: 'view' })
    const next = reducer(s, { type: 'SET_CONFIG', payload: cfg({ app_mode: 'last' }) })
    expect(next.mode).toBe('view')
  })
})

describe('navigation', () => {
  it('NEXT stops at the end rather than running off it', () => {
    const s = stateWith({ currentIndex: 3 })
    expect(reducer(s, { type: 'NEXT' })).toBe(s)
  })

  it('PREVIOUS stops at the start', () => {
    const s = stateWith({ currentIndex: 0 })
    expect(reducer(s, { type: 'PREVIOUS' })).toBe(s)
  })

  it('RANDOM always moves off the current image', () => {
    const s = stateWith()
    for (let i = 0; i < 50; i++) {
      expect(reducer(s, { type: 'RANDOM' }).currentIndex).not.toBe(s.currentIndex)
    }
  })

  it('RANDOM is a no-op with a single file', () => {
    const s = stateWith({ files: [A], currentIndex: 0 })
    expect(reducer(s, { type: 'RANDOM' })).toBe(s)
  })

  it('SET_INDEX clamps into range', () => {
    expect(reducer(stateWith(), { type: 'SET_INDEX', payload: 99 }).currentIndex).toBe(3)
    expect(reducer(stateWith(), { type: 'SET_INDEX', payload: -5 }).currentIndex).toBe(0)
  })
})
