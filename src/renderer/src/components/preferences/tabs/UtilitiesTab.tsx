import React, { useState } from 'react'
import { IcCinema, IcConvert, IcUpscale, IcWand } from '../../Icons'

type UtilView = 'index' | 'cinema' | 'convert' | 'upscale' | 'aivideo'

export default function UtilitiesTab() {
  const [view, setView] = useState<UtilView>('index')

  if (view !== 'index') {
    return (
      <div className="sub-view">
        <div style={{ paddingBottom: 14 }}>
          <button className="sub-back" onClick={() => setView('index')}>
            ← Back to Utilities
          </button>
        </div>
        <div style={{ color: 'var(--text-mute)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em' }}>
          {view === 'cinema' && <CinemaSubview />}
          {view === 'convert' && <PlannedSubview name="File Conversion" />}
          {view === 'upscale' && <PlannedSubview name="Upscale Studio" />}
          {view === 'aivideo' && <PlannedSubview name="AI Video Atelier" />}
        </div>
      </div>
    )
  }

  const tiles = [
    { id: 'cinema' as const, Icon: IcCinema, title: 'Cinema', titleEm: 'Player', desc: 'Video playback with shuttle controls, markers, and auto-detection.', status: 'beta' as const, features: ['Auto-detect video files', 'J/K/L shuttle keys', 'In/Out markers', 'A/B loop'] },
    { id: 'convert' as const, Icon: IcConvert, title: 'File', titleEm: 'Conversion', desc: 'Batch convert images between formats with quality and resize controls.', status: 'planned' as const, features: ['JPEG, PNG, WebP, AVIF, TIFF', 'Resize & strip metadata', 'Mirror folder structure', 'Color space control'] },
    { id: 'upscale' as const, Icon: IcUpscale, title: 'Upscale', titleEm: 'Studio', desc: 'AI-powered image upscaling with multiple engine options and GPU queue.', status: 'planned' as const, features: ['Real-ESRGAN, SwinIR, HAT', '2×/3×/4× scale', 'Denoise & tile size', 'Preserve film grain'] },
    { id: 'aivideo' as const, Icon: IcWand, title: 'AI Video', titleEm: 'Atelier', desc: 'Prompt-driven video editing with timeline, B-roll fill, and generation.', status: 'planned' as const, features: ['Natural language prompts', 'Recipe chips', 'Multi-track timeline', 'Local or cloud render'] },
  ]

  return (
    <div>
      <div className="section-title">Utilities <em>suite</em></div>
      <div className="section-sub">Suite · Extended tools and workflows</div>
      <div className="util-grid">
        {tiles.map(t => (
          <div key={t.id} className="util-tile" onClick={() => setView(t.id)}>
            <div className="util-icon"><t.Icon /></div>
            <h3>{t.title} <em>{t.titleEm}</em></h3>
            <div className="util-desc">{t.desc}</div>
            <span className={`util-status ${t.status}`}>{t.status.toUpperCase()}</span>
            <ul className="util-features">
              {t.features.map(f => <li key={f}>{f}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function CinemaSubview() {
  return (
    <div>
      <div style={{ color: 'var(--silver-2)', fontFamily: 'var(--sans)', fontSize: 12, marginBottom: 14 }}>
        Cinema Player auto-activates when the current file is a video. Shuttle keys J/K/L are active in view mode.
      </div>
      <div className="card">
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--silver-4)', marginBottom: 8 }}>Settings</div>
        <div className="field">
          <div className="field-label">Auto-detect video files<span className="desc">Switch to Cinema Player automatically</span></div>
          <div className="field-control">
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-mute)' }}>Configure in main settings → General</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlannedSubview({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--cream)', fontStyle: 'italic' }}>{name}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--sepia)' }}>Planned — Coming Soon</div>
    </div>
  )
}
