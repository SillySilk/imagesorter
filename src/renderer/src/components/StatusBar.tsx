import React from 'react'
import { useApp } from '../context/AppContext'

export default function StatusBar() {
  const { state } = useApp()
  const { mode, config, files } = state

  const srcName = config?.src ? config.src : '—'
  const keepName = config?.keep ? config.keep : '—'
  const keptCount = Object.values(state.dispositions).filter(d => d === 'kept').length
  const rejectedCount = Object.values(state.dispositions).filter(d => d === 'rejected').length

  return (
    <div className="statusbar">
      <span className={`pip ${files.length > 0 ? 'live' : ''}`}>
        {mode === 'sort' ? 'CULL MODE' : 'VIEW MODE'}
      </span>
      <span>SRC <span style={{ color: 'var(--silver-2)' }}>{srcName}</span></span>
      <span>KEEP <span style={{ color: 'var(--silver-2)' }}>{keepName}</span></span>
      {files.length > 0 && (
        <>
          <span style={{ color: '#98c486' }}>✓ {keptCount}</span>
          <span style={{ color: 'var(--wine-3)' }}>✕ {rejectedCount}</span>
        </>
      )}
      <span className="grow"></span>
      <span className="pip ok">{config ? 'SETTINGS OK' : 'LOADING'}</span>
      <span>v{state.version}</span>
    </div>
  )
}
