import { useEffect, useCallback, useRef, type RefObject } from 'react'
import { useApp } from '../context/AppContext'
import { useLoadFolder } from './useLoadFolder'
import type { Action } from '../../../main/config'

/** Parent directory of a Windows or POSIX path. */
function parentDir(p: string): string {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return i > 0 ? p.slice(0, i) : p
}

/**
 * Wire up keyboard / mouse / wheel actions.
 *
 * Keyboard actions are global (work anywhere in the window). Pointer and wheel
 * actions are scoped to `targetRef` (the image canvas) so clicks and scrolls
 * over the surrounding chrome — the Inspector, the Queue thumbnail grid, the
 * rail — never trigger keep/reject/next. Without this scoping a click on a
 * thumbnail would fire the sort-mode `keep` action on the current image, and a
 * scroll over the grid would both scroll it and flood `NEXT` dispatches.
 */
export function useActionRouter(targetRef?: RefObject<HTMLElement | null>) {
  const { state, dispatch } = useApp()
  const { loadFolder, reloadCurrentFolder } = useLoadFolder()
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null)
  // Timestamp guard so one fast wheel flick can't dispatch a burst of NEXTs
  // faster than images can decode (which flashes the black frame).
  const lastWheelNavRef = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const executeAction = useCallback(async (action: Action) => {
    const s = stateRef.current
    const currentFile = s.files[s.currentIndex] || null

    switch (action) {
      case 'next': dispatch({ type: 'NEXT' }); break
      case 'previous': dispatch({ type: 'PREVIOUS' }); break
      case 'random': dispatch({ type: 'RANDOM' }); break
      // s.zoom always holds the real on-screen scale (fit scale is published
      // by the Canvas), so stepping from it works in both fit and zoom modes.
      case 'zoom_in': dispatch({ type: 'SET_ZOOM', payload: s.zoom * 1.25 }); break
      case 'zoom_out': dispatch({ type: 'SET_ZOOM', payload: s.zoom / 1.25 }); break
      case 'fit_to_page': dispatch({ type: 'SET_FIT' }); break
      case 'keep':
        if (currentFile) {
          if (s.config?.keep) {
            const { ok } = await window.api.file.move({ src: currentFile.full_path, destDir: s.config.keep })
            if (!ok) break
          }
          dispatch({ type: 'REMOVE_FILE', payload: currentFile.full_path })
        }
        break
      case 'reject':
        if (currentFile) {
          const destDir = s.config?.reject || `${parentDir(currentFile.full_path)}\\Rejected`
          const { ok } = await window.api.file.move({ src: currentFile.full_path, destDir })
          if (ok) dispatch({ type: 'REMOVE_FILE', payload: currentFile.full_path })
        }
        break
      case 'delete':
        if (currentFile) {
          const confirmed = !s.config?.options?.confirm_delete || await window.api.dialog.confirm({
            title: 'Delete File',
            message: `Permanently delete ${currentFile.filename}?`,
            detail: 'This cannot be undone.'
          })
          if (confirmed) {
            const res = await window.api.file.delete({ filePath: currentFile.full_path })
            if (res.ok) dispatch({ type: 'REMOVE_FILE', payload: currentFile.full_path })
          }
        }
        break
      case 'skip':
        if (currentFile) dispatch({ type: 'SET_DISPOSITION', payload: { path: currentFile.full_path, disposition: 'skipped' } })
        dispatch({ type: 'NEXT' })
        break
      case 'context_menu':
        if (currentFile) window.api.shell.contextMenu({ filePath: currentFile.full_path })
        break
      case 'disabled':
      default:
        break
    }
  }, [dispatch])

  useEffect(() => {
    const getSettings = () => {
      const s = stateRef.current
      if (!s.config) return null
      return s.config[`${s.mode}_settings`]
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+, opens settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        dispatch({ type: 'OPEN_SETTINGS' })
        return
      }
      // Ctrl+O opens folder
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        loadFolder()
        return
      }
      // F5 reloads current folder
      if (e.key === 'F5') {
        e.preventDefault()
        reloadCurrentFolder()
        return
      }
      // Ctrl+wheel is always zoom — handled in wheel handler
      // Don't fire inside inputs/textareas
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

      const settings = getSettings()
      if (!settings) return
      const action = settings.key_mappings[e.code] || settings.key_mappings[e.key]
      if (action) {
        e.preventDefault()
        executeAction(action)
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('button, input, select, textarea, a, [role="button"], [role="dialog"]')) return
      mouseDownPos.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (!mouseDownPos.current) return
      const dx = e.clientX - mouseDownPos.current.x
      const dy = e.clientY - mouseDownPos.current.y
      mouseDownPos.current = null
      // Only fire click action if mouse didn't drag
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return

      const settings = getSettings()
      if (!settings) return
      let action: Action | undefined
      if (e.button === 0) action = settings.button_mappings.left_click
      else if (e.button === 2) action = settings.button_mappings.right_click
      else if (e.button === 1) action = settings.button_mappings.middle_click
      if (action) executeAction(action)
    }

    const onWheel = (e: WheelEvent) => {
      const settings = getSettings()
      if (!settings) return
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const action: Action = e.deltaY < 0 ? 'zoom_in' : 'zoom_out'
        executeAction(action)
        return
      }
      // Throttle navigation so a single fast scroll over the image doesn't
      // dispatch a burst of NEXT/PREVIOUS faster than the images can decode.
      const now = Date.now()
      if (now - lastWheelNavRef.current < 90) return
      lastWheelNavRef.current = now
      const action = e.deltaY < 0 ? settings.wheel_mappings.wheel_up : settings.wheel_mappings.wheel_down
      executeAction(action)
    }

    // Keyboard is global; pointer/wheel are scoped to the canvas so the
    // surrounding UI (Queue grid, Inspector, rail) doesn't fire image actions.
    const pointerTarget: HTMLElement | Document = targetRef?.current ?? document
    document.addEventListener('keydown', onKeyDown)
    pointerTarget.addEventListener('mousedown', onMouseDown as EventListener)
    pointerTarget.addEventListener('mouseup', onMouseUp as EventListener)
    pointerTarget.addEventListener('wheel', onWheel as EventListener, { passive: false })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      pointerTarget.removeEventListener('mousedown', onMouseDown as EventListener)
      pointerTarget.removeEventListener('mouseup', onMouseUp as EventListener)
      pointerTarget.removeEventListener('wheel', onWheel as EventListener)
    }
  }, [dispatch, executeAction, targetRef])
}
