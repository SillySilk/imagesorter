// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('electron', () => ({ app: { getPath: () => 'C:\\fake\\userData' } }))

const { AppProvider, useApp } = await import('../../src/renderer/src/context/AppContext')
const { useFileActions } = await import('../../src/renderer/src/hooks/useFileActions')

type FileInfo = { filename: string; relative_path: string; full_path: string; type: 'image' | 'video' }

const mkFile = (name: string): FileInfo => ({
  filename: name, relative_path: name, full_path: `D:\\lib\\${name}`, type: 'image'
})
const A = mkFile('a.jpg')
const B = mkFile('b.jpg')
const C = mkFile('c.jpg')

const baseConfig = {
  src: 'D:\\lib',
  keep: 'D:\\lib\\Keep',
  reject: 'D:\\lib\\Rejected',
  app_mode: 'view',
  options: { confirm_delete: true, file_types: ['jpg'], recursive_loading: false, overwrite_existing: true },
  appearance: { theme: 'burgundy', accent: '#a82d44', density: 'comfortable' },
  utilities: { cinema: { auto_switch: true }, convert: {}, upscale: {} }
}

let api: Record<string, any>

function installApi(configOver: Record<string, unknown> = {}): void {
  api = {
    config: {
      load: vi.fn().mockResolvedValue({ ...baseConfig, ...configOver }),
      save: vi.fn().mockResolvedValue({ ok: true })
    },
    app: {
      version: vi.fn().mockResolvedValue('0.7.0'),
      getPendingFile: vi.fn().mockResolvedValue(null),
      onOpenFile: vi.fn(() => () => {}),
      onCanvasAction: vi.fn(() => () => {})
    },
    // Return no files from the initial scan; tests seed state explicitly.
    scanner: { scan: vi.fn().mockResolvedValue([]) },
    file: {
      move: vi.fn(async ({ src, destDir }: { src: string; destDir: string }) => ({
        ok: true, dest: `${destDir}\\${src.split('\\').pop()}`
      })),
      trash: vi.fn(async ({ filePath }: { filePath: string }) => ({
        ok: true, entry: { id: 'trash-1', originalPath: filePath, trashPath: 'T:\\t\\1', filename: 'x', deletedAt: '', size: 1 }
      })),
      restore: vi.fn(async () => ({ ok: true, restoredPath: B.full_path })),
      moveTo: vi.fn(async ({ destPath }: { destPath: string }) => ({ ok: true, dest: destPath })),
      delete: vi.fn(async () => ({ ok: true }))
    },
    dialog: { confirm: vi.fn().mockResolvedValue(true) }
  }
  ;(globalThis as unknown as { window: { api: unknown } }).window.api = api
}

/** Mounts the hook inside a real provider and seeds a file list. */
async function setup(configOver: Record<string, unknown> = {}) {
  installApi(configOver)
  const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>
  const view = renderHook(() => ({ app: useApp(), actions: useFileActions() }), { wrapper })

  // Let the provider's async init settle before seeding.
  await waitFor(() => expect(view.result.current.app.state.config).toBeTruthy())
  act(() => { view.result.current.app.dispatch({ type: 'SET_FILES', payload: [A, B, C] }) })
  act(() => { view.result.current.app.dispatch({ type: 'SET_INDEX', payload: 1 }) })
  await waitFor(() => expect(view.result.current.app.state.currentIndex).toBe(1))
  return view
}

const state = (v: Awaited<ReturnType<typeof setup>>) => v.result.current.app.state

beforeEach(() => { vi.clearAllMocks() })

describe('trash — the Delete key', () => {
  it('moves the current file to the trash and advances', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.trash() })

    expect(api.file.trash).toHaveBeenCalledWith({ filePath: B.full_path })
    expect(state(v).files).toEqual([A, C])
    expect(state(v).files[state(v).currentIndex]).toEqual(C)
    expect(state(v).sessionStats.deleted).toBe(1)
  })

  it('never prompts', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.trash() })
    expect(api.dialog.confirm).not.toHaveBeenCalled()
  })

  it('arms undo', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.trash() })
    expect(state(v).undoEntry).toMatchObject({ kind: 'delete', trashId: 'trash-1', index: 1 })
  })

  it('leaves the list untouched when the trash operation fails', async () => {
    const v = await setup()
    api.file.trash.mockResolvedValueOnce({ ok: false, error: 'locked' })
    await act(async () => { await v.result.current.actions.trash() })

    expect(state(v).files).toEqual([A, B, C])
    expect(state(v).sessionStats.deleted).toBe(0)
    expect(state(v).undoEntry).toBeNull()
  })

  it('does nothing with an empty list', async () => {
    const v = await setup()
    act(() => { v.result.current.app.dispatch({ type: 'SET_FILES', payload: [] }) })
    await act(async () => { await v.result.current.actions.trash() })
    expect(api.file.trash).not.toHaveBeenCalled()
  })
})

