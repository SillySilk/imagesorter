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
  const { files, currentIndex, dispositions, config, filesToken } = state
  const currentFile = files[currentIndex] || null

  const [meta, setMeta] = useState<Metadata | null>(null)
  const [histogram, setHistogram] = useState<number[] | null>(null)
  // Keyed by path, never by index. Culling shifts every later index, so an
  // index-keyed cache shows each file its former neighbour's thumbnail.
  const [thumbMap, setThumbMap] = useState<Map<string, string>>(new Map())

  const histoRef = useRef<HTMLCanvasElement>(null)
  const currentCellRef = useRef<HTMLDivElement>(null)
  const thumbMapRef = useRef(thumbMap)
  thumbMapRef.current = thumbMap
  const inFlightRef = useRef<Set<string>>(new Set())
  const loadGenRef = useRef(0)  // bumped per folder, to discard results from the previous one

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

  // A genuinely new folder — only SET_FILES bumps filesToken. Drop the cache
  // and invalidate anything still in flight for the previous folder.
  useEffect(() => {
    loadGenRef.current++
    inFlightRef.current.clear()
    // Clear the ref too, not just the state. The effect below runs in this same
    // commit and reads the ref — if it still saw the old map it would compute
    // "nothing missing" and never reload. That blanked the grid permanently on
    // F5 (same folder reloaded, so every path was still a hit in the old map).
    thumbMapRef.current = new Map()
    setThumbMap(new Map())
  }, [filesToken])

  // Fill in whatever is missing. Deliberately NOT keyed on the `files` array
  // identity for a reset: every keep/reject/delete produces a new array, and
  // resetting here meant one keystroke re-decoded the entire folder.
  useEffect(() => {
    if (files.length === 0) return

    // Drop thumbnails for files that have left the list, so a long culling
    // session doesn't hold base64 for images that are gone.
    const present = new Set(files.map(f => f.full_path))
    let stale = false
    for (const key of thumbMapRef.current.keys()) {
      if (!present.has(key)) { stale = true; break }
    }
    if (stale) {
      const pruned = new Map<string, string>()
      for (const [k, v] of thumbMapRef.current) if (present.has(k)) pruned.set(k, v)
      setThumbMap(pruned)
    }

    const missing = files.filter(f =>
      f.type === 'image' &&
      !thumbMapRef.current.has(f.full_path) &&
      !inFlightRef.current.has(f.full_path)
    )
    if (missing.length === 0) return

    const gen = loadGenRef.current
    missing.forEach(f => inFlightRef.current.add(f.full_path))

    const loadBatch = async (start: number) => {
      const batch = missing.slice(start, start + THUMB_BATCH)
      if (batch.length === 0) return

      const results = await Promise.all(
        batch.map(f =>
          window.api.image.thumbnail({ filePath: f.full_path, width: 64, height: 64 })
            .then(thumb => ({ path: f.full_path, thumb }))
            .catch(() => ({ path: f.full_path, thumb: '' }))
        )
      )
      batch.forEach(f => inFlightRef.current.delete(f.full_path))

      // Folder changed under us — these results belong to the old list.
      if (loadGenRef.current !== gen) return

      setThumbMap(prev => {
        const next = new Map(prev)
        results.forEach(({ path, thumb }) => next.set(path, thumb))
        return next
      })

      loadBatch(start + THUMB_BATCH)
    }

    loadBatch(0)
  }, [files, filesToken])

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
              const thumb = thumbMap.get(f.full_path)
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

    </aside>
  )
}
