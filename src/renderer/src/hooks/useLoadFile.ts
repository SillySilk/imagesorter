import { useCallback } from 'react'
import { useApp } from '../context/AppContext'

function getDirFromPath(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath
}

export function useLoadFile() {
  const { state, dispatch } = useApp()

  const loadFile = useCallback(async () => {
    const filePath = await window.api.dialog.openFile()
    if (!filePath) return

    const dir = getDirFromPath(filePath)
    const config = state.config

    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const fileTypes = config?.options?.file_types || []
      const files = await window.api.scanner.scan({ dir, recursive: false, fileTypes })

      if (config) {
        const updated = { ...config, src: dir }
        await window.api.config.save(updated)
        dispatch({ type: 'SET_CONFIG', payload: updated })
      }

      dispatch({ type: 'SET_FILES', payload: files })
      const idx = files.findIndex(f => f.full_path.toLowerCase() === filePath.toLowerCase())
      if (idx > 0) dispatch({ type: 'SET_INDEX', payload: idx })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [state.config, dispatch])

  return { loadFile }
}
