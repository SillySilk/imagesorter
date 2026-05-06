import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export type Action =
  | 'keep' | 'reject' | 'next' | 'previous' | 'skip' | 'disabled'
  | 'random' | 'zoom_in' | 'zoom_out' | 'fit_to_page' | 'context_menu'

export interface ModeSettings {
  button_mappings: { left_click: Action; right_click: Action; middle_click: Action }
  wheel_mappings: { wheel_up: Action; wheel_down: Action }
  key_mappings: Record<string, Action>
}

export interface Config {
  schema_version?: number
  src: string
  keep: string
  reject?: string
  app_mode: 'sort' | 'view' | 'last'
  sort_settings: ModeSettings
  view_settings: ModeSettings
  options: {
    recursive_loading: boolean
    auto_advance: boolean
    confirm_delete: boolean
    file_types: string[]
  }
  filmography: {
    active_filter: string
    grain: number
    halation: number
    vignette: number
    color_cast: 'cool' | 'neutral' | 'warm' | 'wine'
    letterbox: 'off' | '1.85' | '2.39' | 'academy'
    live_preview: boolean
  }
  appearance: {
    theme: 'burgundy' | 'obsidian' | 'plum' | 'iron'
    accent: string
    display_font: string
    ui_font: string
    density: 'compact' | 'comfortable' | 'spacious'
    chrome_grain: boolean
    aperture_marks: boolean
    brushed_metal: boolean
  }
  utilities: {
    cinema: { auto_switch: boolean; ab_loop_key: string }
    convert: {
      format: string; quality: number; color_space: string
      resize: 'none' | 'long' | 'pct'; strip_metadata: boolean; mirror_folders: boolean
    }
    upscale: {
      engine: string; scale: 2 | 3 | 4; denoise: number; tile: number
      preserve_grain: boolean; rebake_halation: boolean; match_source_filter: string
    }
    aivideo: {
      model: string; style_strength: number; frame_rate: 24 | 30 | 60
      resolution: string; render_queue: 'local' | 'cloud'; auto_publish: boolean
    }
  }
}

export const VALID_ACTIONS = new Set<Action>([
  'keep', 'reject', 'next', 'previous', 'skip', 'disabled',
  'random', 'zoom_in', 'zoom_out', 'fit_to_page', 'context_menu'
])

const DEFAULT_SORT_SETTINGS: ModeSettings = {
  button_mappings: { left_click: 'keep', right_click: 'reject', middle_click: 'disabled' },
  wheel_mappings: { wheel_up: 'previous', wheel_down: 'next' },
  key_mappings: { space: 'random', ArrowUp: 'zoom_in', ArrowDown: 'zoom_out', f: 'fit_to_page' }
}

const DEFAULT_VIEW_SETTINGS: ModeSettings = {
  button_mappings: { left_click: 'next', right_click: 'context_menu', middle_click: 'random' },
  wheel_mappings: { wheel_up: 'previous', wheel_down: 'next' },
  key_mappings: { ArrowUp: 'zoom_in', ArrowDown: 'zoom_out', f: 'fit_to_page', space: 'random' }
}

export const DEFAULT_CONFIG: Config = {
  schema_version: 8,
  src: '',
  keep: '',
  reject: '',
  app_mode: 'view',
  sort_settings: { ...DEFAULT_SORT_SETTINGS },
  view_settings: { ...DEFAULT_VIEW_SETTINGS },
  options: {
    recursive_loading: false,
    auto_advance: false,
    confirm_delete: true,
    file_types: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'bmp', 'heic', 'cr2', 'nef', 'arw', 'dng']
  },
  filmography: {
    active_filter: 'none',
    grain: 0,
    halation: 0,
    vignette: 0,
    color_cast: 'neutral',
    letterbox: 'off',
    live_preview: false
  },
  appearance: {
    theme: 'burgundy',
    accent: '#a82d44',
    display_font: 'Cormorant Garamond',
    ui_font: 'Inter',
    density: 'comfortable',
    chrome_grain: true,
    aperture_marks: true,
    brushed_metal: false
  },
  utilities: {
    cinema: { auto_switch: true, ab_loop_key: 'i' },
    convert: { format: 'JPEG', quality: 92, color_space: 'sRGB', resize: 'none', strip_metadata: false, mirror_folders: false },
    upscale: { engine: 'Real-ESRGAN_4x', scale: 4, denoise: 0, tile: 512, preserve_grain: false, rebake_halation: false, match_source_filter: 'none' },
    aivideo: { model: 'default', style_strength: 70, frame_rate: 24, resolution: '1920x1080', render_queue: 'local', auto_publish: false }
  }
}

function deepMerge<T>(target: T, source: Partial<T>): T {
  const out = { ...target }
  for (const key of Object.keys(source as object) as (keyof T)[]) {
    const sv = source[key]
    const tv = target[key]
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv) && typeof tv === 'object' && tv !== null) {
      out[key] = deepMerge(tv, sv as Partial<typeof tv>)
    } else if (sv !== undefined) {
      out[key] = sv as T[keyof T]
    }
  }
  return out
}

function getConfigPath(): string {
  const userDataPath = path.join(app.getPath('userData'), 'culler_settings.json')
  const cwdPath = path.join(process.cwd(), 'culler_settings.json')
  const oldAppPath = path.join('C:\\AI\\image sort', 'culler_settings.json')
  if (fs.existsSync(cwdPath)) return cwdPath
  if (fs.existsSync(oldAppPath)) return oldAppPath
  return userDataPath
}

