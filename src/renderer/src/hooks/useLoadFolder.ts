import { useCallback } from 'react'
import { useApp } from '../context/AppContext'

export function useLoadFolder() {
  const { state, dispatch } = useApp()

  const loadFolder = useCallback(async (folderPath?: string) => {
    const src = folderPath || await window.api.dialog.openFolder()
    if (!src) return

    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const config = state.config
      const fileTypes = config?.options?.file_types || []
      const recursive = config?.options?.recursive_loading || false

      const files = await window.api.scanner.scan({ dir: src, recursive, fileTypes })

      // Update config.src and persist it
      if (config) {
        const updated = { ...config, src }
        await window.api.config.save(updated)
        dispatch({ type: 'SET_CONFIG', payload: updated })
      }

      dispatch({ type: 'SET_FILES', payload: files })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.config, dispatch])

  const reloadCurrentFolder = useCallback(async () => {
    if (!state.config?.src) return
    await loadFolder(state.config.src)
  }, [state.config?.src, loadFolder])

  return { loadFolder, reloadCurrentFolder }
}
