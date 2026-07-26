import type { Config } from '../../main/config'

type Appearance = Config['appearance']

/* ---- color helpers: derive a coherent accent ramp from one hex ---- */

function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  h = Math.round(h * 60)
  if (h < 0) h += 360
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]
}

/** Build the --wine-* accent ramp from a single base accent color. */
function accentRamp(base: string): Record<string, string> {
  const [h, s, l] = hexToHsl(base)
  const shade = (dl: number) => hslToHex(h, Math.min(100, s + 4), Math.max(6, l + dl))
  const [r, g, b] = hexToRgb(base)
  return {
    '--wine-3': base,
    '--wine-4': shade(-9),
    '--wine-5': shade(-16),
    '--wine-6': shade(-25),
    '--wine-7': shade(-28),
    '--wine-9': shade(-32),
    '--wine-glow': base,
    '--line-wine': `rgba(${r}, ${g}, ${b}, 0.4)`
  }
}

/* Fonts that need the CSS var wrapped in quotes vs. bare system keywords. */
function fontStack(name: string, kind: 'serif' | 'sans'): string {
  const fallback = kind === 'serif' ? "'Garamond', serif" : "-apple-system, system-ui, sans-serif"
  if (name === 'system-ui') return 'system-ui, -apple-system, sans-serif'
  return `'${name}', ${fallback}`
}

/**
 * Apply appearance config to the document root. Idempotent — safe to call on
 * every config change (live preview) and on load. Reverting a value restores
 * the base stylesheet defaults.
 */
export function applyAppearance(ap: Appearance): void {
  const root = document.documentElement

  root.setAttribute('data-theme', ap.theme)
  root.setAttribute('data-density', ap.density)
  root.setAttribute('data-grain', ap.chrome_grain ? 'on' : 'off')
  root.setAttribute('data-marks', ap.aperture_marks ? 'on' : 'off')
  root.setAttribute('data-metal', ap.brushed_metal ? 'on' : 'off')

  const ramp = accentRamp(ap.accent)
  for (const [k, v] of Object.entries(ramp)) root.style.setProperty(k, v)

  root.style.setProperty('--serif', fontStack(ap.display_font, 'serif'))
  root.style.setProperty('--sans', fontStack(ap.ui_font, 'sans'))
}
