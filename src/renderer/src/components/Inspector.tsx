import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { formatBytes, formatDate } from '../utils/formatters'

interface Metadata {
  width: number
  height: number
  format: string
  size: number
  created: string
  color_space?: string
}

const THUMB_BATCH = 20

export default function Inspector() {
  const { state, dispatch } = useApp()
  const { files, currentIndex, dispositions, config } = state
  const currentFile = files[currentIndex] || null

  const [meta, setMeta] = useState<Metadata | null>(null)
  const [histogram, setHistogram] = useState<number[] | null>(null)
  const [thumbMap, setThumbMap] = useState<Map<number, string>>(new Map())

  const histoRef = useRef<HTMLCanvasElement>(null)
  const currentCellRef = useRef<HTMLDivElement>(null)
  const loadGenRef = useRef(0)  // increments on each new load run to cancel stale ones

  // Load metadata when file changes
  useEffect(() => {
    if (!currentFile || currentFile.type === 'video') { setMeta(null); setHistogram(null); return }
    let cancelled = false
    window.api.image.metadata({ filePath: currentFile.full_path })
      .then(m => { if (!cancelled) setMeta(m) })
      .catch(() => {})
    window.api.image.histogram({ filePath: currentFile.full_path })
      .then(h => { if (!cancelled) setHistogram(h) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [currentFile?.full_path])

  // Load all thumbnails progressively when file list changes
  useEffect(() => {
    setThumbMap(new Map())
    if (files.length === 0) return

    const gen = ++loadGenRef.current

    const loadBatch = async (start: number) => {
      if (loadGenRef.current !== gen) return
      const batch = files.slice(start, start + THUMB_BATCH)
      if (batch.length === 0) return

      const results = await Promise.all(
        batch.map((f, offset) =>
          f.type === 'image'
            ? window.api.image.thumbnail({ filePath: f.full_path, width: 64, height: 64 })
                .then(t => ({ idx: start + offset, thumb: t }))
                .catch(() => ({ idx: start + offset, thumb: '' }))
            : Promise.resolve({ idx: start + offset, thumb: '' })
        )
      )

      if (loadGenRef.current !== gen) return
      setThumbMap(prev => {
        const next = new Map(prev)
        results.forEach(({ idx, thumb }) => next.set(idx, thumb))
        return next
      })

      // continue with next batch
      loadBatch(start + THUMB_BATCH)
    }

    loadBatch(0)
  }, [files])  // reset and reload whenever file list changes

  // Scroll current cell into view when index changes
  useEffect(() => {
    currentCellRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior })
  }, [currentIndex])

  // Draw histogram
  useEffect(() => {
    const canvas = histoRef.current
    if (!canvas || !histogram) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)
    const max = Math.max(1, ...histogram.map(v => Math.log1p(v)))
    const barW = w / 256
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, '#2a0a13')
    grad.addColorStop(0.5, '#88858a')
    grad.addColorStop(1, '#f4f2ee')
    ctx.fillStyle = grad
    for (let i = 0; i < 256; i++) {
      const barH = (Math.log1p(histogram[i]) / max) * h
      ctx.fillRect(i * barW, h - barH, barW + 0.5, barH)
    }
  }, [histogram])

  const disposition = currentFile ? dispositions[currentFile.full_path] : null

  return (
    <aside className="inspector">
      <div className="inspector-section">
        <h4>File <span className="num">{files.length > 0 ? `${currentIndex + 1} / ${files.length}` : '—'}</span></h4>
        {currentFile ? (
          <>
            <div className="kv"><span className="k">name</span><span className="v" style={{ fontSize: 10 }}>{currentFile.filename}</span></div>
            {meta && <>
              <div className="kv"><span className="k">size</span><span className="v">{formatBytes(meta.size)}</span></div>
              <div className="kv"><span className="k">dim</span><span className="v">{meta.width} × {meta.height}</span></div>
              <div className="kv"><span className="k">format</span><span className="v">{meta.format}{meta.color_space ? ` · ${meta.color_space}` : ''}</span></div>
              <div className="kv"><span className="k">created</span><span className="v">{formatDate(meta.created)}</span></div>
            </>}
          </>
        ) : (
          <div style={{ color: 'var(--text-mute)', fontFamily: 'var(--mono)', fontSize: 10 }}>no file loaded</div>
        )}
      </div>

      <div className="inspector-section">
        <h4>Exposure</h4>
        <div className="histo">
          {histogram
            ? <canvas ref={histoRef} width={248} height={56} style={{ width: '100%', height: '100%' }} />
            : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #2a0a13 0%, #8a1f33 50%, #e8d9b8 92%, #fff 100%)', opacity: 0.3 }} />
          }
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.18em' }}>
          <span>0</span><span>64</span><span>128</span><span>192</span><span>255</span>
        </div>
      </div>

      <div className="inspector-section">
        <h4>Disposition</h4>
        <div className="kv">
          <span className="k">dest</span>
          <span className="v serif">{config?.keep ? config.keep.split(/[\\/]/).pop() : '—'}</span>
        </div>
        <div className="kv">
          <span className="k">action</span>
          <span className="v" style={{
            color: disposition === 'kept' ? '#98c486'
              : disposition === 'rejected' ? 'var(--wine-3)'
              : 'var(--text-3)'
          }}>
            {disposition === 'kept' ? 'KEPT'
              : disposition === 'rejected' ? 'REJECTED'
              : disposition === 'skipped' ? 'SKIPPED'
              : '—'}
          </span>
        </div>
        <div className="kv"><span className="k">tags</span><span className="v">—</span></div>
      </div>

      <div className="inspector-section">
        <h4>Queue <span className="num">{files.length > 0 ? `${currentIndex + 1} / ${files.length}` : '—'}</span></h4>
        <div className="queue-scroll">
          <div className="queue">
            {files.map((f, i) => {
              const isCurrent = i === currentIndex
              const disp = dispositions[f.full_path]
              const thumb = thumbMap.get(i)
              return (
                <div
                  key={f.full_path}
                  ref={isCurrent ? currentCellRef : null}
                  className={`queue-cell${isCurrent ? ' current' : disp === 'kept' ? ' kept' : disp === 'rejected' ? ' rejected' : ''}`}
                  title={f.filename}
                  onClick={() => dispatch({ type: 'SET_INDEX', payload: i })}
                >
                  {thumb
                    ? <img
                        src={`data:image/png;base64,${thumb}`}
                        alt=""
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    : <div className="queue-cell-placeholder" />
                  }
                </div>
              )
            })}
            {files.length === 0 && Array(8).fill(0).map((_, i) => (
              <div key={`empty-${i}`} className="queue-cell" />
            ))}
          </div>
        </div>
      </div>

      <div className="inspector-section">
        <h4>Active Filter</h4>
        {config?.filmography?.active_filter && config.filmography.active_filter !== 'none' ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 48, height: 36, background: 'repeating-linear-gradient(45deg, #2a1f25 0 4px, #1a131c 4px 8px)', border: '1px solid var(--silver-6)', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(184,80,40,0.18)' }} />
            </div>
            <div>
              <div className="serif" style={{ fontSize: 14, color: 'var(--cream)' }}>{config.filmography.active_filter}</div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Grain {config.filmography.grain}%
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-mute)', fontFamily: 'var(--mono)', fontSize: 10 }}>None</div>
        )}
      </div>
    </aside>
  )
}
