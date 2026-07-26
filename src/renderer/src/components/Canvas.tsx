import React, { useRef, useCallback, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import {
  IcAperture, IcPrev, IcNext, IcCheck, IcX, IcShuffle, IcStar,
  IcZoomIn, IcZoomOut, IcFit, IcFull, IcFolder, IcCopy, IcCropSelect
} from './Icons'
import CinemaPlayer from './utilities/CinemaPlayer'
import { useActionRouter } from '../hooks/useActionRouter'
import { useFileActions } from '../hooks/useFileActions'
import { useLoadFolder } from '../hooks/useLoadFolder'

export default function Canvas() {
  const { state, dispatch } = useApp()
  const { files, currentIndex, mode, zoom, fitMode, panOffset, config } = state
  const containerRef = useRef<HTMLDivElement>(null)
  const imageFrameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Scope pointer/wheel actions to the canvas so clicks and scrolls over the
  // Inspector / Queue grid don't trigger keep/reject/next.
  useActionRouter(containerRef)
  // Same implementations the keyboard router uses, so the dock buttons, the
  // crop flow and the native context menu all record undo and session counts.
  const { keep, reject, deletePermanent } = useFileActions()
  const { loadFolder } = useLoadFolder()

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [cropFeedback, setCropFeedback] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [frameSize, setFrameSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  // The URL currently painted in the <img>. It lags `currentFile` by one decode:
  // we keep showing the previous frame until the next image has fully loaded, so
  // navigation never flashes the dark frame.
  const [displayedUrl, setDisplayedUrl] = useState<string | null>(null)
  const pendingUrlRef = useRef<string | null>(null)

  const currentFile = files[currentIndex] || null
  const isVideo = currentFile?.type === 'video' && config?.utilities?.cinema?.auto_switch
  const imageUrl = currentFile ? `aperture://${encodeURIComponent(currentFile.full_path)}` : null

  // Fit scale = largest scale (capped at 100%) that shows the whole image in
  // the frame. effectiveScale is the real on-screen scale: fit scale in fit
  // mode, otherwise the absolute zoom (1.0 == 100% native pixels).
  const fitScale = (naturalSize && frameSize.w > 0 && frameSize.h > 0)
    ? Math.min(frameSize.w / naturalSize.w, frameSize.h / naturalSize.h, 1)
    : 1
  const effectiveScale = fitMode ? fitScale : zoom

  // Refs for use inside stable callbacks
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const selectionRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const currentFileRef = useRef(files[currentIndex] || null)
  currentFileRef.current = files[currentIndex] || null
  const effectiveScaleRef = useRef(effectiveScale)
  effectiveScaleRef.current = effectiveScale
  const panOffsetRef = useRef(panOffset)
  panOffsetRef.current = panOffset
  const naturalSizeRef = useRef(naturalSize)
  naturalSizeRef.current = naturalSize
  const frameSizeRef = useRef(frameSize)
  frameSizeRef.current = frameSize
  // Drag-to-pan state (active when the image is zoomed past the frame).
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  // Track the frame's pixel size so fit scale stays correct on window resize.
  useEffect(() => {
    const el = imageFrameRef.current
    if (!el) return
    const measure = () => setFrameSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [currentFile?.full_path, isVideo])

  // Preload the next image off-screen and only swap the visible frame once it
  // has decoded. The previous frame stays on screen until then (no dark flash).
  // A pending-url ref discards stale loads when navigating faster than decode.
  useEffect(() => {
    if (!imageUrl || isVideo) {
      pendingUrlRef.current = null
      if (!imageUrl) { setDisplayedUrl(null); setNaturalSize(null) }
      return
    }
    pendingUrlRef.current = imageUrl
    const img = new Image()
    img.onload = () => {
      if (pendingUrlRef.current !== imageUrl) return
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      setDisplayedUrl(imageUrl)
    }
    img.onerror = () => {
      if (pendingUrlRef.current !== imageUrl) return
      // Couldn't decode (corrupt/unsupported) — show it anyway so the broken
      // state is visible rather than silently holding the prior image.
      setNaturalSize(null)
      setDisplayedUrl(imageUrl)
    }
    img.src = imageUrl
  }, [imageUrl, isVideo])

  // Publish the resolved fit scale so the readout and zoom steps use the real
  // on-screen scale even while in fit mode.
  useEffect(() => {
    if (fitMode && Math.abs(fitScale - zoom) > 0.001) {
      dispatch({ type: 'SET_FIT_SCALE', payload: fitScale })
    }
  }, [fitMode, fitScale, zoom, dispatch])

  // How far the image overflows the frame on each axis (0 when it fits). The
  // image is centered, so it can pan by ±overflow/2 before an edge hits the
  // frame edge.
  const overflowX = naturalSize ? Math.max(0, naturalSize.w * effectiveScale - frameSize.w) : 0
  const overflowY = naturalSize ? Math.max(0, naturalSize.h * effectiveScale - frameSize.h) : 0
  const isPannable = overflowX > 0 || overflowY > 0

  // Keep the pan offset within bounds when the scale or frame changes (e.g.
  // zooming out should never leave the image stranded off-center).
  useEffect(() => {
    const cx = Math.max(-overflowX / 2, Math.min(overflowX / 2, panOffset.x))
    const cy = Math.max(-overflowY / 2, Math.min(overflowY / 2, panOffset.y))
    if (cx !== panOffset.x || cy !== panOffset.y) {
      dispatch({ type: 'SET_PAN', payload: { x: cx, y: cy } })
    }
  }, [overflowX, overflowY, panOffset.x, panOffset.y, dispatch])

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

  const showCropFeedback = useCallback((msg: string) => {
    setCropFeedback(msg)
    setTimeout(() => setCropFeedback(null), 1600)
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

    // The image is drawn at iw*S × ih*S, centered in the frame and shifted by
    // the pan offset, where S is the real on-screen scale.
    const S = effectiveScaleRef.current
    const pan = panOffsetRef.current
    const imgLeft = (fw - iw * S) / 2 + pan.x
    const imgTop = (fh - ih * S) / 2 + pan.y

    const mapToImage = (dx: number, dy: number) => ({
      x: Math.max(0, Math.min(iw, (dx - imgLeft) / S)),
      y: Math.max(0, Math.min(ih, (dy - imgTop) / S))
    })

    const p1 = mapToImage(sr.x, sr.y)
    const p2 = mapToImage(sr.x + sr.w, sr.y + sr.h)
    const cropX = Math.round(Math.min(p1.x, p2.x))
    const cropY = Math.round(Math.min(p1.y, p2.y))
    const cropW = Math.max(1, Math.round(Math.max(p1.x, p2.x)) - cropX)
    const cropH = Math.max(1, Math.round(Math.max(p1.y, p2.y)) - cropY)

    if (cropW >= 1 && cropH >= 1) {
      if (mode === 'sort') {
        // Sort mode: the drawn region is the part worth keeping (e.g. training
        // crop). Save it to the keep folder in the original's format, then
        // reject the original — the rest of the frame is discarded.
        if (!config?.keep) { showCropFeedback('NO KEEP FOLDER SET'); return }
        const result = await window.api.image.saveRegion({
          filePath: cf.full_path, x: cropX, y: cropY, width: cropW, height: cropH, destDir: config.keep
        })
        if (result.ok) {
          showCropFeedback('CROPPED → KEPT')
          reject()
        } else {
          showCropFeedback('CROP SAVE FAILED')
        }
      } else {
        const result = await window.api.image.copyRegion({
          filePath: cf.full_path, x: cropX, y: cropY, width: cropW, height: cropH
        })
        if (result.ok) showCopyFeedback()
      }
    }
  }, [showCopyFeedback, showCropFeedback, mode, config, reject])

  // Drag-to-pan handlers (image-frame level, used only when not selecting a
  // crop region). Pointer capture keeps tracking the drag outside the frame.
  const handlePanDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const ns = naturalSizeRef.current
    const fs = frameSizeRef.current
    const S = effectiveScaleRef.current
    if (!ns) return
    if (ns.w * S - fs.w <= 0 && ns.h * S - fs.h <= 0) return // nothing to pan
    e.currentTarget.setPointerCapture(e.pointerId)
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffsetRef.current.x, panY: panOffsetRef.current.y }
    setIsPanning(true)
  }, [])

  const handlePanMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = panStartRef.current
    if (!st) return
    const ns = naturalSizeRef.current
    const fs = frameSizeRef.current
    const S = effectiveScaleRef.current
    if (!ns) return
    const ox = Math.max(0, ns.w * S - fs.w)
    const oy = Math.max(0, ns.h * S - fs.h)
    const nx = Math.max(-ox / 2, Math.min(ox / 2, st.panX + (e.clientX - st.x)))
    const ny = Math.max(-oy / 2, Math.min(oy / 2, st.panY + (e.clientY - st.y)))
    dispatch({ type: 'SET_PAN', payload: { x: nx, y: ny } })
  }, [dispatch])

  const handlePanUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    panStartRef.current = null
    setIsPanning(false)
  }, [])

  const handleDock = useCallback((action: string) => {
    switch (action) {
      case 'prev': dispatch({ type: 'PREVIOUS' }); break
      case 'next': dispatch({ type: 'NEXT' }); break
      case 'random': dispatch({ type: 'RANDOM' }); break
      case 'zoom_in': dispatch({ type: 'SET_ZOOM', payload: effectiveScale * 1.25 }); break
      case 'zoom_out': dispatch({ type: 'SET_ZOOM', payload: effectiveScale / 1.25 }); break
      case 'fit': dispatch({ type: 'SET_FIT' }); break
      case 'keep': keep(); break
      case 'reject': reject(); break
    }
  }, [effectiveScale, dispatch, keep, reject])

  // The native right-click menu dispatches over IPC. useFileActions' callbacks
  // are stable and read state through a ref, so registering once is safe.
  useEffect(() => {
    return window.api.app.onCanvasAction(({ type }) => {
      if (type === 'reject') reject()
      else if (type === 'delete') deletePermanent()
    })
  }, [reject, deletePermanent])

  const handleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  const disposition = currentFile ? state.dispositions[currentFile.full_path] : null

  return (
    <div className="canvas" ref={containerRef}>
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
        {cropFeedback && <span className="chip" style={{ color: '#98c486' }}>⬚ {cropFeedback}</span>}
      </div>
      <div className="hud hud-tr">
        <span className="chip">
          {files.length > 0 ? `${currentIndex + 1} / ${files.length}` : '— / —'}
        </span>
        <span className="chip">{fitMode ? `Fit · ${Math.round(effectiveScale * 100)}%` : `${Math.round(effectiveScale * 100)}%`}</span>
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
          onPointerDown={!selectionMode ? handlePanDown : undefined}
          onPointerMove={!selectionMode ? handlePanMove : undefined}
          onPointerUp={!selectionMode ? handlePanUp : undefined}
          onPointerCancel={!selectionMode ? handlePanUp : undefined}
          style={imageUrl ? {
            background: '#06040a',
            overflow: 'hidden',
            cursor: isPanning ? 'grabbing' : (!selectionMode && isPannable ? 'grab' : 'default')
          } : undefined}
        >
          {imageUrl ? (
            <>
              <img
                ref={imgRef}
                src={displayedUrl || ''}
                alt={currentFile?.filename}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: naturalSize ? naturalSize.w * effectiveScale : 'auto',
                  height: naturalSize ? naturalSize.h * effectiveScale : 'auto',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate(-50%, -50%) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transformOrigin: 'center center',
                  visibility: displayedUrl && naturalSize ? 'visible' : 'hidden',
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
          <button className="dock-zoom-btn" title="Zoom out (−)" onClick={() => handleDock('zoom_out')}><IcZoomOut /></button>
          <span
            className="dock-zoom-readout"
            title={fitMode ? 'Click for 100%' : 'Click to fit'}
            onClick={() => dispatch(fitMode ? { type: 'SET_ZOOM', payload: 1 } : { type: 'SET_FIT' })}
          >
            {fitMode ? `Fit · ${Math.round(effectiveScale * 100)}%` : `${Math.round(effectiveScale * 100)}%`}
          </span>
          <button className="dock-zoom-btn" title="Zoom in (+)" onClick={() => handleDock('zoom_in')}><IcZoomIn /></button>
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
