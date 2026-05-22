import React, { useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import TitleBar from './components/TitleBar'
import Rail from './components/Rail'
import Canvas from './components/Canvas'
import Inspector from './components/Inspector'
import UtilitiesPanel from './components/utilities/UtilitiesPanel'
import StatusBar from './components/StatusBar'
import PreferencesModal from './components/preferences/PreferencesModal'

function AppShell() {
  const { state, dispatch } = useApp()

  const openSettings = useCallback((tab?: string) => {
    dispatch({ type: 'OPEN_SETTINGS', payload: tab })
  }, [dispatch])

  return (
    <div className="app grain leather">
      <TitleBar />
      <Rail onOpenSettings={() => openSettings()} />
      <div className="main">
        <Canvas />
        {state.railTab === 'utils' ? <UtilitiesPanel /> : <Inspector />}
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
