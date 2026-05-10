import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { IcCinema, IcConvert, IcUpscale, IcWand, IcBack } from '../Icons'

type SubView = null | 'video' | 'convert' | 'upscale' | 'aivideo'

const TILES = [
  {
    k: 'video' as const,
    Icon: IcCinema,
    status: 'beta',
    title: 'Cinema',
    em: 'Player',
    desc: 'Auto-engages on video files. Frame-accurate scrub, A/B loop, in/out marks.',
    features: ['J·K·L shuttle keys', 'A/B loop markers', 'Reel-style playhead']
  },
  {
    k: 'convert' as const,
    Icon: IcConvert,
    status: 'planned',
    title: 'File',
    em: 'Conversion',
    desc: 'Batch convert format and color space without leaving the suite.',
    features: ['JPEG · PNG · WebP · AVIF', 'Color-space convert', 'Mirror folder structure']
  },
  {
    k: 'upscale' as const,
    Icon: IcUpscale,
    status: 'planned',
    title: 'Upscale',
    em: 'Studio',
    desc: '2× / 4× model-driven enhancement with grain preservation.',
    features: ['Real-ESRGAN · SwinIR', 'Preserve film grain', 'GPU queue']
  },
  {
    k: 'aivideo' as const,
    Icon: IcWand,
    status: 'planned',
    title: 'AI Video',
    em: 'Atelier',
    desc: 'Cut, restyle, interpolate. Prompt-driven editing on the timeline.',
    features: ['Prompt-to-cut', 'Frame interpolation', 'Style transfer']
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

function PlannedPane({ onBack, title, sub }: { onBack: () => void; title: React.ReactNode; sub: string }) {
  return (
    <div className="sub-view">
      <SubBack onBack={onBack} />
      <h2 className="section-title" style={{ fontSize: 15 }}>{title}</h2>
      <div className="section-sub">{sub}</div>
      <div style={{ marginTop: 22, padding: 16, border: '1px dashed rgba(196,192,200,0.08)', borderRadius: 3, background: 'rgba(0,0,0,0.25)' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--wine-3)', textTransform: 'uppercase', marginBottom: 8 }}>Roadmap</div>
        <div style={{ fontSize: 11, color: 'var(--silver-3)', lineHeight: 1.7 }}>
          UI shell is in place. Functionality is staged for a future release.
        </div>
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
              <span className={`util-status ${status}`}>● {status === 'beta' ? 'Beta' : 'Planned'}</span>
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
    if (subView === 'convert') return <PlannedPane onBack={() => setSubView(null)} title={<>File <em>Conversion</em></>} sub="Batch convert format · color space · containers" />
    if (subView === 'upscale') return <PlannedPane onBack={() => setSubView(null)} title={<>Upscale <em>Studio</em></>} sub="Model-driven enhancement · 2× · 4× · grain-aware" />
    if (subView === 'aivideo') return <PlannedPane onBack={() => setSubView(null)} title={<>AI Video <em>Atelier</em></>} sub="Prompt-driven cut · style · interpolate" />
    return <UtilitiesIndex onOpen={setSubView} />
  })()

  return <aside className="inspector">{content}</aside>
}
