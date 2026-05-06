import React, { useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import TitleBar from './components/TitleBar'
import Rail from './components/Rail'
import Canvas from './components/Canvas'
import Inspector from './components/Inspector'
import StatusBar from './components/StatusBar'
import PreferencesModal from './components/preferences/PreferencesModal'

function AppShell() {
  const { dispatch } = useApp()

  const openSettings = useCallback((tab?: string) => {
    dispatch({ type: 'OPEN_SETTINGS', payload: tab })
  }, [dispatch])

  return (
    <div className="app grain leather">
      <TitleBar onOpenSettings={() => openSettings()} />
      <Rail onOpenSettings={() => openSettings()} />
      <div className="main">
        <Canvas />
        <Inspector />
      </div>
      <StatusBar />
      <PreferencesModal />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