function migrate(data: Record<string, unknown>): Config {
  const d = data as Record<string, unknown>

  // v1: no sort_settings at all
  if (!('sort_settings' in d)) {
    const base = deepMerge(DEFAULT_CONFIG, {
      src: (d.src as string) || '',
      keep: (d.keep as string) || ''
    })
    return base
  }

  // v2–v4: button_mappings at top level (no sort_settings)
  if ('button_mappings' in d && !('sort_settings' in d)) {
    const sort = {
      button_mappings: (d.button_mappings as ModeSettings['button_mappings']) || DEFAULT_SORT_SETTINGS.button_mappings,
      wheel_mappings: (d.wheel_mappings as ModeSettings['wheel_mappings']) || DEFAULT_SORT_SETTINGS.wheel_mappings,
      key_mappings: (d.key_mappings as Record<string, Action>) || DEFAULT_SORT_SETTINGS.key_mappings
    }
    delete d.button_mappings; delete d.wheel_mappings; delete d.key_mappings
    d.sort_settings = sort
    d.view_settings = DEFAULT_VIEW_SETTINGS
  }

  // Ensure view_settings exists
  if (!('view_settings' in d)) {
    d.view_settings = DEFAULT_VIEW_SETTINGS
  }

  // Add middle_click if missing
  for (const mode of ['sort_settings', 'view_settings'] as const) {
    const s = d[mode] as ModeSettings
    if (s && s.button_mappings && !('middle_click' in s.button_mappings)) {
      const def = mode === 'sort_settings' ? DEFAULT_SORT_SETTINGS : DEFAULT_VIEW_SETTINGS
      s.button_mappings.middle_click = def.button_mappings.middle_click
    }
  }

  // Fix old view right_click default
  const vs = d.view_settings as ModeSettings
  if (vs?.button_mappings?.right_click === ('previous' as Action)) {
    vs.button_mappings.right_click = 'context_menu'
  }

  // Ensure app_mode exists
  if (!('app_mode' in d)) d.app_mode = 'view'

  // Migrate key name: "Up"/"Down" → "ArrowUp"/"ArrowDown"
  for (const mode of ['sort_settings', 'view_settings'] as const) {
    const s = d[mode] as ModeSettings
    if (s?.key_mappings) {
      const km = s.key_mappings
      if ('Up' in km) { km['ArrowUp'] = km['Up']; delete km['Up'] }
      if ('Down' in km) { km['ArrowDown'] = km['Down']; delete km['Down'] }
    }
  }

  // v8: deep-merge new top-level sections with defaults (preserves existing values)
  const merged = deepMerge(DEFAULT_CONFIG, d as Partial<Config>)
  merged.schema_version = 8
  return merged
}

function validate(config: unknown): { ok: boolean; error?: string } {
  if (typeof config !== 'object' || config === null) return { ok: false, error: 'Config must be an object' }
  const c = config as Record<string, unknown>

  // Allow old formats — they'll be migrated
  if (!('sort_settings' in c) || !('view_settings' in c)) return { ok: true }

  for (const key of ['src', 'keep', 'sort_settings', 'view_settings', 'options']) {
    if (!(key in c)) return { ok: false, error: `Missing required key: ${key}` }
  }
  for (const mode of ['sort_settings', 'view_settings']) {
    const s = c[mode] as ModeSettings
    if (!s?.button_mappings?.left_click || !s?.button_mappings?.right_click) {
      return { ok: false, error: `${mode}: missing required button mappings` }
    }
    for (const [k, v] of Object.entries(s.button_mappings)) {
      if (!VALID_ACTIONS.has(v as Action)) return { ok: false, error: `Invalid action '${v}' in ${mode}.button_mappings.${k}` }
    }
    for (const [k, v] of Object.entries(s.key_mappings || {})) {
      if (!VALID_ACTIONS.has(v as Action)) return { ok: false, error: `Invalid action '${v}' for key '${k}'` }
    }
  }
  return { ok: true }
}

export class ConfigManager {
  private configPath: string
  config: Config

  constructor() {
    this.configPath = getConfigPath()
    this.config = this.load()
  }

  load(): Config {
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        const { ok, error } = validate(raw)
        if (!ok) {
          console.warn(`Config validation failed: ${error}. Using defaults.`)
          return structuredClone(DEFAULT_CONFIG)
        }
        const migrated = migrate(raw)
        this.save(migrated)
        return migrated
      } catch (e) {
        console.error('Config load error:', e)
        return structuredClone(DEFAULT_CONFIG)
      }
    }

    // Check old app location and migrate
    const oldPath = path.join('C:\\AI\\image sort', 'culler_settings.json')
    if (fs.existsSync(oldPath) && oldPath !== this.configPath) {
      try {
        const raw = JSON.parse(fs.readFileSync(oldPath, 'utf-8'))
        const migrated = migrate(raw)
        this.save(migrated)
        return migrated
      } catch { /* ignore */ }
    }

    return structuredClone(DEFAULT_CONFIG)
  }

  save(config: Config): boolean {
    try {
      const dir = path.dirname(this.configPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
      this.config = config
      return true
    } catch (e) {
      console.error('Config save error:', e)
      return false
    }
  }

  getConfigPath(): string { return this.configPath }
}
