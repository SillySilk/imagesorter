import React, { ReactNode } from 'react'

interface FieldProps {
  label: string
  desc?: string
  children: ReactNode
}

export function Field({ label, desc, children }: FieldProps) {
  return (
    <div className="field">
      <div className="field-label">
        {label}
        {desc && <span className="desc">{desc}</span>}
      </div>
      <div className="field-control">{children}</div>
    </div>
  )
}

interface ToggleProps {
  value: boolean
  onChange: (v: boolean) => void
}
export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div className={`toggle${value ? ' on' : ''}`} onClick={() => onChange(!value)} role="switch" aria-checked={value} />
  )
}

interface SegProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}
export function Seg({ options, value, onChange }: SegProps) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface SelectProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}
export function Select({ options, value, onChange }: SelectProps) {
  return (
    <div className="select">
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

interface SliderProps {
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  label?: string
}
export function Slider({ min, max, value, onChange, label }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range" min={min} max={max} value={value}
        className="slider"
        style={{ '--p': `${pct}%` } as React.CSSProperties}
        onChange={e => onChange(Number(e.target.value))}
      />
      {label !== undefined && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--silver-3)', minWidth: 32, textAlign: 'right' }}>
          {value}
        </span>
      )}
    </div>
  )
}
