import React from 'react'
import { KeyRow, AddKeyRow } from '../forms/KeyRow'
import type { Config, ModeSettings, Action } from '../../../../../main/config'

interface Props {
  mode: 'sort' | 'view'
  draft: Config
  onChange: (updated: Partial<Config>) => void
}

const BUTTON_LABELS: Record<string, string> = {
  left_click: 'Left Click',
  right_click: 'Right Click',
  middle_click: 'Middle Click',
  wheel_up: 'Wheel Up',
  wheel_down: 'Wheel Down',
}

export default function ControlsTab({ mode, draft, onChange }: Props) {
  const settingsKey = `${mode}_settings` as 'sort_settings' | 'view_settings'
  const settings: ModeSettings = draft[settingsKey]

  const updateSettings = (patch: Partial<ModeSettings>) => {
    onChange({ [settingsKey]: { ...settings, ...patch } })
  }

  return (
    <div>
      <div className="section-title">{mode === 'sort' ? 'Sort' : 'View'} <em>controls</em></div>
      <div className="section-sub">{mode === 'sort' ? 'Cull / Sort' : 'View Only'} · Mouse buttons, wheel & keys</div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--silver-4)', marginBottom: 12 }}>
          Mouse Buttons
        </div>
        {Object.entries(settings.button_mappings).map(([btn, action]) => (
          <KeyRow
            key={btn}
            keyName={btn}
            label={BUTTON_LABELS[btn] || btn}
            action={action}
            required={btn === 'left_click' || btn === 'right_click'}
            onActionChange={a => updateSettings({ button_mappings: { ...settings.button_mappings, [btn]: a as Action } })}
          />
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--silver-4)', marginBottom: 12 }}>
          Wheel
        </div>
        {Object.entries(settings.wheel_mappings).map(([whl, action]) => (
          <KeyRow
            key={whl}
            keyName={whl}
            label={BUTTON_LABELS[whl] || whl}
            action={action}
            required
            onActionChange={a => updateSettings({ wheel_mappings: { ...settings.wheel_mappings, [whl]: a as Action } })}
          />
        ))}
      </div>

      <div className="card">
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--silver-4)', marginBottom: 12 }}>
          Keys
        </div>
        {Object.entries(settings.key_mappings).map(([key, action]) => (
          <KeyRow
            key={key}
            keyName={key}
            action={action}
            onActionChange={a => updateSettings({ key_mappings: { ...settings.key_mappings, [key]: a as Action } })}
            onDelete={() => {
              const km = { ...settings.key_mappings }
              delete km[key]
              updateSettings({ key_mappings: km })
            }}
          />
        ))}
        <AddKeyRow onAdd={(key, action) => {
          updateSettings({ key_mappings: { ...settings.key_mappings, [key]: action as Action } })
        }} />
      </div>
    </div>
  )
}
