import React, { useState, useCallback, useMemo, useRef } from 'react'
import { useApp, type FileInfo } from '../../context/AppContext'
import { IcBack, IcRename } from '../Icons'
import { buildRenamePlan } from '../../utils/renamePattern'

interface Props {
  onBack: () => void
}

type Status = 'idle' | 'processing' | 'done' | 'error'
type Format = 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'

/** One completed rename, kept so Revert can put it back. `trashId` is only
 * set when this entry also converted format — the original went to Trash
 * rather than being renamed in place, so reverting it needs a restore, not
 * just a path swap. */
interface Applied { from: FileInfo; to: FileInfo; trashId?: string }

const PREVIEW_ROWS = 6

const FORMATS: { v: Format; label: string }[] = [
  { v: 'jpeg', label: 'JPEG' },
  { v: 'png', label: 'PNG (lossless)' },
  { v: 'webp', label: 'WebP' },
  { v: 'avif', label: 'AVIF' },
  { v: 'tiff', label: 'TIFF' }
]

const CONVERT_EXT: Record<Format, string> = {
  jpeg: '.jpg', png: '.png', webp: '.webp', avif: '.avif', tiff: '.tif'
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

const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p

/** Swap the final segment of a path, keeping whatever separator it uses. */
const withName = (p: string, name: string): string => {
  const cut = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return cut >= 0 ? p.slice(0, cut + 1) + name : name
}

export default function BatchRenameStudio({ onBack }: Props) {
  const { state, dispatch } = useApp()
  const files = state.files

  const [pattern, setPattern] = useState('')
  const [start, setStart] = useState(1)
  const [convertTo, setConvertTo] = useState<'keep' | Format>('keep')
  const [quality, setQuality] = useState(92)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [convertFailed, setConvertFailed] = useState<{ filename: string; error: string }[]>([])
  const [applied, setApplied] = useState<Applied[]>([])
  const [doneCount, setDoneCount] = useState(0)
  // Same in-flight guard the other studios use — `status` alone isn't
  // trustworthy while the panel sits beside a live canvas.
  const runningRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const forceExt = convertTo === 'keep' ? undefined : CONVERT_EXT[convertTo]
  const plan = useMemo(() => buildRenamePlan(files, pattern, start, forceExt), [files, pattern, start, forceExt])

  // Revert is only offered for renamed files still in the queue. Anything
  // culled since would fail the rename anyway, so filter rather than refuse.
  const revertable = useMemo(() => {
    const present = new Set(files.map(f => f.full_path))
    return applied.filter(a => present.has(a.to.full_path))
  }, [applied, files])

  const run = useCallback(async (pairs: { src: string; dest: string }[], nextFiles: Map<string, FileInfo>, onOk: (renamed: { src: string; dest: string }[]) => void) => {
    if (runningRef.current) return
    runningRef.current = true
    setStatus('processing')
    setErrorMsg(null)
    setConflicts([])
    try {
      const res = await window.api.file.batchRename({ pairs })
      if (!res.ok) {
        setErrorMsg(res.error)
        setConflicts(res.conflicts ?? [])
        setStatus('error')
        return
      }
      // Only what the main process actually renamed drives the state update —
      // it drops no-op pairs, and the reducer must see the same set.
      const updates = res.renamed
        .map(r => ({ from: r.src, to: nextFiles.get(r.src) }))
        .filter((u): u is { from: string; to: FileInfo } => !!u.to)
      dispatch({ type: 'RENAME_FILES', payload: updates })
      onOk(res.renamed)
      setStatus('done')
    } catch (e: unknown) {
      setErrorMsg(String(e))
      setStatus('error')
    } finally {
      runningRef.current = false
    }
  }, [dispatch])

  const handleRename = useCallback(async () => {
    if (!plan.ok || files.length === 0) return
    const byPath = new Map(files.map(f => [f.full_path, f]))

    // Plain rename, no format change: unchanged fast path.
    if (convertTo === 'keep') {
      const next = new Map<string, FileInfo>()
      for (const p of plan.pairs) {
        const f = byPath.get(p.src)
        if (!f) continue
        next.set(p.src, { ...f, filename: p.newName, full_path: p.dest, relative_path: withName(f.relative_path, p.newName) })
      }
      await run(
        plan.pairs.map(({ src, dest }) => ({ src, dest })),
        next,
        renamed => {
          setDoneCount(renamed.length)
          setApplied(renamed.map(r => ({ from: byPath.get(r.src)!, to: next.get(r.src)! })))
        }
      )
      return
    }

    // Converting too: files already in the target format just need a plain
    // rename (no re-encode, no quality loss). Everything else is re-encoded
    // straight to its final name, and its original moves to Trash.
    if (runningRef.current) return
    runningRef.current = true
    setStatus('processing')
    setErrorMsg(null)
    setConflicts([])
    setConvertFailed([])

    const targetExt = CONVERT_EXT[convertTo]
    const plainPairs: { src: string; dest: string }[] = []
    const convertJobs: { src: string; dest: string }[] = []
    for (const p of plan.pairs) {
      const f = byPath.get(p.src)
      if (!f) continue
      const srcExt = (p.oldName.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase()
      if (f.type === 'video' || srcExt === targetExt) plainPairs.push({ src: p.src, dest: p.dest })
      else convertJobs.push({ src: p.src, dest: p.dest })
    }

    try {
      const appliedEntries: Applied[] = []

      if (plainPairs.length > 0) {
        const res = await window.api.file.batchRename({ pairs: plainPairs })
        if (!res.ok) {
          setErrorMsg(res.error)
          setConflicts(res.conflicts ?? [])
          setStatus('error')
          return
        }
        for (const r of res.renamed) {
          const f = byPath.get(r.src)
          if (!f) continue
          appliedEntries.push({
            from: f,
            to: { ...f, filename: baseName(r.dest), full_path: r.dest, relative_path: withName(f.relative_path, baseName(r.dest)) }
          })
        }
      }

      let convertErrors: { filename: string; error: string }[] = []
      if (convertJobs.length > 0) {
        const res = await window.api.convert.renameConvert({ jobs: convertJobs, format: convertTo, quality })
        for (const s of res.succeeded) {
          const f = byPath.get(s.src)
          if (!f) continue
          appliedEntries.push({
            from: f,
            to: { ...f, filename: baseName(s.dest), full_path: s.dest, relative_path: withName(f.relative_path, baseName(s.dest)) },
            trashId: s.trashId
          })
        }
        convertErrors = res.failed.map(x => ({ filename: byPath.get(x.src)?.filename ?? baseName(x.src), error: x.error }))
      }

      dispatch({ type: 'RENAME_FILES', payload: appliedEntries.map(e => ({ from: e.from.full_path, to: e.to })) })
      setApplied(appliedEntries)
      setDoneCount(appliedEntries.length)
      setConvertFailed(convertErrors)

      if (appliedEntries.length > 0) {
        setStatus('done')
      } else {
        setErrorMsg(convertErrors.length > 0 ? 'Every file failed to convert.' : 'Nothing to rename.')
        setStatus('error')
      }
    } catch (e: unknown) {
      setErrorMsg(String(e))
      setStatus('error')
    } finally {
      runningRef.current = false
    }
  }, [plan, files, run, convertTo, quality, dispatch])

  const handleRevert = useCallback(async () => {
    if (revertable.length === 0 || runningRef.current) return
    const plain = revertable.filter(a => !a.trashId)
    const converted = revertable.filter(a => a.trashId)

    // Pure rename revert only: unchanged fast path.
    if (converted.length === 0) {
      const back = new Map(plain.map(a => [a.to.full_path, a.from]))
      await run(
        plain.map(a => ({ src: a.to.full_path, dest: a.from.full_path })),
        back,
        renamed => {
          setDoneCount(renamed.length)
          setApplied([])
        }
      )
      return
    }

    runningRef.current = true
    setStatus('processing')
    setErrorMsg(null)
    try {
      let count = 0

      if (plain.length > 0) {
        const back = new Map(plain.map(a => [a.to.full_path, a.from]))
        const res = await window.api.file.batchRename({ pairs: plain.map(a => ({ src: a.to.full_path, dest: a.from.full_path })) })
        if (res.ok) {
          const updates = res.renamed
            .map(r => ({ from: r.src, to: back.get(r.src) }))
            .filter((u): u is { from: string; to: FileInfo } => !!u.to)
          dispatch({ type: 'RENAME_FILES', payload: updates })
          count += updates.length
        }
      }

      // Restore first, delete the converted duplicate only once the original
      // is confirmed safely back — never the other way round.
      for (const a of converted) {
        const restoreRes = await window.api.file.restore({ trashId: a.trashId! })
        if (!restoreRes.ok || !restoreRes.restoredPath) continue
        await window.api.file.delete({ filePath: a.to.full_path })
        dispatch({
          type: 'RENAME_FILES',
          payload: [{ from: a.to.full_path, to: { ...a.from, full_path: restoreRes.restoredPath, filename: baseName(restoreRes.restoredPath) } }]
        })
        count++
      }

      setDoneCount(count)
      setApplied([])
      if (count > 0) {
        setStatus('done')
      } else {
        setErrorMsg('Nothing to revert.')
        setStatus('error')
      }
    } finally {
      runningRef.current = false
    }
  }, [revertable, run, dispatch])

  const canRun = plan.ok && files.length > 0 && status !== 'processing'
  const previewPairs = plan.ok ? plan.pairs.slice(0, PREVIEW_ROWS) : []
  const hidden = plan.ok ? plan.pairs.length - previewPairs.length : 0

  return (
    <div className="sub-view">
      <SubBack onBack={onBack} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div className="util-icon" style={{ width: 28, height: 28, flexShrink: 0 }}>
          <IcRename style={{ width: 14, height: 14 }} />
        </div>
        <h2 className="section-title" style={{ fontSize: 15, margin: 0 }}>Batch <em>Rename</em></h2>
      </div>
      <div className="section-sub" style={{ marginBottom: 14 }}>Sequential · # becomes the number</div>

      {/* Pattern */}
      <div style={{ marginBottom: 10 }}>
        <Label>Name Pattern</Label>
        <input
          className="input"
          value={pattern}
          placeholder="e.g. Vacation_###"
          spellCheck={false}
          onChange={e => setPattern(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canRun) handleRename() }}
        />
        <div style={{ marginTop: 5, fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '0.06em', color: pattern && !plan.ok ? 'var(--wine-3)' : 'var(--text-mute)' }}>
          {pattern && !plan.ok
            ? plan.error
            : convertTo === 'keep'
              ? 'Each # is one digit of the counter — img_### → img_001. Extensions stay as they are.'
              : `Each # is one digit of the counter — img_### → img_001. Images convert to ${CONVERT_EXT[convertTo]}.`}
        </div>
      </div>

      {/* Start number */}
      <div style={{ marginBottom: 10 }}>
        <Label>Start At</Label>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          value={start}
          style={{ width: 90 }}
          onChange={e => setStart(e.target.value === '' ? NaN : Number(e.target.value))}
        />
      </div>

      {/* Convert format */}
      <div style={{ marginBottom: 10 }}>
        <Label>Convert To</Label>
        <div className="select" style={{ width: '100%' }}>
          <select value={convertTo} onChange={e => setConvertTo(e.target.value as 'keep' | Format)} style={{ width: '100%' }}>
            <option value="keep">Keep original format</option>
            {FORMATS.map(({ v, label }) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 5, fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '0.06em', color: 'var(--text-mute)' }}>
          {convertTo === 'keep'
            ? 'Videos and already-matching files just get renamed, no re-encode.'
            : 'Originals move to Trash after conversion — restore from Preferences → Trash if needed.'}
        </div>
        {convertTo !== 'keep' && convertTo !== 'png' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
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
        )}
      </div>

      {/* Preview */}
      <div className="card" style={{ marginBottom: 14 }}>
        <Label>Preview · {files.length} file{files.length === 1 ? '' : 's'} in queue order</Label>
        {files.length === 0 ? (
          <div style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>No files loaded.</div>
        ) : !plan.ok ? (
          <div style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>Enter a pattern to see the new names.</div>
        ) : (
          <>
            {previewPairs.map(p => (
              <div key={p.src} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', gap: 6, alignItems: 'center', fontSize: 10, fontFamily: 'var(--mono)', padding: '3px 0', borderBottom: '1px solid var(--line-1)' }}>
                <span style={{ color: 'var(--silver-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.oldName}>{p.oldName}</span>
                <span style={{ color: 'var(--wine-3)' }}>→</span>
                <span style={{ color: 'var(--silver-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.newName}>{p.newName}</span>
              </div>
            ))}
            {hidden > 0 && (
              <div style={{ fontSize: 9, color: 'var(--text-mute)', fontFamily: 'var(--mono)', marginTop: 5, letterSpacing: '0.06em' }}>
                … and {hidden} more
              </div>
            )}
          </>
        )}
      </div>

      {/* Run */}
      <button
        className="btn primary"
        style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 12 }}
        onClick={handleRename}
        disabled={!canRun}
      >
        {status === 'processing'
          ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="upscale-spinner" /> {convertTo === 'keep' ? 'Renaming…' : 'Renaming & converting…'}</span>
          : convertTo === 'keep'
            ? `Rename ${files.length} file${files.length === 1 ? '' : 's'}`
            : `Rename & Convert ${files.length} file${files.length === 1 ? '' : 's'}`}
      </button>

      {/* Status */}
      {status === 'done' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(152,196,134,0.08)', border: '1px solid rgba(152,196,134,0.2)', borderRadius: 3 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#98c486', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
            ✓ Renamed {doneCount} file{doneCount === 1 ? '' : 's'}
          </div>
          {convertFailed.length > 0 && (
            <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--wine-3)' }}>
              {convertFailed.length} failed to convert:
              <div style={{ marginTop: 4, maxHeight: 90, overflowY: 'auto' }}>
                {convertFailed.map(f => (
                  <div key={f.filename} style={{ color: 'var(--text-mute)', wordBreak: 'break-all', marginBottom: 2 }}>
                    <span style={{ color: 'var(--wine-3)' }}>{f.filename}</span> — {f.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(168,45,68,0.08)', border: '1px solid var(--line-wine)', borderRadius: 3 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--wine-3)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 4 }}>
            Nothing renamed
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)' }}>{errorMsg}</div>
          {conflicts.length > 0 && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)', marginTop: 4, wordBreak: 'break-all' }}>
              {conflicts.slice(0, 5).map(baseName).join(' · ')}{conflicts.length > 5 ? ` · +${conflicts.length - 5}` : ''}
              <div style={{ marginTop: 3 }}>Change the pattern or start number and try again.</div>
            </div>
          )}
          {convertFailed.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 90, overflowY: 'auto' }}>
              {convertFailed.map(f => (
                <div key={f.filename} style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-mute)', wordBreak: 'break-all', marginBottom: 2 }}>
                  <span style={{ color: 'var(--wine-3)' }}>{f.filename}</span> — {f.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Revert */}
      {revertable.length > 0 && status !== 'processing' && (
        <button
          className="btn"
          style={{ width: '100%', justifyContent: 'center', padding: '7px 0', fontSize: 11, marginTop: 8 }}
          onClick={handleRevert}
        >
          Revert last rename ({revertable.length})
        </button>
      )}
    </div>
  )
}
