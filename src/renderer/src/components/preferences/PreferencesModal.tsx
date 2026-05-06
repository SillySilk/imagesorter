import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { DecoCorner, IcX, IcSettings, IcGrid, IcAperture, IcFilm, IcPalette, IcCpu, IcMouse, IcKeyboard } from '../Icons'
import type { Config } from '../../../../main/config'
import GeneralTab from './tabs/GeneralTab'
import ControlsTab from './tabs/ControlsTab'
import FilmographyTab from './tabs/FilmographyTab'
import AppearanceTab from './tabs/AppearanceTab'
import UtilitiesTab from './tabs/UtilitiesTab'

const TABS = [
  { group: 'Library', items: [
    { id: 'general', label: 'General', Icon: IcGrid },
  ]},
  { group: 'Atelier', items: [
    { id: 'sort-controls', label: 'Sort Mode', Icon: IcMouse, count: null },
    { id: 'view-controls', label: 'View Mode', Icon: IcKeyboard, count: null },
    { id: 'filmography', label: 'Filmography', Icon: IcFilm },
  ]},
  { group: 'Suite', items: [
    { id: 'appearance', label: 'Appearance', Icon: IcPalette },
    { id: 'utilities', label: 'Utilities', Icon: IcCpu },
  ]},
]

export default function PreferencesModal() {
  const { state, dispatch } = useApp()
  const [draft, setDraft] = useState<Config | null>(null)
  const [snapshot, setSnapshot] = useState<Config | null>(null)
  const [activeTab, setActiveTab] = useState(state.settingsTab || 'general')

  useEffect(() => {
    if (state.settingsOpen && state.config) {
      const clone = structuredClone(state.config)
      setDraft(clone)
      setSnapshot(clone)
      setActiveTab(state.settingsTab || 'general')
    }
  }, [state.settingsOpen])

  const close = useCallback(() => {
    if (snapshot) {
      dispatch({ type: 'SET_CONFIG', payload: snapshot })
    }
    dispatch({ type: 'CLOSE_SETTINGS' })
  }, [snapshot, dispatch])

  const save = async () => {
    if (!draft) return
    await window.api.config.save(draft)
    dispatch({ type: 'SET_CONFIG', payload: draft })
    dispatch({ type: 'CLOSE_SETTINGS' })
  }

  const reset = async () => {
    const defaults = await window.api.config.reset()
    setDraft(defaults)
    dispatch({ type: 'SET_CONFIG', payload: defaults })
  }

  const handleChange = (patch: Partial<Config>) => {
    if (!draft) return
    const updated = { ...draft, ...patch }
    setDraft(updated)
    dispatch({ type: 'SET_CONFIG', payload: updated })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state.settingsOpen) return
      if (e.key === 'Escape') close()
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state.settingsOpen, close, save])

  if (!state.settingsOpen || !draft) return null

  return (
    <div className="scrim" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Deco corners */}
        <div className="modal-orn tl" style={{ color: 'var(--wine-3)' }}><DecoCorner /></div>
        <div className="modal-orn tr" style={{ color: 'var(--wine-3)' }}><DecoCorner /></div>
        <div className="modal-orn bl" style={{ color: 'var(--wine-3)' }}><DecoCorner /></div>
        <div className="modal-orn br" style={{ color: 'var(--wine-3)' }}><DecoCorner /></div>

        <div className="modal-header">
          <div className="modal-title">
            <span className="eyebrow">◆ PREFERENCES</span>
            <h2>Aperture · <em>settings</em></h2>
          </div>
          <button className="modal-close" onClick={close}><IcX style={{ width: 14, height: 14 }} /></button>
        </div>

        <div className="modal-body">
          <nav className="modal-tabs">
            {TABS.map(group => (
              <div key={group.group}>
                <div className="group">{group.group}</div>
                {group.items.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`tab-item${activeTab === id ? ' active' : ''}`}
                    onClick={() => setActiveTab(id)}
                  >
                    <Icon />
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="modal-content">
            {activeTab === 'general' && <GeneralTab draft={draft} onChange={handleChange} />}
            {activeTab === 'sort-controls' && <ControlsTab mode="sort" draft={draft} onChange={handleChange} />}
            {activeTab === 'view-controls' && <ControlsTab mode="view" draft={draft} onChange={handleChange} />}
            {activeTab === 'filmography' && <FilmographyTab draft={draft} onChange={handleChange} />}
            {activeTab === 'appearance' && <AppearanceTab draft={draft} onChange={handleChange} />}
            {activeTab === 'utilities' && <UtilitiesTab />}
          </div>
        </div>

        <div className="modal-footer">
          <span className="footer-meta">◇ All edits apply live · Ctrl+S writes to disk</span>
          <span className="grow" />
          <button className="btn ghost" onClick={reset}>Reset Defaults</button>
          <button className="btn" onClick={close}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
