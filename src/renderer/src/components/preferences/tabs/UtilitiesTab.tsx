import React from 'react'
import { Field, Toggle } from '../forms/Field'
import { IcCinema, IcConvert, IcUpscale } from '../../Icons'
import type { Config } from '../../../../../main/config'

interface Props {
  draft: Config
  onChange: (patch: Partial<Config>) => void
}

const TILES = [
  { id: 'cinema', Icon: IcCinema, title: 'Cinema', titleEm: 'Player', status: 'beta' as const, desc: 'Video playback with shuttle controls and auto-detection.', features: ['Auto-detect video files', 'J/K/L shuttle keys', 'A/B loop'] },
  { id: 'convert', Icon: IcConvert, title: 'File', titleEm: 'Conversion', status: 'ready' as const, desc: 'Convert one image or batch the whole loaded queue.', features: ['JPEG, PNG, WebP, AVIF, TIFF', 'Resize & strip metadata', 'Batch with progress'] },
  { id: 'upscale', Icon: IcUpscale, title: 'Upscale', titleEm: 'Studio', status: 'ready' as const, desc: 'Algorithmic 2×/3×/4× resize with selectable kernels.', features: ['Lanczos3, Mitchell, Bicubic', 'PNG, JPEG, source format', 'Saves next to original'] },
]

const STATUS_LABEL = { beta: 'BETA', ready: 'READY' }

export default function UtilitiesTab({ draft, onChange }: Props) {
  const cinema = draft.utilities.cinema

  return (
    <div>
      <div className="section-title">Utilities <em>suite</em></div>
      <div className="section-sub">Suite · Extended tools and workflows</div>

      <div className="card" style={{ marginTop: 14, marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--silver-4)', marginBottom: 8 }}>
          Cinema Player
        </div>
        <Field label="Auto-detect video files" desc="Switch to the Cinema Player automatically when the current file is a video">
          <Toggle
            value={cinema.auto_switch}
            onChange={v => onChange({ utilities: { ...draft.utilities, cinema: { ...cinema, auto_switch: v } } })}
          />
        </Field>
      </div>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--silver-4)', marginBottom: 10 }}>
        Available Tools
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--mono)', marginBottom: 12, letterSpacing: '0.06em' }}>
        Open and run these from the Utilities panel in the left rail.
      </div>
      <div className="util-grid">
        {TILES.map(t => (
          <div key={t.id} className="util-tile" style={{ cursor: 'default' }}>
            <div className="util-icon"><t.Icon /></div>
            <h3>{t.title} <em>{t.titleEm}</em></h3>
            <div className="util-desc">{t.desc}</div>
            <span className={`util-status ${t.status}`}>{STATUS_LABEL[t.status]}</span>
            <ul className="util-features">
              {t.features.map(f => <li key={f}>{f}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
