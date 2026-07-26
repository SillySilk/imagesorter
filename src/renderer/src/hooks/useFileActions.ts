import { useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import type { FileInfo } from '../context/AppContext'

/** Parent directory of a Windows or POSIX path. */
function parentDir(p: string): string {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return i > 0 ? p.slice(0, i) : p
}

/** Final path segment of a Windows or POSIX path. */
function baseName(p: string): string {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return i >= 0 ? p.slice(i + 1) : p
}

/**
 * The single implementation of every destructive file action.
 *
 * Both entry points use this: `useActionRouter` (keyboard, mouse, wheel) and
 * `Canvas` (the native right-click menu, which arrives over IPC). They used to
 * carry separate copies, so session counters and undo would have had to be
 * added twice and could drift apart.
 *
 * Every action reads state through a ref. These are async — awaiting a file
 * move or a confirm dialog means a stale closure would otherwise act on
 * whichever image was on screen when the handler was created.
 */
export function useFileActions() {
  const { state, dispatch } = useApp()
  const stateRef = useRef(state)
  stateRef.current = state

  const keep = useCallback(async () => {
    const s = stateRef.current
    const index = s.currentIndex
    const file = s.files[index]
    if (!file) return

    // With no keep folder configured, keep just advances past the file and
    // nothing moves on disk. currentPath then equals originalPath, which undo
    // relies on to know it must not attempt a move.
    let currentPath = file.full_path
    if (s.config?.keep) {
      const res = await window.api.file.move({ src: file.full_path, destDir: s.config.keep })
      if (!res.ok) return
      currentPath = res.dest || currentPath
    }

    dispatch({
      type: 'RECORD_ACTION',
      payload: { kind: 'keep', undo: { kind: 'keep', file, index, originalPath: file.full_path, currentPath } }
    })
    dispatch({ type: 'REMOVE_FILE', payload: file.full_path })
  }, [dispatch])

  const reject = useCallback(async () => {
    const s = stateRef.current
    const index = s.currentIndex
    const file = s.files[index]
    if (!file) return

    const destDir = s.config?.reject || `${parentDir(file.full_path)}\\Rejected`
    const res = await window.api.file.move({ src: file.full_path, destDir })
    if (!res.ok) return

    dispatch({
      type: 'RECORD_ACTION',
      payload: { kind: 'reject', undo: { kind: 'reject', file, index, originalPath: file.full_path, currentPath: res.dest } }
    })
    dispatch({ type: 'REMOVE_FILE', payload: file.full_path })
  }, [dispatch])

  /** The Delete key: recoverable, undoable, no confirmation. */
  const trash = useCallback(async () => {
    const s = stateRef.current
    const index = s.currentIndex
    const file = s.files[index]
    if (!file) return

    const res = await window.api.file.trash({ filePath: file.full_path })
    if (!res.ok || !res.entry) return

    dispatch({
      type: 'RECORD_ACTION',
      payload: { kind: 'delete', undo: { kind: 'delete', file, index, originalPath: file.full_path, trashId: res.entry.id } }
    })
    dispatch({ type: 'REMOVE_FILE', payload: file.full_path })
  }, [dispatch])

  /** The "Delete Permanently" menu item and the bindable `delete` action:
   *  unlinks the file outright and is not undoable. */
  const deletePermanent = useCallback(async () => {
    const s = stateRef.current
    const file = s.files[s.currentIndex]
    if (!file) return

    const confirmed = !s.config?.options?.confirm_delete || await window.api.dialog.confirm({
      title: 'Delete File',
      message: `Permanently delete ${file.filename}?`,
      detail: 'This cannot be undone.'
    })
    if (!confirmed) return

    const res = await window.api.file.delete({ filePath: file.full_path })
    if (!res.ok) return

    dispatch({ type: 'RECORD_ACTION', payload: { kind: 'delete', undo: null } })
    dispatch({ type: 'REMOVE_FILE', payload: file.full_path })
  }, [dispatch])

  const undo = useCallback(async () => {
    const entry = stateRef.current.undoEntry
    if (!entry) return

    let restoredPath = entry.originalPath

    if (entry.kind === 'delete') {
      if (!entry.trashId) return
      const res = await window.api.file.restore({ trashId: entry.trashId })
      if (!res.ok || !res.restoredPath) return
      restoredPath = res.restoredPath
    } else if (entry.currentPath && entry.currentPath !== entry.originalPath) {
      const res = await window.api.file.moveTo({ src: entry.currentPath, destPath: entry.originalPath })
      if (!res.ok || !res.dest) return
      restoredPath = res.dest
    }
    // Otherwise nothing moved on disk (keep with no keep folder) and the file
    // is already sitting at its original path.

    // Something may have claimed the original name while the file was away, in
    // which case it came back as `foo_1.jpg`. Patch the record to the real path
    // rather than re-inserting one that doesn't exist.
    const file: FileInfo = restoredPath === entry.file.full_path
      ? entry.file
      : { ...entry.file, full_path: restoredPath, filename: baseName(restoredPath) }

    dispatch({ type: 'UNDO_RESTORE', payload: { file, index: entry.index } })
  }, [dispatch])

  return { keep, reject, trash, deletePermanent, undo }
}
