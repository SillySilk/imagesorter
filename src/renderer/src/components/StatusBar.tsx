import React from 'react'
import { useApp } from '../context/AppContext'

export default function StatusBar() {
  const { state } = useApp()
  const { mode, config, files, sessionStats, undoEntry } = state

  const srcName = config?.src ? config.src : '—'
  const keepName = config?.keep ? config.keep : '—'

  return (
    <div className="statusbar">
      <span className={`pip ${files.length > 0 ? 'live' : ''}`}>
        {mode === 'sort' ? 'CULL MODE' : 'VIEW MODE'}
      </span>
      <span>SRC <span style={{ color: 'var(--silver-2)' }}>{srcName}</span></span>
      <span>KEEP <span style={{ color: 'var(--silver-2)' }}>{keepName}</span></span>
      {(files.length > 0 || sessionStats.kept > 0 || sessionStats.rejected > 0 || sessionStats.deleted > 0) && (
        <>
          <span style={{ color: '#98c486' }}>✓ {sessionStats.kept}</span>
          <span style={{ color: 'var(--wine-3)' }}>✕ {sessionStats.rejected}</span>
          <span style={{ color: 'var(--silver-4)' }}>🗑 {sessionStats.deleted}</span>
        </>
      )}
      {undoEntry && (
        <span style={{ color: 'var(--silver-4)' }} title={`Ctrl+Z restores ${undoEntry.file.filename}`}>
          ⟲ UNDO READY
        </span>
      )}
      <span className="grow"></span>
      <span className="pip ok">{config ? 'SETTINGS OK' : 'LOADING'}</span>
      <span>v{state.version}</span>
    </div>
  )
}
