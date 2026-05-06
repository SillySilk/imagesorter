import React, { useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import {
  IcAperture, IcPrev, IcNext, IcCheck, IcX, IcShuffle, IcStar,
  IcZoomIn, IcZoomOut, IcFit, IcFull, IcFolder
} from './Icons'
import CinemaPlayer from './utilities/CinemaPlayer'
import { useActionRouter } from '../hooks/useActionRouter'
import { useLoadFolder } from '../hooks/useLoadFolder'

export default function Canvas() {
  const { state, dispatch } = useApp()
  const { files, currentIndex, mode, zoom, panOffset, config } = state
  const containerRef = useRef<HTMLDivElement>(null)

  useActionRouter()
  const { loadFolder } = useLoadFolder()

  const currentFile = files[currentIndex] || null
  const isVideo = currentFile?.type === 'video' && config?.utilities?.cinema?.auto_switch

  const handleDock = useCallback((action: string) => {
    switch (action) {
      case 'prev': dispatch({ type: 'PREVIOUS' }); break
      case 'next': dispatch({ type: 'NEXT' }); break
      case 'random': dispatch({ type: 'RANDOM' }); break
      case 'zoom_in': dispatch({ type: 'SET_ZOOM', payload: zoom * 1.25 }); break
      case 'zoom_out': dispatch({ type: 'SET_ZOOM', payload: zoom / 1.25 }); break
      case 'fit': dispatch({ type: 'SET_ZOOM', payload: 1 }); dispatch({ type: 'SET_PAN', payload: { x: 0, y: 0 } }); break
      case 'keep': handleKeep(); break
      case 'reject': handleReject(); break
    }
  }, [zoom, dispatch])

  const handleKeep = useCallback(async () => {
    if (!currentFile || !config?.keep) return
    const { ok } = await window.api.file.move({ src: currentFile.full_path, destDir: config.keep })
    if (ok) {
      dispatch({ type: 'SET_DISPOSITION', payload: { path: currentFile.full_path, disposition: 'kept' } })
      if (config?.options?.auto_advance) dispatch({ type: 'NEXT' })
    }
  }, [currentFile, config, dispatch])

  const handleReject = useCallback(async () => {
    if (!currentFile) return
    if (config?.reject) {
      const { ok } = await window.api.file.move({ src: currentFile.full_path, destDir: config.reject })
      if (ok) {
        dispatch({ type: 'SET_DISPOSITION', payload: { path: currentFile.full_path, disposition: 'rejected' } })
        if (config?.options?.auto_advance) dispatch({ type: 'NEXT' })
      }
    } else if (config?.options?.confirm_delete) {
      const confirmed = await window.api.dialog.confirm({
        title: 'Delete File',
        message: `Permanently delete ${currentFile.filename}?`,
        detail: 'No reject folder is configured. The file will be deleted.'
      })
      if (confirmed) {
        await window.api.file.delete({ filePath: currentFile.full_path })
        dispatch({ type: 'SET_DISPOSITION', payload: { path: currentFile.full_path, disposition: 'rejected' } })
        if (config?.options?.auto_advance) dispatch({ type: 'NEXT' })
      }
    }
  }, [currentFile, config, dispatch])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (currentFile) window.api.shell.contextMenu({ filePath: currentFile.full_path })
  }, [currentFile])

  const handleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  const disposition = currentFile ? state.dispositions[currentFile.full_path] : null
  const imageUrl = currentFile ? `aperture://${encodeURIComponent(currentFile.full_path)}` : null

  return (
    <div className="canvas" ref={containerRef} onContextMenu={handleContextMenu}>
      <span className="corner-tr"></span>
      <span className="corner-bl"></span>

      <div className="sprockets left">{Array(8).fill(0).map((_, i) => <span key={i} />)}</div>
      <div className="sprockets right">{Array(8).fill(0).map((_, i) => <span key={i} />)}</div>

      <div className="hud hud-tl">
        <span className="chip wine">{mode === 'sort' ? '◉ SORT' : '◉ VIEW'}</span>
        {disposition === 'kept' && <span className="chip" style={{ color: '#98c486' }}>KEPT</span>}
        {disposition === 'rejected' && <span className="chip" style={{ color: 'var(--wine-3)' }}>REJECTED</span>}
      </div>
      <div className="hud hud-tr">
        <span className="chip">
          {files.length > 0 ? `${currentIndex + 1} / ${files.length}` : '— / —'}
        </span>
        <span className="chip">{Math.round(zoom * 100)}%</span>
      </div>
      <div className="hud hud-bl">
        <span className="chip">{currentFile?.filename || 'no image loaded'}</span>
      </div>
      <div className="hud hud-br">
        {currentFile && <span className="chip" style={{ fontSize: 9 }}>{currentFile.relative_path || '/'}</span>}
      </div>

      {isVideo && currentFile ? (
        <CinemaPlayer file={currentFile} />
      ) : (
        <div className="image-frame" style={imageUrl ? { background: '#06040a', overflow: 'hidden' } : undefined}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={currentFile?.filename}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
              draggable={false}
            />
          ) : (
            <div
              className="placeholder"
              onClick={() => loadFolder()}
              style={{ cursor: 'pointer' }}
              title="Click to open a folder"
            >
              <IcFolder style={{ width: 48, height: 48, opacity: 0.5 }} />
              <div>Open a folder</div>
              <div style={{ fontSize: 9, opacity: 0.6 }}>click here · or use File menu · Ctrl+O</div>
            </div>
          )}
        </div>
      )}

      <div className="dock">
        <button className="dock-btn" title="Previous (←)" onClick={() => handleDock('prev')}><IcPrev /></button>
        <button className="dock-btn keep" title="Keep" onClick={() => handleDock('keep')}><IcCheck /></button>
        <button className="dock-btn reject" title="Reject" onClick={() => handleDock('reject')}><IcX /></button>
        <button className="dock-btn" title="Next (→)" onClick={() => handleDock('next')}><IcNext /></button>
        <div className="dock-divider"></div>
        <button className="dock-btn" title="Random" onClick={() => handleDock('random')}><IcShuffle /></button>
        <button className="dock-btn" title="Rate"><IcStar /></button>
        <div className="dock-zoom">
          <IcZoomOut style={{ width: 13, height: 13, cursor: 'pointer' }} onClick={() => handleDock('zoom_out')} />
          <span style={{ cursor: 'pointer' }} onClick={() => handleDock('fit')}>{Math.round(zoom * 100)}%</span>
          <IcZoomIn style={{ width: 13, height: 13, cursor: 'pointer' }} onClick={() => handleDock('zoom_in')} />
        </div>
        <button className="dock-btn" title="Fit to Page" onClick={() => handleDock('fit')}><IcFit /></button>
        <div className="dock-divider"></div>
        <button className="dock-btn" title="Fullscreen" onClick={handleFullscreen}><IcFull /></button>
      </div>
    </div>
  )
}
