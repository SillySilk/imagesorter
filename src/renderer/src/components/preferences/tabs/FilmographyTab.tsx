import React from 'react'
import { Field, Toggle, Seg, Select } from '../forms/Field'
import { Slider } from '../forms/Field'
import type { Config } from '../../../../../main/config'

const FILTERS = [
  { id: 'none', name: 'None', meta: '—' },
  { id: 'kodachrome64', name: "Kodachrome '64", meta: 'Warm · Saturated', swatchClass: 'f-kodachrome' },
  { id: 'velvia50', name: 'Velvia 50', meta: 'Vivid · High contrast', swatchClass: 'f-velvia' },
  { id: 'trix400', name: 'Tri-X 400', meta: 'B&W · Gritty', swatchClass: 'f-noir' },
  { id: 'cyanotype', name: 'Cyanotype', meta: 'Blue · Archival', swatchClass: 'f-cyanotype' },
  { id: 'platinum', name: 'Platinum', meta: 'Warm · Matte', swatchClass: 'f-platinum' },
  { id: 'halation', name: 'Halation', meta: 'Bloom · Glow' },
  { id: '8mm', name: '8mm Reel', meta: 'Vintage · Scratched' },
  { id: 'chamber', name: 'Chamber', meta: 'Dark · Moody' },
]

interface Props {
  draft: Config
  onChange: (updated: Partial<Config>) => void
}

export default function FilmographyTab({ draft, onChange }: Props) {
  const film = draft.filmography

  const updateFilm = (patch: Partial<Config['filmography']>) => {
    onChange({ filmography: { ...film, ...patch } })
  }

  return (
    <div>
      <div className="section-title">Filmography <em>& filters</em></div>
      <div className="section-sub">Atelier · Non-destructive look presets</div>

      <div className="filter-strip">
        {FILTERS.map(f => (
          <div
            key={f.id}
            className={`filter-cell${film.active_filter === f.id ? ' active' : ''}`}
            onClick={() => updateFilm({ active_filter: f.id })}
          >
            <div className={`swatch${f.swatchClass ? ' ' + f.swatchClass : ''}`} />
            <div className="name">{f.name}</div>
            <div className="meta">{f.meta}</div>
          </div>
        ))}
      </div>

      <Field label="Grain" desc="Film grain intensity (0–100)">
        <Slider min={0} max={100} value={film.grain} onChange={v => updateFilm({ grain: v })} label="%" />
      </Field>

      <Field label="Halation" desc="Light bleed / bloom around highlights">
        <Slider min={0} max={100} value={film.halation} onChange={v => updateFilm({ halation: v })} label="%" />
      </Field>

      <Field label="Vignette" desc="Edge darkening intensity">
        <Slider min={0} max={100} value={film.vignette} onChange={v => updateFilm({ vignette: v })} label="%" />
      </Field>

      <Field label="Color Cast">
        <Seg
          options={[
            { value: 'cool', label: 'Cool' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'warm', label: 'Warm' },
            { value: 'wine', label: 'Wine' },
          ]}
          value={film.color_cast}
          onChange={v => updateFilm({ color_cast: v as Config['filmography']['color_cast'] })}
        />
      </Field>

      <Field label="Letterbox">
        <Seg
          options={[
            { value: 'off', label: 'Off' },
            { value: '1.85', label: '1.85' },
            { value: '2.39', label: '2.39' },
            { value: 'academy', label: '4:3' },
          ]}
          value={film.letterbox}
          onChange={v => updateFilm({ letterbox: v as Config['filmography']['letterbox'] })}
        />
      </Field>

      <Field label="Live Preview" desc="Apply filters while culling">
        <Toggle value={film.live_preview} onChange={v => updateFilm({ live_preview: v })} />
      </Field>
    </div>
  )
}
