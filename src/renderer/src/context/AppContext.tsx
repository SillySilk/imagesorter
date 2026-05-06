import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import type { Config } from '../../../main/config'

export interface FileInfo {
  filename: string
  relative_path: string
  full_path: string
  type: 'image' | 'video'
}

export type Disposition = 'kept' | 'rejected' | 'skipped' | null

export interface AppState {
  config: Config | null
  files: FileInfo[]
  currentIndex: number
  mode: 'sort' | 'view'
  zoom: number
  panOffset: { x: number; y: number }
  railTab: 'browse' | 'sort' | 'film' | 'utils' | 'history'
  settingsOpen: boolean
  settingsTab: string
  dispositions: Record<string, Disposition>
  isLoading: boolean
  version: string
}

type AppAction =
  | { type: 'SET_CONFIG'; payload: Config }
  | { type: 'SET_FILES'; payload: FileInfo[] }
  | { type: 'SET_INDEX'; payload: number }
  | { type: 'SET_MODE'; payload: 'sort' | 'view' }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'SET_RAIL_TAB'; payload: AppState['railTab'] }
  | { type: 'OPEN_SETTINGS'; payload?: string }
  | { type: 'CLOSE_SETTINGS' }
  | { type: 'SET_DISPOSITION'; payload: { path: string; disposition: Disposition } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_VERSION'; payload: string }
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'RANDOM' }

const initialState: AppState = {
  config: null,
  files: [],
  currentIndex: 0,
  mode: 'view',
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  railTab: 'sort',
  settingsOpen: false,
  settingsTab: 'general',
  dispositions: {},
  isLoading: false,
  version: '0.7.0'
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        config: action.payload,
        mode: action.payload.app_mode === 'last' ? state.mode : (action.payload.app_mode || 'view')
      }
    case 'SET_FILES':
      return { ...state, files: action.payload, currentIndex: 0, dispositions: {} }
    case 'SET_INDEX':
      return { ...state, currentIndex: Math.max(0, Math.min(action.payload, state.files.length - 1)), zoom: 1, panOffset: { x: 0, y: 0 } }
    case 'SET_MODE':
      return { ...state, mode: action.payload }
    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.1, Math.min(10, action.payload)) }
    case 'SET_PAN':
      return { ...state, panOffset: action.payload }
    case 'SET_RAIL_TAB':
      return { ...state, railTab: action.payload }
    case 'OPEN_SETTINGS':
      return { ...state, settingsOpen: true, settingsTab: action.payload || 'general' }
    case 'CLOSE_SETTINGS':
      return { ...state, settingsOpen: false }
    case 'SET_DISPOSITION':
      return { ...state, dispositions: { ...state.dispositions, [action.payload.path]: action.payload.disposition } }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_VERSION':
      return { ...state, version: action.payload }
    case 'NEXT':
      return state.currentIndex < state.files.length - 1
        ? { ...state, currentIndex: state.currentIndex + 1, zoom: 1, panOffset: { x: 0, y: 0 } }
        : state
    case 'PREVIOUS':
      return state.currentIndex > 0
        ? { ...state, currentIndex: state.currentIndex - 1, zoom: 1, panOffset: { x: 0, y: 0 } }
        : state
    case 'RANDOM': {
      if (state.files.length <= 1) return state
      let idx = Math.floor(Math.random() * state.files.length)
      if (idx === state.currentIndex) idx = (idx + 1) % state.files.length
      return { ...state, currentIndex: idx, zoom: 1, panOffset: { x: 0, y: 0 } }
    }
    default:
      return state
  }
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> } | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const init = async () => {
      try {
        const [config, version] = await Promise.all([
          window.api.config.load(),
          window.api.app.version()
        ])
        dispatch({ type: 'SET_CONFIG', payload: config })
        dispatch({ type: 'SET_VERSION', payload: version })

        // Auto-load last used source folder
        if (config.src) {
          dispatch({ type: 'SET_LOADING', payload: true })
          try {
            const files = await window.api.scanner.scan({
              dir: config.src,
              recursive: config.options?.recursive_loading || false,
              fileTypes: config.options?.file_types || []
            })
            dispatch({ type: 'SET_FILES', payload: files })
          } catch (e) {
            console.warn('Auto-load failed:', e)
          } finally {
            dispatch({ type: 'SET_LOADING', payload: false })
          }
        }
      } catch (e) {
        console.error('Init failed:', e)
      }
    }
    init()
  }, [])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
