import React from 'react'
import { useApp } from '../context/AppContext'
import { useLoadFile } from '../hooks/useLoadFile'
import { useLoadFolder } from '../hooks/useLoadFolder'
import { IcFile, IcFolder } from './Icons'

export default function TitleBar() {
  const { state, dispatch } = useApp()
  const { mode, files, currentIndex, config } = state
  const { loadFile } = useLoadFile()
  const { loadFolder } = useLoadFolder()

  const srcName = config?.src ? config.src.split(/[\\/]/).pop() : null
  const frameInfo = files.length > 0 ? `${srcName || 'folder'} · ${files.length} frames` : null

  return (
    <div className="titlebar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="brand" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="brand-mark"></div>
        <div>
          <div className="brand-name">Aper<span className="accent">ture</span></div>
          <div className="brand-tag">Image Suite · v{state.version}</div>
        </div>
      </div>

      <div className="titlebar-open-btns" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={loadFile} title="Open a single image or video file">
          <IcFile width={12} height={12} />
          Open File
        </button>
        <button onClick={() => loadFolder()} title="Open a folder of images">
          <IcFolder width={12} height={12} />
          Open Folder
        </button>
      </div>

      <div className="titlebar-spacer"></div>

      <div className="title-meta" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="seg" style={{ padding: '1px' }}>
          <button
            className={mode === 'sort' ? 'on' : ''}
            onClick={() => dispatch({ type: 'SET_MODE', payload: 'sort' })}
          >Sort</button>
          <button
            className={mode === 'view' ? 'on' : ''}
            onClick={() => dispatch({ type: 'SET_MODE', payload: 'view' })}
          >View</button>
        </div>
        {frameInfo && <span><span className="dot"></span>{frameInfo}</span>}
      </div>

      <div className="win-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="min" title="Minimize" onClick={() => window.api.window.minimize()} style={{ cursor: 'pointer' }}></span>
        <span className="max" title="Maximize" onClick={() => window.api.window.maximize()} style={{ cursor: 'pointer' }}></span>
        <span className="close" title="Close" onClick={() => window.api.window.close()} style={{ cursor: 'pointer' }}></span>
      </div>
    </div>
  )
}
