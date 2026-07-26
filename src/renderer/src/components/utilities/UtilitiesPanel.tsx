import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { IcCinema, IcConvert, IcUpscale, IcBack } from '../Icons'
import UpscaleStudio from './UpscaleStudio'
import ConvertStudio from './ConvertStudio'

type SubView = null | 'video' | 'convert' | 'upscale'
type Status = 'beta' | 'ready'

const STATUS_LABEL: Record<Status, string> = { beta: 'Beta', ready: 'Ready' }

const TILES: {
  k: Exclude<SubView, null>
  Icon: typeof IcCinema
  status: Status
  title: string
  em: string
  desc: string
  features: string[]
}[] = [
  {
    k: 'video',
    Icon: IcCinema,
    status: 'beta',
    title: 'Cinema',
    em: 'Player',
    desc: 'Auto-engages on video files. Frame-accurate scrub, A/B loop, in/out marks.',
    features: ['J·K·L shuttle keys', 'A/B loop markers', 'Reel-style playhead']
  },
  {
    k: 'convert',
    Icon: IcConvert,
    status: 'ready',
    title: 'File',
    em: 'Conversion',
    desc: 'Convert the current image, or batch the whole loaded queue, without leaving the suite.',
    features: ['JPEG · PNG · WebP · AVIF · TIFF', 'Resize & strip metadata', 'Batch with progress']
  },
  {
    k: 'upscale',
    Icon: IcUpscale,
    status: 'ready',
    title: 'Upscale',
    em: 'Studio',
    desc: 'High-quality 2× / 3× / 4× resize with Lanczos3, Mitchell & Bicubic.',
    features: ['Lanczos3 · Mitchell · Bicubic', 'PNG · JPEG · source format', 'Saves next to original']
  }
]

function SubBack({ onBack }: { onBack: () => void }) {
  return (
    <button className="sub-back" onClick={onBack}>
      <IcBack style={{ width: 11, height: 11 }} /> Back to Utilities
    </button>
  )
}

function VideoConfig({ onBack }: { onBack: () => void }) {
  return (
    <div className="sub-view">
      <SubBack onBack={onBack} />
      <h2 className="section-title" style={{ fontSize: 15 }}>Cinema <em>Player</em></h2>
      <div className="section-sub">Auto-engaged on video file · frame-accurate</div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--silver-4)', textTransform: 'uppercase', marginBottom: 10 }}>Auto-Switch</div>
        <div className="kv">
          <span className="k">Detect video files</span>
          <span className="v" style={{ color: '#98c486' }}>Active</span>
        </div>
        <div className="kv">
          <span className="k">A/B loop key</span>
          <span className="kbd">L</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--silver-4)', textTransform: 'uppercase', marginBottom: 8 }}>Shortcuts</div>
        {[['J', 'Rewind 5s'], ['K', 'Pause'], ['L', 'Forward 5s'], ['Space', 'Play / Pause']].map(([key, label]) => (
          <div key={key} className="kv">
            <span className="k">{label}</span>
            <span className="kbd">{key}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UtilitiesIndex({ onOpen }: { onOpen: (k: SubView) => void }) {
  return (
    <>
      <div className="inspector-section" style={{ paddingBottom: 6 }}>
        <h4>Utilities <em style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--silver-4)' }}>· suite</em></h4>
        <div style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--mono)', marginTop: 2 }}>Modular tools · click to configure</div>
      </div>
      <div className="util-grid" style={{ padding: '0 14px 14px' }}>
        {TILES.map(({ k, Icon, status, title, em, desc, features }) => (
          <div key={k} className="util-tile" onClick={() => onOpen(k)}>
            <div className="util-icon"><Icon /></div>
            <h3>{title} <em>{em}</em></h3>
            <div className="util-desc">{desc}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span className={`util-status ${status}`}>● {STATUS_LABEL[status]}</span>
              <span className="mono" style={{ fontSize: 9, color: 'var(--wine-3)', letterSpacing: '0.18em' }}>OPEN →</span>
            </div>
            <ul className="util-features">
              {features.map(f => <li key={f}>{f}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}

export default function UtilitiesPanel() {
  const { state } = useApp()
  const [subView, setSubView] = useState<SubView>(null)

  useEffect(() => {
    if (state.railTab !== 'utils') setSubView(null)
  }, [state.railTab])

  const content = (() => {
    if (subView === 'video') return <VideoConfig onBack={() => setSubView(null)} />
    if (subView === 'convert') return <ConvertStudio onBack={() => setSubView(null)} />
    if (subView === 'upscale') return <UpscaleStudio onBack={() => setSubView(null)} />
    return <UtilitiesIndex onOpen={setSubView} />
  })()

  return <aside className="inspector">{content}</aside>
}
