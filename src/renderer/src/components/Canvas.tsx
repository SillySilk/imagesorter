import React, { useRef, useCallback, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import {
  IcAperture, IcPrev, IcNext, IcCheck, IcX, IcShuffle, IcStar,
  IcZoomIn, IcZoomOut, IcFit, IcFull, IcFolder, IcCopy, IcCropSelect
} from './Icons'
import CinemaPlayer from './utilities/CinemaPlayer'
import { useActionRouter } from '../hooks/useActionRouter'
import { useLoadFolder } from '../hooks/useLoadFolder'

export default function Canvas() {
  const { state, dispatch } = useApp()
  const { files, currentIndex, mode, zoom, panOffset, config } = state
  const containerRef = useRef<HTMLDivElement>(null)
  const imageFrameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useActionRouter()
  const { loadFolder } = useLoadFolder()

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)

  // Refs for use inside stable callbacks
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const selectionRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const currentFileRef = useRef(files[currentIndex] || null)
  currentFileRef.current = files[currentIndex] || null
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const panOffsetRef = useRef(panOffset)
  panOffsetRef.current = panOffset

  const currentFile = files[currentIndex] || null
  const isVideo = currentFile?.type === 'video' && config?.utilities?.cinema?.auto_switch

  // Exit selection mode on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectionMode) {
        e.stopPropagation()
        setSelectionMode(false)
        dragStartRef.current = null
        selectionRectRef.current = null
        setSelectionRect(null)
      }
    }
    document.addEventListener('keydown', onKey, { capture: true })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  }, [selectionMode])

  const showCopyFeedback = useCallback(() => {
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 1600)
  }, [])

  const handleCopyImage = useCallback(async () => {
    const cf = currentFileRef.current
    if (!cf) return
    const result = await window.api.image.copyToClipboard({ filePath: cf.full_path })
    if (result.ok) showCopyFeedback()
  }, [showCopyFeedback])

  // Pointer handlers for the selection overlay (pointer capture keeps tracking outside the element)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (!imageFrameRef.current) return
    const rect = imageFrameRef.current.getBoundingClientRect()
    dragStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    selectionRectRef.current = null
    setSelectionRect(null)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !imageFrameRef.current) return
    const rect = imageFrameRef.current.getBoundingClientRect()
    const mx = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const my = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    const ds = dragStartRef.current
    const newRect = {
      x: Math.min(ds.x, mx),
      y: Math.min(ds.y, my),
      w: Math.abs(mx - ds.x),
      h: Math.abs(my - ds.y)
    }
    selectionRectRef.current = newRect
    setSelectionRect(newRect)
  }, [])

  const handlePointerUp = useCallback(async (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    const ds = dragStartRef.current
    const sr = selectionRectRef.current
    const cf = currentFileRef.current
    dragStartRef.current = null
    selectionRectRef.current = null
    setSelectionRect(null)
    setSelectionMode(false)

    if (!ds || !sr || !cf || !imgRef.current || !imageFrameRef.current) return
    if (sr.w < 4 || sr.h < 4) return

    const frame = imageFrameRef.current
    const img = imgRef.current
    const fw = frame.offsetWidth
    const fh = frame.offsetHeight
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    if (iw === 0 || ih === 0) return

    const z = zoomRef.current
    const pan = panOffsetRef.current
    const cx = fw / 2
    const cy = fh / 2
    const imgScale = Math.min(fw / iw, fh / ih)
    const imgLeft = (fw - iw * imgScale) / 2
    const imgTop = (fh - ih * imgScale) / 2

    const mapToImage = (dx: number, dy: number) => ({
      x: Math.max(0, Math.min(iw, ((dx - cx) / z + cx - pan.x - imgLeft) / imgScale)),
      y: Math.max(0, Math.min(ih, ((dy - cy) / z + cy - pan.y - imgTop) / imgScale))
    })

    const p1 = mapToImage(sr.x, sr.y)
    const p2 = mapToImage(sr.x + sr.w, sr.y + sr.h)
    const cropX = Math.round(Math.min(p1.x, p2.x))
    const cropY = Math.round(Math.min(p1.y, p2.y))
    const cropW = Math.max(1, Math.round(Math.max(p1.x, p2.x)) - cropX)
    const cropH = Math.max(1, Math.round(Math.max(p1.y, p2.y)) - cropY)

    if (cropW >= 1 && cropH >= 1) {
      const result = await window.api.image.copyRegion({
        filePath: cf.full_path, x: cropX, y: cropY, width: cropW, height: cropH
      })
      if (result.ok) showCopyFeedback()
    }
  }, [showCopyFeedback])

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
        {selectionMode && <span className="chip" style={{ color: 'var(--sepia)' }}>DRAW AREA</span>}
        {copyFeedback && <span className="chip" style={{ color: '#98c486' }}>COPIED</span>}
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
        <div
          className="image-frame"
          ref={imageFrameRef}
          style={imageUrl ? { background: '#06040a', overflow: 'hidden' } : undefined}
        >
          {imageUrl ? (
            <>
              <img
                ref={imgRef}
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
              {selectionMode && (
                <div
                  className="selection-overlay"
                  onMouseDown={(e) => e.nativeEvent.stopPropagation()}
                  onMouseUp={(e) => e.nativeEvent.stopPropagation()}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {selectionRect && (
                    <div
                      className="selection-rect"
                      style={{
                        left: selectionRect.x,
                        top: selectionRect.y,
                        width: selectionRect.w,
                        height: selectionRect.h
                      }}
                    />
                  )}
                </div>
              )}
            </>
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
        <button className="dock-btn" title="Copy Image" onClick={handleCopyImage} disabled={!currentFile}><IcCopy /></button>
        <button
          className={`dock-btn${selectionMode ? ' active' : ''}`}
          title={selectionMode ? 'Cancel Selection (Esc)' : 'Copy Region — draw an area to copy'}
          onClick={() => {
            setSelectionMode(v => !v)
            dragStartRef.current = null
            selectionRectRef.current = null
            setSelectionRect(null)
          }}
          disabled={!currentFile}
        >
          <IcCropSelect />
        </button>
        <div className="dock-divider"></div>
        <button className="dock-btn" title="Fullscreen" onClick={handleFullscreen}><IcFull /></button>
      </div>
    </div>
  )
}
