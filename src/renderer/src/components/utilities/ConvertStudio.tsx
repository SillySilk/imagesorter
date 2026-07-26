import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { IcBack, IcConvert } from '../Icons'

interface Props {
  onBack: () => void
}

type Format = 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'
type ResizeMode = 'none' | 'long' | 'pct'
type Status = 'idle' | 'processing' | 'done' | 'error'

const FORMATS: { v: Format; label: string; lossless?: boolean }[] = [
  { v: 'jpeg', label: 'JPEG' },
  { v: 'png',  label: 'PNG (lossless)', lossless: true },
  { v: 'webp', label: 'WebP' },
  { v: 'avif', label: 'AVIF' },
  { v: 'tiff', label: 'TIFF' }
]

const EXT: Record<Format, string> = {
  jpeg: '.jpg', png: '.png', webp: '.webp', avif: '.avif', tiff: '.tif'
}

interface BatchProgress {
  done: number
  total: number
  failed: { filename: string; error: string }[]
  cancelled: boolean
}

function SubBack({ onBack }: { onBack: () => void }) {
  return (
    <button className="sub-back" onClick={onBack}>
      <IcBack style={{ width: 11, height: 11 }} /> Back to Utilities
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--silver-4)', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </div>
  )
}

export default function ConvertStudio({ onBack }: Props) {
  const { state, dispatch } = useApp()
  const currentFile = state.files[state.currentIndex] || null
  const saved = state.config?.utilities?.convert

  // Don't trust the saved value — a config written before the format names were
  // normalised would otherwise select an option that doesn't exist.
  const savedFormat = saved?.format?.toLowerCase() as Format | undefined
  const [format, setFormat] = useState<Format>(
    savedFormat && FORMATS.some(f => f.v === savedFormat) ? savedFormat : 'jpeg'
  )
  const [quality, setQuality] = useState<number>(saved?.quality ?? 92)
  const savedResize = saved?.resize as ResizeMode | undefined
  const [resizeMode, setResizeMode] = useState<ResizeMode>(
    savedResize === 'long' || savedResize === 'pct' ? savedResize : 'none'
  )
  const [longEdge, setLongEdge] = useState(2048)
  const [pct, setPct] = useState(50)
  const [stripMetadata, setStripMetadata] = useState<boolean>(saved?.strip_metadata ?? false)
  const [mirrorFolders, setMirrorFolders] = useState<boolean>(saved?.mirror_folders ?? false)
  const [outputDir, setOutputDir] = useState<'source' | string>('source')

  const [status, setStatus] = useState<Status>('idle')
  const [resultPath, setResultPath] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)
  const [batch, setBatch] = useState<BatchProgress | null>(null)
  const cancelRef = useRef(false)

  const imageFiles = state.files.filter(f => f.type === 'image')
  const isLossless = format === 'png'
  const isBatching = batch !== null && batch.done < batch.total && !batch.cancelled

  // Dimensions of the current image — cancelled flag prevents stale-closure races
  useEffect(() => {
    let cancelled = false
    setDimensions(null)
    setStatus('idle')
    setResultPath(null)
    setErrorMsg(null)
    if (!currentFile || currentFile.type !== 'image') return
    window.api.image.metadata({ filePath: currentFile.full_path })
      .then(m => {
        if (cancelled) return
        setDimensions(m.width && m.height ? { w: m.width, h: m.height } : { w: 0, h: 0 })
      })
      .catch(() => { if (!cancelled) setDimensions({ w: 0, h: 0 }) })
    return () => { cancelled = true }
  }, [currentFile?.full_path])

  const buildResize = useCallback(() => {
    if (resizeMode === 'long') return { mode: 'long' as const, px: longEdge }
    if (resizeMode === 'pct') return { mode: 'pct' as const, pct }
    return { mode: 'none' as const }
  }, [resizeMode, longEdge, pct])

  /** Persist the current settings so they're the defaults next time. */
  const persistSettings = useCallback(async () => {
    const config = state.config
    if (!config) return
    const updated = {
      ...config,
      utilities: {
        ...config.utilities,
        convert: {
          ...config.utilities.convert,
          format,
          quality,
          resize: resizeMode,
          strip_metadata: stripMetadata,
          mirror_folders: mirrorFolders
        }
      }
    }
    await window.api.config.save(updated)
    dispatch({ type: 'SET_CONFIG', payload: updated })
  }, [state.config, format, quality, resizeMode, stripMetadata, mirrorFolders, dispatch])

  const handlePickDir = useCallback(async () => {
    const dir = await window.api.dialog.openFolder()
    if (dir) setOutputDir(dir)
  }, [])

  const handleRun = useCallback(async () => {
    if (!currentFile) return
    setStatus('processing')
    setResultPath(null)
    setErrorMsg(null)
    setBatch(null)
    try {
      const result = await window.api.convert.process({
        filePath: currentFile.full_path,
        format,
        quality,
        resize: buildResize(),
        stripMetadata,
        destDir: outputDir === 'source' ? null : outputDir,
        mirrorFrom: null
      })
      if (result.ok && result.outputPath) {
        setResultPath(result.outputPath)
        setStatus('done')
        persistSettings()
      } else {
        setErrorMsg(result.error || 'Unknown error')
        setStatus('error')
      }
    } catch (e: unknown) {
      setErrorMsg(String(e))
      setStatus('error')
    }
  }, [currentFile, format, quality, buildResize, stripMetadata, outputDir, persistSettings])

  const handleBatch = useCallback(async () => {
    if (imageFiles.length === 0) return
    cancelRef.current = false
    setStatus('processing')
    setResultPath(null)
    setErrorMsg(null)

    const total = imageFiles.length
    const failed: BatchProgress['failed'] = []
    setBatch({ done: 0, total, failed: [], cancelled: false })

    // Sequential on purpose: sharp is already multi-threaded per image, and a
    // parallel fan-out over a few thousand files would thrash memory.
    const destDir = outputDir === 'source' ? null : outputDir
    const mirrorFrom = destDir && mirrorFolders ? (state.config?.src || null) : null
    const resize = buildResize()

    for (let i = 0; i < total; i++) {
      if (cancelRef.current) {
        setBatch({ done: i, total, failed: [...failed], cancelled: true })
        setStatus('idle')
        return
      }
      const f = imageFiles[i]
      try {
        const res = await window.api.convert.process({
          filePath: f.full_path, format, quality, resize, stripMetadata, destDir, mirrorFrom
        })
        if (!res.ok) failed.push({ filename: f.filename, error: res.error || 'Unknown error' })
      } catch (e: unknown) {
        failed.push({ filename: f.filename, error: String(e) })
      }
      setBatch({ done: i + 1, total, failed: [...failed], cancelled: false })
    }

    setStatus(failed.length === total ? 'error' : 'done')
    if (failed.length === total) setErrorMsg('Every file failed to convert.')
    persistSettings()
  }, [imageFiles, format, quality, buildResize, stripMetadata, outputDir, mirrorFolders, state.config?.src, persistSettings])

  const canRun = !!currentFile && currentFile.type === 'image' && status !== 'processing' && !!dimensions && dimensions.w > 0

  const outputName = currentFile
    ? currentFile.filename.replace(/\.[^.]+$/, '') + EXT[format]
    : null

  const previewDims = (() => {
    if (!dimensions || dimensions.w === 0) return null
    if (resizeMode === 'long' && longEdge > 0) {
      const scale = Math.min(longEdge / Math.max(dimensions.w, dimensions.h), 1)
      return { w: Math.round(dimensions.w * scale), h: Math.round(dimensions.h * scale) }
    }
    if (resizeMode === 'pct' && pct > 0) {
      return { w: Math.max(1, Math.round(dimensions.w * pct / 100)), h: Math.max(1, Math.round(dimensions.h * pct / 100)) }
    }
    return { w: dimensions.w, h: dimensions.h }
  })()

  return (
    <div className="sub-view">
      <SubBack onBack={onBack} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div className="util-icon" style={{ width: 28, height: 28, flexShrink: 0 }}>
          <IcConvert style={{ width: 14, height: 14 }} />
        </div>
        <h2 className="section-title" style={{ fontSize: 15, margin: 0 }}>File <em>Conversion</em></h2>
      </div>
      <div className="section-sub" style={{ marginBottom: 14 }}>JPEG · PNG · WebP · AVIF · TIFF</div>

      {/* Source */}
      <div className="card" style={{ marginBottom: 10 }}>
        <Label>Source</Label>
        {currentFile && currentFile.type === 'image' ? (
          <>
            <div style={{ fontSize: 11, color: 'var(--silver-2)', fontFamily: 'var(--mono)', wordBreak: 'break-all', marginBottom: 6 }}>
              {currentFile.filename}
            </div>
            {dimensions === null ? (
              <div style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>reading dimensions…</div>
            ) : dimensions.w === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--wine-3)', fontFamily: 'var(--mono)' }}>
                Cannot read dimensions — this format may not be convertible
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  {dimensions.w} × {dimensions.h}
                </div>
                <div style={{ color: 'var(--wine-3)', fontSize: 10, fontFamily: 'var(--mono)' }}>→</div>
                <div style={{ fontSize: 10, color: '#98c486', fontFamily: 'var(--mono)' }}>
                  {previewDims ? `${previewDims.w} × ${previewDims.h}` : '—'}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>
            {currentFile ? 'Video files cannot be converted here.' : 'No image loaded.'}
          </div>
        )}
      </div>

      {/* Format */}
      <div style={{ marginBottom: 10 }}>
        <Label>Output Format</Label>
        <div className="select" style={{ width: '100%' }}>
          <select value={format} onChange={e => setFormat(e.target.value as Format)} style={{ width: '100%' }}>
            {FORMATS.map(({ v, label }) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>

      {/* Quality — meaningless for PNG, which is lossless */}
      {!isLossless && (
        <div style={{ marginBottom: 10 }}>
          <Label>Quality</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={1} max={100} value={quality}
              className="slider"
              style={{ '--p': `${quality}%` } as React.CSSProperties}
              onChange={e => setQuality(Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)', minWidth: 26, textAlign: 'right' }}>
              {quality}
            </span>
          </div>
        </div>
      )}

      {/* Resize */}
      <div style={{ marginBottom: 10 }}>
        <Label>Resize</Label>
        <div className="seg" style={{ padding: 2 }}>
          {([['none', 'None'], ['long', 'Long edge'], ['pct', 'Percent']] as const).map(([v, label]) => (
            <button key={v} className={resizeMode === v ? 'on' : ''} onClick={() => setResizeMode(v)}>
              {label}
            </button>
          ))}
        </div>
        {resizeMode === 'long' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input
              type="number" min={1} max={20000} value={longEdge}
              onChange={e => setLongEdge(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: 90, padding: '5px 8px', background: 'var(--ink-0)',
                border: '1px solid var(--line-2)', borderRadius: 3,
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-2)'
              }}
            />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)' }}>px · never enlarges</span>
          </div>
        )}
        {resizeMode === 'pct' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <input
              type="range" min={1} max={200} value={pct}
              className="slider"
              style={{ '--p': `${(pct / 200) * 100}%` } as React.CSSProperties}
              onChange={e => setPct(Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)', minWidth: 34, textAlign: 'right' }}>
              {pct}%
            </span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Label>Strip Metadata</Label>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)', marginTop: -2 }}>
            Remove EXIF, XMP and ICC from the output
          </div>
        </div>
        <div
          className={`toggle${stripMetadata ? ' on' : ''}`}
          role="switch"
          aria-checked={stripMetadata}
          onClick={() => setStripMetadata(v => !v)}
        />
      </div>

      {/* Output location */}
      <div style={{ marginBottom: 14 }}>
        <Label>Save To</Label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div
            style={{
              flex: 1, padding: '5px 8px',
              background: 'var(--ink-0)', border: '1px solid var(--line-2)',
              borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 10,
              color: outputDir === 'source' ? 'var(--text-mute)' : 'var(--silver-2)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}
          >
            {outputDir === 'source' ? 'Same folder as source' : outputDir}
          </div>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 10, whiteSpace: 'nowrap' }} onClick={handlePickDir}>
            Browse
          </button>
          {outputDir !== 'source' && (
            <button className="btn" style={{ padding: '5px 8px', fontSize: 10 }} onClick={() => setOutputDir('source')}>×</button>
          )}
        </div>
        {outputDir !== 'source' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)' }}>
              Mirror source folder structure
            </span>
            <div
              className={`toggle${mirrorFolders ? ' on' : ''}`}
              role="switch"
              aria-checked={mirrorFolders}
              onClick={() => setMirrorFolders(v => !v)}
            />
          </div>
        )}
        {outputName && (
          <div style={{ marginTop: 5, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-mute)', letterSpacing: '0.06em' }}>
            → {outputName}
          </div>
        )}
      </div>

      {/* Run */}
      <button
        className="btn primary"
        style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 12 }}
        onClick={handleRun}
        disabled={!canRun || isBatching}
      >
        {status === 'processing' && !batch
          ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="upscale-spinner" /> Converting…</span>
          : `Convert This Image — ${FORMATS.find(f => f.v === format)?.label.split(' ')[0]}`
        }
      </button>

      {/* Batch */}
      <div className="card" style={{ marginTop: 12 }}>
        <Label>Batch</Label>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>
          {imageFiles.length} image{imageFiles.length === 1 ? '' : 's'} in the loaded queue
        </div>

        {isBatching ? (
          <>
            <div style={{ height: 4, background: 'var(--ink-0)', border: '1px solid var(--line-2)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${(batch!.done / batch!.total) * 100}%`, height: '100%', background: 'var(--wine-3)', transition: 'width 120ms linear' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)' }}>
                {batch!.done} / {batch!.total}
              </span>
              <button className="btn" style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => { cancelRef.current = true }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center', padding: '7px 0', fontSize: 11 }}
            onClick={handleBatch}
            disabled={imageFiles.length === 0 || status === 'processing'}
          >
            Convert All {imageFiles.length} Images
          </button>
        )}
      </div>

      {/* Single-file result */}
      {status === 'done' && resultPath && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(152,196,134,0.08)', border: '1px solid rgba(152,196,134,0.2)', borderRadius: 3 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#98c486', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 4 }}>
            ✓ Complete
          </div>
          <div
            style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)', wordBreak: 'break-all', cursor: 'pointer' }}
            title="Click to show in Explorer"
            onClick={() => window.api.shell.showInExplorer({ filePath: resultPath })}
          >
            {resultPath.split(/[\\/]/).pop()}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)', marginTop: 2 }}>
            click filename to show in Explorer
          </div>
        </div>
      )}

      {/* Batch summary */}
      {batch && !isBatching && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line-1)', borderRadius: 3 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: batch.failed.length ? 'var(--wine-3)' : '#98c486', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 4 }}>
            {batch.cancelled ? 'Cancelled' : 'Batch complete'}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)' }}>
            {batch.done - batch.failed.length} converted · {batch.failed.length} failed
            {batch.cancelled && ` · ${batch.total - batch.done} skipped`}
          </div>
          {batch.failed.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 110, overflowY: 'auto' }}>
              {batch.failed.map(f => (
                <div key={f.filename} style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)', wordBreak: 'break-all', marginBottom: 3 }}>
                  <span style={{ color: 'var(--wine-3)' }}>{f.filename}</span> — {f.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(168,45,68,0.08)', border: '1px solid var(--line-wine)', borderRadius: 3 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--wine-3)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 4 }}>
            Error
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)' }}>{errorMsg}</div>
        </div>
      )}

      <div style={{ marginTop: 14, padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px dashed var(--line-1)', borderRadius: 3 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.1em', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--silver-5)' }}>Never overwrites</strong><br />
          If a file of the same name already exists — including the source itself when the format is unchanged — the output is suffixed <span style={{ color: 'var(--silver-3)' }}>_1</span>, <span style={{ color: 'var(--silver-3)' }}>_2</span>, and so on.
        </div>
      </div>
    </div>
  )
}
