import React, { useState, useRef } from 'react'
import { IcTrash } from '../../Icons'
import { formatKey } from '../../../utils/formatters'

const VALID_ACTIONS = [
  { value: 'keep', label: 'Keep' },
  { value: 'reject', label: 'Reject' },
  { value: 'next', label: 'Next' },
  { value: 'previous', label: 'Previous' },
  { value: 'skip', label: 'Skip' },
  { value: 'random', label: 'Random' },
  { value: 'zoom_in', label: 'Zoom In' },
  { value: 'zoom_out', label: 'Zoom Out' },
  { value: 'fit_to_page', label: 'Fit to Page' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'context_menu', label: 'Context Menu' },
]

interface KeyRowProps {
  keyName: string
  action: string
  label?: string
  onActionChange: (action: string) => void
  onDelete?: () => void
  required?: boolean
}

export function KeyRow({ keyName, action, label, onActionChange, onDelete, required }: KeyRowProps) {
  return (
    <div className="keyrow">
      <span className="kbd">{formatKey(keyName)}</span>
      <span style={{ fontSize: 11, color: 'var(--silver-3)' }}>{label || keyName}</span>
      <div className="select">
        <select value={action} onChange={e => onActionChange(e.target.value)}>
          {VALID_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      <button
        style={{ background: 'transparent', border: 0, color: required ? 'var(--text-mute)' : 'var(--silver-4)', cursor: required ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onDelete}
        disabled={required}
        title={required ? 'Required' : 'Remove'}
      >
        <IcTrash style={{ width: 14, height: 14 }} />
      </button>
    </div>
  )
}

interface AddKeyRowProps {
  onAdd: (key: string, action: string) => void
}
export function AddKeyRow({ onAdd }: AddKeyRowProps) {
  const [capturing, setCapturing] = useState(false)
  const [captured, setCaptured] = useState('')
  const [action, setAction] = useState('next')

  const startCapture = () => { setCapturing(true); setCaptured('') }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    const key = e.code || e.key
    setCaptured(key)
    setCapturing(false)
  }

  if (!capturing && !captured) {
    return (
      <button className="btn ghost" style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={startCapture}>
        + Add key binding
      </button>
    )
  }

  return (
    <div className="keyrow" style={{ alignItems: 'center' }}>
      {capturing ? (
        <input
          autoFocus
          className="input"
          placeholder="Press a key…"
          style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
          onKeyDown={handleKeyDown}
          readOnly
        />
      ) : (
        <span className="kbd">{formatKey(captured)}</span>
      )}
      <span style={{ fontSize: 11, color: 'var(--silver-3)' }}>{captured || '…'}</span>
      <div className="select">
        <select value={action} onChange={e => setAction(e.target.value)}>
          {VALID_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn primary" style={{ padding: '4px 8px', fontSize: 10 }}
          onClick={() => { onAdd(captured, action); setCaptured(''); setAction('next') }}
          disabled={!captured}>
          Add
        </button>
        <button className="btn" style={{ padding: '4px 8px', fontSize: 10 }}
          onClick={() => { setCaptured(''); setCapturing(false) }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
