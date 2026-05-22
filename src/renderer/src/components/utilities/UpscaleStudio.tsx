import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { IcBack, IcUpscale } from '../Icons'

interface Props {
  onBack: () => void
}

type Kernel = 'lanczos3' | 'mitchell' | 'cubic'
type OutputFormat = 'source' | 'png' | 'jpeg'
type Status = 'idle' | 'processing' | 'done' | 'error'

const KERNELS: { k: Kernel; label: string; desc: string }[] = [
  { k: 'lanczos3', label: 'Lanczos3', desc: 'Best for photos — sharp edges, minimal haloing' },
  { k: 'mitchell', label: 'Mitchell', desc: 'Balanced — smooth without over-sharpening' },
  { k: 'cubic',   label: 'Bicubic',  desc: 'Classic — good for illustrations and flat art' }
]

const FORMATS: { v: OutputFormat; label: string }[] = [
  { v: 'source', label: 'Same as source' },
  { v: 'png',    label: 'PNG (lossless)' },
  { v: 'jpeg',   label: 'JPEG 95%' }
]

function SubBack({ onBack }: { onBack: () => void }) {
  return (
    <button className="sub-back" onClick={onBack}>
      <IcBack style={{ width: 11, height: 11 }} /> Back to Utilities
    </button>
  )
}

