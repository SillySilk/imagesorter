import React from 'react'
import { Field, Toggle, Seg, Select } from '../forms/Field'
import type { Config } from '../../../../../main/config'

const THEMES: { id: Config['appearance']['theme']; colors: [string, string, string] }[] = [
  { id: 'burgundy', colors: ['#a82d44', '#14101a', '#b6b4b0'] },
  { id: 'obsidian', colors: ['#5a8fa8', '#0c1014', '#a8b4b6'] },
  { id: 'plum', colors: ['#8a44a8', '#120c1a', '#b4b0b6'] },
  { id: 'iron', colors: ['#888890', '#10101a', '#c0c0c4'] },
]

const ACCENT_COLORS = ['#a82d44', '#4478a8', '#44a878', '#a87844', '#8844a8']

const DISPLAY_FONTS = [
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'EB Garamond', label: 'EB Garamond' },
  { value: 'Cinzel', label: 'Cinzel' },
]

const UI_FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'IBM Plex Sans', label: 'IBM Plex Sans' },
  { value: 'Helvetica Neue', label: 'Helvetica Neue' },
  { value: 'system-ui', label: 'System Default' },
]

interface Props {
  draft: Config
  onChange: (updated: Partial<Config>) => void
}

export default function AppearanceTab({ draft, onChange }: Props) {
  const ap = draft.appearance
  const updateAp = (patch: Partial<Config['appearance']>) => onChange({ appearance: { ...ap, ...patch } })

  return (
    <div>
      <div className="section-title">Appearance <em>& theme</em></div>
      <div className="section-sub">Suite · Visual preferences</div>

      <Field label="Theme">
        <div style={{ display: 'flex', gap: 10 }}>
          {THEMES.map(t => (
            <div
              key={t.id}
              onClick={() => updateAp({ theme: t.id })}
              style={{
                width: 72, height: 48,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                border: `1px solid ${ap.theme === t.id ? 'var(--wine-3)' : 'var(--line-2)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                boxShadow: ap.theme === t.id ? '0 0 12px rgba(168,45,68,0.3)' : 'none'
              }}
              title={t.id}
            >
              {t.colors.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
            </div>
          ))}
        </div>
      </Field>

      <Field label="Accent Color">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {ACCENT_COLORS.map(c => (
            <div
              key={c}
              onClick={() => updateAp({ accent: c })}
              style={{
                width: 24, height: 24, borderRadius: '50%', background: c,
                cursor: 'pointer',
                border: `2px solid ${ap.accent === c ? 'var(--silver-2)' : 'transparent'}`,
                boxShadow: ap.accent === c ? `0 0 8px ${c}` : 'none'
              }}
            />
          ))}
        </div>
      </Field>

      <Field label="Display Font" desc="Serif font for titles and headings">
        <Select options={DISPLAY_FONTS} value={ap.display_font} onChange={v => updateAp({ display_font: v })} />
      </Field>

      <Field label="UI Font" desc="Sans-serif font for interface elements">
        <Select options={UI_FONTS} value={ap.ui_font} onChange={v => updateAp({ ui_font: v })} />
      </Field>

      <Field label="Density">
        <Seg
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'spacious', label: 'Spacious' },
          ]}
          value={ap.density}
          onChange={v => updateAp({ density: v as Config['appearance']['density'] })}
        />
      </Field>

      <Field label="Film Grain on Chrome" desc="Subtle noise texture on UI surfaces">
        <Toggle value={ap.chrome_grain} onChange={v => updateAp({ chrome_grain: v })} />
      </Field>

      <Field label="Show Aperture Marks" desc="Corner bracket marks on canvas">
        <Toggle value={ap.aperture_marks} onChange={v => updateAp({ aperture_marks: v })} />
      </Field>

      <Field label="Brushed Metal Hardware" desc="Metal sheen on buttons and controls">
        <Toggle value={ap.brushed_metal} onChange={v => updateAp({ brushed_metal: v })} />
      </Field>
    </div>
  )
}
