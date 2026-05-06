import React, { useRef, useState, useEffect } from 'react'
import { IcPlay, IcPause, IcPrev, IcNext, IcVol } from '../Icons'
import type { FileInfo } from '../../context/AppContext'

interface Props {
  file: FileInfo
}

export default function CinemaPlayer({ file }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const src = `aperture://${encodeURIComponent(file.full_path)}`

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => { setCurrentTime(v.currentTime); setProgress(v.duration ? v.currentTime / v.duration : 0) }
    const onLoad = () => setDuration(v.duration || 0)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onLoad)
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('loadedmetadata', onLoad) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 800, gap: 0 }}>
      <div className="vplayer" style={{ position: 'relative' }}>
        <video
          ref={videoRef}
          src={src}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          onClick={togglePlay}
        />
        <div className="scanlines" style={{ pointerEvents: 'none' }} />
        {!playing && (
          <div className="play-orb" onClick={togglePlay} style={{ cursor: 'pointer', zIndex: 2 }}>
            <IcPlay style={{ width: 22, height: 22, color: 'var(--silver-1)', marginLeft: 3 }} />
          </div>
        )}
        <div className="frame-info">
          <span className="rec" />
          {file.filename}
        </div>
      </div>

      <div className="vctrls">
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="dock-btn" onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 5 }}>
            <IcPrev style={{ width: 14, height: 14 }} />
          </button>
          <button className="dock-btn" onClick={togglePlay}>
            {playing ? <IcPause style={{ width: 14, height: 14 }} /> : <IcPlay style={{ width: 14, height: 14 }} />}
          </button>
          <button className="dock-btn" onClick={() => { if (videoRef.current) videoRef.current.currentTime += 5 }}>
            <IcNext style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className="vtrack" onClick={e => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          const pct = (e.clientX - rect.left) / rect.width
          if (videoRef.current) videoRef.current.currentTime = pct * videoRef.current.duration
        }} style={{ cursor: 'pointer' }}>
          <div className="bar">
            <div className="fill" style={{ width: `${progress * 100}%` }} />
            <div className="head" style={{ left: `${progress * 100}%` }} />
          </div>
        </div>

        <div className="v-time">
          <span style={{ color: 'var(--wine-3)' }}>{formatTime(currentTime)}</span>
          <span className="dim"> / {formatTime(duration)}</span>
        </div>

        <button className="dock-btn" title="Volume"><IcVol style={{ width: 14, height: 14 }} /></button>
      </div>
    </div>
  )
}