export default function UpscaleStudio({ onBack }: Props) {
  const { state } = useApp()
  const currentFile = state.files[state.currentIndex] || null

  const [scale, setScale] = useState<2 | 3 | 4>(2)
  const [kernel, setKernel] = useState<Kernel>('lanczos3')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('source')
  const [outputDir, setOutputDir] = useState<'source' | string>('source')
  const [status, setStatus] = useState<Status>('idle')
  const [resultPath, setResultPath] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)

  // Load dimensions of current image
  useEffect(() => {
    setDimensions(null)
    setStatus('idle')
    setResultPath(null)
    setErrorMsg(null)
    if (!currentFile || currentFile.type !== 'image') return
    window.api.image.metadata({ filePath: currentFile.full_path })
      .then(m => setDimensions({ w: m.width, h: m.height }))
      .catch(() => {})
  }, [currentFile?.full_path])

  const handlePickDir = useCallback(async () => {
    const dir = await window.api.dialog.openFolder()
    if (dir) setOutputDir(dir)
  }, [])

  const handleRun = useCallback(async () => {
    if (!currentFile) return
    setStatus('processing')
    setResultPath(null)
    setErrorMsg(null)
    try {
      const destDir = outputDir === 'source' ? null : outputDir
      const result = await window.api.upscale.process({
        filePath: currentFile.full_path,
        scale,
        kernel,
        outputFormat,
        destDir
      })
      if (result.ok && result.outputPath) {
        setResultPath(result.outputPath)
        setStatus('done')
      } else {
        setErrorMsg(result.error || 'Unknown error')
        setStatus('error')
      }
    } catch (e: unknown) {
      setErrorMsg(String(e))
      setStatus('error')
    }
  }, [currentFile, scale, kernel, outputFormat, outputDir])

  const canRun = !!currentFile && currentFile.type === 'image' && status !== 'processing'
  const outputW = dimensions ? dimensions.w * scale : null
  const outputH = dimensions ? dimensions.h * scale : null

  const outputFileName = resultPath
    ? resultPath.split(/[\\/]/).pop()
    : currentFile && dimensions
      ? (() => {
          const parts = currentFile.filename.split('.')
          const ext = parts.length > 1 ? '.' + (outputFormat === 'png' ? 'png' : outputFormat === 'jpeg' ? 'jpg' : parts[parts.length - 1]) : ''
          return parts.slice(0, -1).join('.') + `_${scale}x` + ext
        })()
      : null

  return (
    <div className="sub-view">
      <SubBack onBack={onBack} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div className="util-icon" style={{ width: 28, height: 28, flexShrink: 0 }}>
          <IcUpscale style={{ width: 14, height: 14 }} />
        </div>
        <div>
          <h2 className="section-title" style={{ fontSize: 15, margin: 0 }}>Upscale <em>Studio</em></h2>
        </div>
      </div>
      <div className="section-sub" style={{ marginBottom: 14 }}>Algorithmic · Lanczos3 · Mitchell · Bicubic</div>

      {/* Current Image Card */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--silver-4)', textTransform: 'uppercase', marginBottom: 8 }}>Source</div>
        {currentFile && currentFile.type === 'image' ? (
          <>
            <div style={{ fontSize: 11, color: 'var(--silver-2)', fontFamily: 'var(--mono)', wordBreak: 'break-all', marginBottom: 6 }}>
              {currentFile.filename}
            </div>
            {dimensions ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  {dimensions.w} × {dimensions.h}
                </div>
                <div style={{ color: 'var(--wine-3)', fontSize: 10, fontFamily: 'var(--mono)' }}>→</div>
                <div style={{ fontSize: 10, color: '#98c486', fontFamily: 'var(--mono)' }}>
                  {outputW} × {outputH}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>loading…</div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>
            {currentFile ? 'Video files cannot be upscaled.' : 'No image loaded.'}
          </div>
        )}
      </div>

      {/* Scale */}
      <div style={{ marginBottom: 10 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--silver-4)', textTransform: 'uppercase', marginBottom: 6 }}>Scale</div>
        <div className="seg" style={{ padding: '2px' }}>
          {([2, 3, 4] as const).map(s => (
            <button
              key={s}
              className={scale === s ? 'on' : ''}
              onClick={() => setScale(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Algorithm */}
      <div style={{ marginBottom: 10 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--silver-4)', textTransform: 'uppercase', marginBottom: 6 }}>Algorithm</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {KERNELS.map(({ k, label, desc }) => (
            <div
              key={k}
              onClick={() => setKernel(k)}
              style={{
                padding: '6px 10px',
                background: kernel === k ? 'linear-gradient(90deg, rgba(74,14,33,0.45), rgba(74,14,33,0))' : 'transparent',
                border: kernel === k ? '1px solid var(--line-wine)' : '1px solid var(--line-1)',
                borderRadius: 3,
                cursor: 'pointer',
                borderLeft: kernel === k ? '2px solid var(--wine-3)' : '2px solid transparent'
              }}
            >
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: kernel === k ? 'var(--silver-1)' : 'var(--silver-3)', fontWeight: kernel === k ? 500 : 400 }}>
                {label}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-mute)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', marginTop: 1 }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Output Format */}
      <div style={{ marginBottom: 10 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--silver-4)', textTransform: 'uppercase', marginBottom: 6 }}>Output Format</div>
        <div className="select" style={{ width: '100%' }}>
          <select value={outputFormat} onChange={e => setOutputFormat(e.target.value as OutputFormat)} style={{ width: '100%' }}>
            {FORMATS.map(({ v, label }) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Output Location */}
      <div style={{ marginBottom: 14 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--silver-4)', textTransform: 'uppercase', marginBottom: 6 }}>Save To</div>
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
            <button className="btn" style={{ padding: '5px 8px', fontSize: 10 }} onClick={() => setOutputDir('source')}>
              ×
            </button>
          )}
        </div>
        {outputFileName && (
          <div style={{ marginTop: 5, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-mute)', letterSpacing: '0.06em' }}>
            → {outputFileName}
          </div>
        )}
      </div>

      {/* Run Button */}
      <button
        className="btn primary"
        style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 12 }}
        onClick={handleRun}
        disabled={!canRun}
      >
        {status === 'processing'
          ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="upscale-spinner" /> Upscaling…
            </span>
          : `Upscale Now — ${scale}×`
        }
      </button>

      {/* Status */}
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

      {status === 'error' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(168,45,68,0.08)', border: '1px solid var(--line-wine)', borderRadius: 3 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--wine-3)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 4 }}>
            Error
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)' }}>
            {errorMsg}
          </div>
        </div>
      )}

      {/* Engine note */}
      <div style={{ marginTop: 14, padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px dashed var(--line-1)', borderRadius: 3 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.1em', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--silver-5)' }}>Engine · Algorithmic</strong><br />
          Lanczos3 is the same algorithm used in Lightroom's "Enhance" export. For AI upscaling (Real-ESRGAN), a future update will use onnxruntime-node with bundled model weights.
        </div>
      </div>
    </div>
  )
}
