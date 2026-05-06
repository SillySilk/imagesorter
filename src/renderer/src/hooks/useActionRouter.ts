import { useEffect, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useLoadFolder } from './useLoadFolder'
import type { Action } from '../../../main/config'

export function useActionRouter() {
  const { state, dispatch } = useApp()
  const { loadFolder, reloadCurrentFolder } = useLoadFolder()
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const executeAction = useCallback(async (action: Action) => {
    const s = stateRef.current
    const currentFile = s.files[s.currentIndex] || null

    switch (action) {
      case 'next': dispatch({ type: 'NEXT' }); break
      case 'previous': dispatch({ type: 'PREVIOUS' }); break
      case 'random': dispatch({ type: 'RANDOM' }); break
      case 'zoom_in': dispatch({ type: 'SET_ZOOM', payload: s.zoom * 1.25 }); break
      case 'zoom_out': dispatch({ type: 'SET_ZOOM', payload: s.zoom / 1.25 }); break
      case 'fit_to_page':
        dispatch({ type: 'SET_ZOOM', payload: 1 })
        dispatch({ type: 'SET_PAN', payload: { x: 0, y: 0 } })
        break
      case 'keep':
        if (currentFile && s.config?.keep) {
          const { ok } = await window.api.file.move({ src: currentFile.full_path, destDir: s.config.keep })
          if (ok) {
            dispatch({ type: 'SET_DISPOSITION', payload: { path: currentFile.full_path, disposition: 'kept' } })
            if (s.config?.options?.auto_advance) dispatch({ type: 'NEXT' })
          }
        }
        break
      case 'reject':
        if (currentFile) {
          if (s.config?.reject) {
            const { ok } = await window.api.file.move({ src: currentFile.full_path, destDir: s.config.reject })
            if (ok) {
              dispatch({ type: 'SET_DISPOSITION', payload: { path: currentFile.full_path, disposition: 'rejected' } })
              if (s.config?.options?.auto_advance) dispatch({ type: 'NEXT' })
            }
          } else if (s.config?.options?.confirm_delete) {
            const confirmed = await window.api.dialog.confirm({
              title: 'Delete File',
              message: `Permanently delete ${currentFile.filename}?`,
              detail: 'No reject folder is configured.'
            })
            if (confirmed) {
              await window.api.file.delete({ filePath: currentFile.full_path })
              dispatch({ type: 'SET_DISPOSITION', payload: { path: currentFile.full_path, disposition: 'rejected' } })
              if (s.config?.options?.auto_advance) dispatch({ type: 'NEXT' })
            }
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
      const action = e.deltaY < 0 ? settings.wheel_mappings.wheel_up : settings.wheel_mappings.wheel_down
      executeAction(action)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('wheel', onWheel)
    }
  }, [dispatch, executeAction])
}
