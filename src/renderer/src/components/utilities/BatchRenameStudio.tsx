import React, { useState, useCallback, useMemo, useRef } from 'react'
import { useApp, type FileInfo } from '../../context/AppContext'
import { IcBack, IcRename } from '../Icons'
import { buildRenamePlan } from '../../utils/renamePattern'

interface Props {
  onBack: () => void
}

type Status = 'idle' | 'processing' | 'done' | 'error'

/** One completed rename, kept so Revert can put it back. */
interface Applied { from: FileInfo; to: FileInfo }

const PREVIEW_ROWS = 6

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
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [applied, setApplied] = useState<Applied[]>([])
  const [doneCount, setDoneCount] = useState(0)
  // Same in-flight guard the other studios use — `status` alone isn't
  // trustworthy while the panel sits beside a live canvas.
  const runningRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const plan = useMemo(() => buildRenamePlan(files, pattern, start), [files, pattern, start])

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
  }, [plan, files, run])

  const handleRevert = useCallback(async () => {
    if (revertable.length === 0) return
    const back = new Map(revertable.map(a => [a.to.full_path, a.from]))
    await run(
      revertable.map(a => ({ src: a.to.full_path, dest: a.from.full_path })),
      back,
      renamed => {
        setDoneCount(renamed.length)
        setApplied([])
      }
    )
  }, [revertable, run])

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
            : 'Each # is one digit of the counter — img_### → img_001. Extensions stay as they are.'}
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
          ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="upscale-spinner" /> Renaming…</span>
          : `Rename ${files.length} file${files.length === 1 ? '' : 's'}`}
      </button>

      {/* Status */}
      {status === 'done' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(152,196,134,0.08)', border: '1px solid rgba(152,196,134,0.2)', borderRadius: 3 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#98c486', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
            ✓ Renamed {doneCount} file{doneCount === 1 ? '' : 's'}
          </div>
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
