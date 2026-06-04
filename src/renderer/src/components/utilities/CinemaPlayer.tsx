import React, { useRef, useState, useEffect, useCallback } from 'react'
import { IcPlay, IcPause, IcVol, IcFull } from '../Icons'
import type { FileInfo } from '../../context/AppContext'

interface Props {
  file: FileInfo
}

const RATES = [1, 1.25, 1.5, 2, 0.5]

export default function CinemaPlayer({ file }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hideTimer = useRef<number | null>(null)

  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const src = `aperture://${encodeURIComponent(file.full_path)}`

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [])

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    const mm = h > 0 ? m.toString().padStart(2, '0') : m.toString()
    return `${h > 0 ? h + ':' : ''}${mm}:${sec.toString().padStart(2, '0')}`
  }

  // Reset transient state whenever the source changes
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [src])

  // Keep the <video> element in sync with volume / mute / rate state
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = muted
    v.playbackRate = rate
  }, [volume, muted, rate])

  // Wire up media events
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => setCurrentTime(v.currentTime)
    const onMeta = () => setDuration(v.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onVol = () => { setVolume(v.volume); setMuted(v.muted) }
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('durationchange', onMeta)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('volumechange', onVol)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('durationchange', onMeta)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('volumechange', onVol)
    }
  }, [])

  // Track fullscreen changes on our wrapper
  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement === wrapRef.current) document.exitFullscreen()
    else wrapRef.current?.requestFullscreen().catch(() => {})
  }, [])

  // Auto-hide the control bar while playing; always show when paused
  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    if (videoRef.current && !videoRef.current.paused) {
      hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2600)
    }
  }, [])

  useEffect(() => {
    if (!playing) {
      setControlsVisible(true)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    } else {
      revealControls()
    }
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current) }
  }, [playing, revealControls])

  const seek = (t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = t
    setCurrentTime(t)
  }

  const cycleRate = () => {
    const idx = RATES.indexOf(rate)
    setRate(RATES[(idx + 1) % RATES.length])
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const volPct = (muted ? 0 : volume) * 100

  return (
    <div
      className={`image-frame vframe${controlsVisible ? '' : ' hide-cursor'}`}
      ref={wrapRef}
      onMouseMove={revealControls}
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        src={src}
        className="vmedia"
        onClick={togglePlay}
        playsInline
      />

      {!playing && (
        <button className="vplay-center" onClick={togglePlay} aria-label="Play">
          <IcPlay style={{ width: 26, height: 26, marginLeft: 4 }} />
        </button>
      )}

      <div className={`vbar${controlsVisible ? '' : ' hidden'}`} onDoubleClick={e => e.stopPropagation()}>
        <button className="vbtn" onClick={togglePlay} title={playing ? 'Pause (click video)' : 'Play (click video)'}>
          {playing ? <IcPause style={{ width: 15, height: 15 }} /> : <IcPlay style={{ width: 15, height: 15 }} />}
        </button>

        <span className="vtime">{formatTime(currentTime)}</span>

        <input
          className="vrange vseek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={currentTime}
          onChange={e => seek(Number(e.target.value))}
          style={{ '--pct': `${progressPct}%` } as React.CSSProperties}
        />

        <span className="vtime dim">{formatTime(duration)}</span>

        <div className="vvol">
          <button className="vbtn" onClick={() => setMuted(m => !m)} title={muted ? 'Unmute' : 'Mute'}>
            <IcVol style={{ width: 15, height: 15, opacity: muted ? 0.4 : 1 }} />
          </button>
          <input
            className="vrange vvol-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={e => {
              const val = Number(e.target.value)
              setVolume(val)
              setMuted(val === 0)
            }}
            style={{ '--pct': `${volPct}%` } as React.CSSProperties}
          />
        </div>

        <button className="vbtn vrate" onClick={cycleRate} title="Playback speed">
          {rate}×
        </button>

        <button className="vbtn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          <IcFull style={{ width: 15, height: 15 }} />
        </button>
      </div>
    </div>
  )
}