describe('undo', () => {
  it('restores a trashed file to its original index', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.trash() })
    await act(async () => { await v.result.current.actions.undo() })

    expect(api.file.restore).toHaveBeenCalledWith({ trashId: 'trash-1' })
    expect(state(v).files).toEqual([A, B, C])
    expect(state(v).currentIndex).toBe(1)
    expect(state(v).sessionStats.deleted).toBe(0)
    expect(state(v).undoEntry).toBeNull()
  })

  it('moves a kept file back to its exact original path', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.keep() })
    expect(api.file.move).toHaveBeenCalledWith({ src: B.full_path, destDir: 'D:\\lib\\Keep' })

    await act(async () => { await v.result.current.actions.undo() })

    expect(api.file.moveTo).toHaveBeenCalledWith({ src: 'D:\\lib\\Keep\\b.jpg', destPath: B.full_path })
    expect(state(v).files).toEqual([A, B, C])
    expect(state(v).sessionStats.kept).toBe(0)
  })

  it('does not touch the disk when keep never moved anything', async () => {
    // With no keep folder configured, keep just dismisses the file. Undo must
    // not "restore" it onto itself — resolveConflict would mint a duplicate.
    const v = await setup({ keep: '' })
    await act(async () => { await v.result.current.actions.keep() })
    expect(api.file.move).not.toHaveBeenCalled()

    await act(async () => { await v.result.current.actions.undo() })

    expect(api.file.moveTo).not.toHaveBeenCalled()
    expect(state(v).files).toEqual([A, B, C])
  })

  it('adopts the real path when the original name was taken', async () => {
    const v = await setup()
    api.file.restore.mockResolvedValueOnce({ ok: true, restoredPath: 'D:\\lib\\b_1.jpg' })
    await act(async () => { await v.result.current.actions.trash() })
    await act(async () => { await v.result.current.actions.undo() })

    expect(state(v).files[1]).toMatchObject({ full_path: 'D:\\lib\\b_1.jpg', filename: 'b_1.jpg' })
  })

  it('is a no-op with nothing armed', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.undo() })
    expect(api.file.restore).not.toHaveBeenCalled()
    expect(state(v).files).toEqual([A, B, C])
  })

  it('only undoes one level', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.trash() })
    await act(async () => { await v.result.current.actions.trash() })
    await act(async () => { await v.result.current.actions.undo() })
    await act(async () => { await v.result.current.actions.undo() })

    expect(state(v).files).toHaveLength(2)
    expect(state(v).undoEntry).toBeNull()
  })

  it('leaves state alone when the restore fails', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.trash() })
    api.file.restore.mockResolvedValueOnce({ ok: false, error: 'gone' })
    await act(async () => { await v.result.current.actions.undo() })

    expect(state(v).files).toEqual([A, C])
    expect(state(v).undoEntry).not.toBeNull()
  })
})

describe('reject', () => {
  it('moves to the configured reject folder and counts it', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.reject() })

    expect(api.file.move).toHaveBeenCalledWith({ src: B.full_path, destDir: 'D:\\lib\\Rejected' })
    expect(state(v).sessionStats.rejected).toBe(1)
    expect(state(v).files).toEqual([A, C])
  })

  it('falls back to a Rejected folder beside the file', async () => {
    const v = await setup({ reject: '' })
    await act(async () => { await v.result.current.actions.reject() })
    expect(api.file.move).toHaveBeenCalledWith({ src: B.full_path, destDir: 'D:\\lib\\Rejected' })
  })

  it('keeps the file in the list when the move fails', async () => {
    const v = await setup()
    api.file.move.mockResolvedValueOnce({ ok: false, error: 'EPERM' })
    await act(async () => { await v.result.current.actions.reject() })

    expect(state(v).files).toEqual([A, B, C])
    expect(state(v).sessionStats.rejected).toBe(0)
  })
})

describe('deletePermanent', () => {
  it('unlinks after confirmation and counts, but arms no undo', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.deletePermanent() })

    expect(api.dialog.confirm).toHaveBeenCalled()
    expect(api.file.delete).toHaveBeenCalledWith({ filePath: B.full_path })
    expect(state(v).sessionStats.deleted).toBe(1)
    expect(state(v).undoEntry).toBeNull()
  })

  it('aborts when the user declines', async () => {
    const v = await setup()
    api.dialog.confirm.mockResolvedValueOnce(false)
    await act(async () => { await v.result.current.actions.deletePermanent() })

    expect(api.file.delete).not.toHaveBeenCalled()
    expect(state(v).files).toEqual([A, B, C])
  })

  it('skips the prompt when confirm_delete is off', async () => {
    const v = await setup({ options: { ...baseConfig.options, confirm_delete: false } })
    await act(async () => { await v.result.current.actions.deletePermanent() })

    expect(api.dialog.confirm).not.toHaveBeenCalled()
    expect(api.file.delete).toHaveBeenCalled()
  })

  it('disarms a previously armed undo rather than letting Ctrl+Z reach past it', async () => {
    const v = await setup()
    await act(async () => { await v.result.current.actions.keep() })
    expect(state(v).undoEntry).not.toBeNull()

    await act(async () => { await v.result.current.actions.deletePermanent() })

    expect(state(v).undoEntry).toBeNull()
  })
})
