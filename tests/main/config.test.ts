import { describe, it, expect, vi } from 'vitest'

// config.ts imports `app` from electron purely to resolve the config path.
// Nothing under test here touches the filesystem.
vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\fake\\userData' }
}))

const { migrate, validate, DEFAULT_CONFIG } = await import('../../src/main/config')

/** A saved config as it looked at schema 8, with the now-removed sections. */
function v8Config(): Record<string, unknown> {
  return {
    schema_version: 8,
    src: 'D:\\Photos',
    keep: 'D:\\Photos\\Keep',
    reject: 'D:\\Photos\\Rejected',
    app_mode: 'sort',
    sort_settings: {
      button_mappings: { left_click: 'keep', right_click: 'reject', middle_click: 'disabled' },
      wheel_mappings: { wheel_up: 'previous', wheel_down: 'next' },
      key_mappings: { space: 'random', f: 'fit_to_page' }
    },
    view_settings: {
      button_mappings: { left_click: 'next', right_click: 'context_menu', middle_click: 'random' },
      wheel_mappings: { wheel_up: 'previous', wheel_down: 'next' },
      key_mappings: { ArrowUp: 'zoom_in' }
    },
    options: {
      recursive_loading: true,
      auto_advance: false,
      confirm_delete: true,
      overwrite_existing: true,
      file_types: ['jpg', 'png']
    },
    filmography: {
      active_filter: 'Portra400', grain: 40, halation: 12,
      vignette: 5, color_cast: 'warm', letterbox: '2.39', live_preview: true
    },
    appearance: { theme: 'plum', accent: '#ff0000', density: 'compact' },
    utilities: {
      cinema: { auto_switch: false, ab_loop_key: 'i' },
      convert: { format: 'JPEG', quality: 80, color_space: 'sRGB', resize: 'none', strip_metadata: true, mirror_folders: false },
      upscale: { engine: 'Real-ESRGAN_4x', scale: 4, denoise: 0, tile: 512 },
      aivideo: { model: 'default', style_strength: 70, frame_rate: 24, resolution: '1920x1080' }
    }
  }
}

describe('migrate — schema 9 removals', () => {
  it('strips filmography, aivideo and convert.color_space from a saved v8 config', () => {
    const out = migrate(v8Config()) as unknown as Record<string, unknown>

    // deepMerge copies unrecognised source keys straight through, so these only
    // disappear if the migration deletes them explicitly. That is the whole point.
    expect(out).not.toHaveProperty('filmography')
    expect(out.utilities).not.toHaveProperty('aivideo')
    expect(out.utilities as Record<string, unknown>).toBeDefined()
    expect((out.utilities as { convert: Record<string, unknown> }).convert).not.toHaveProperty('color_space')
  })

  it('stamps schema_version 9', () => {
    expect(migrate(v8Config()).schema_version).toBe(9)
  })

  it('lowercases a capitalised convert format', () => {
    // Pre-v9 stored 'JPEG'. The extension table is keyed by sharp's lowercase
    // names, so an un-normalised value produced a filename ending in `undefined`.
    expect(migrate(v8Config()).utilities.convert.format).toBe('jpeg')
  })

  it('leaves an already-lowercase format alone', () => {
    const raw = v8Config()
    ;(raw.utilities as { convert: Record<string, unknown> }).convert.format = 'webp'
    expect(migrate(raw).utilities.convert.format).toBe('webp')
  })
})

describe('migrate — preserves real user settings', () => {
  it('keeps paths, mode, options and key mappings intact', () => {
    const out = migrate(v8Config())
    expect(out.src).toBe('D:\\Photos')
    expect(out.keep).toBe('D:\\Photos\\Keep')
    expect(out.reject).toBe('D:\\Photos\\Rejected')
    expect(out.app_mode).toBe('sort')
    expect(out.options.recursive_loading).toBe(true)
    expect(out.options.file_types).toEqual(['jpg', 'png'])
    expect(out.sort_settings.key_mappings.Space).toBe('random')
    expect(out.utilities.cinema.auto_switch).toBe(false)
    expect(out.utilities.convert.quality).toBe(80)
    expect(out.utilities.convert.strip_metadata).toBe(true)
  })

  it('fills in sections the saved config never had', () => {
    const raw = v8Config()
    delete raw.appearance
    expect(migrate(raw).appearance.theme).toBe(DEFAULT_CONFIG.appearance.theme)
  })
})

describe('migrate — older schemas', () => {
  it('upgrades a v1 config (no sort_settings) to schema 9 with defaults', () => {
    const out = migrate({ src: 'C:\\Old', keep: 'C:\\Old\\Keep' })
    expect(out.schema_version).toBe(9)
    expect(out.src).toBe('C:\\Old')
    expect(out.keep).toBe('C:\\Old\\Keep')
    expect(out.sort_settings.button_mappings.left_click).toBe('keep')
    expect(out).not.toHaveProperty('filmography')
  })

  it('lifts v2-era top-level button_mappings into sort_settings', () => {
    const out = migrate({
      src: '', keep: '',
      sort_settings: {
        button_mappings: { left_click: 'keep', right_click: 'reject', middle_click: 'disabled' },
        wheel_mappings: { wheel_up: 'previous', wheel_down: 'next' },
        key_mappings: {}
      }
    })
    expect(out.view_settings).toBeDefined()
    expect(out.view_settings.button_mappings.right_click).toBe('context_menu')
  })

  it('renames legacy Up/Down key mappings to ArrowUp/ArrowDown', () => {
    const raw = v8Config()
    ;(raw.sort_settings as { key_mappings: Record<string, string> }).key_mappings = { Up: 'zoom_in', Down: 'zoom_out' }
    const km = migrate(raw).sort_settings.key_mappings
    expect(km.ArrowUp).toBe('zoom_in')
    expect(km.ArrowDown).toBe('zoom_out')
    expect(km).not.toHaveProperty('Up')
  })

  it('renames the legacy lowercase "space" key mapping to "Space"', () => {
    // The shipped default bound the spacebar as "space", a human name rather
    // than KeyboardEvent.code's actual "Space" — so it silently never fired.
    const raw = v8Config()
    ;(raw.sort_settings as { key_mappings: Record<string, string> }).key_mappings = { space: 'random' }
    const km = migrate(raw).sort_settings.key_mappings
    expect(km.Space).toBe('random')
    expect(km).not.toHaveProperty('space')
  })

  it('is idempotent — migrating twice changes nothing further', () => {
    const once = migrate(v8Config())
    const twice = migrate(JSON.parse(JSON.stringify(once)))
    expect(twice).toEqual(once)
  })
})

describe('validate', () => {
  it('accepts the shipped defaults', () => {
    expect(validate(DEFAULT_CONFIG).ok).toBe(true)
  })

  it('rejects a non-object', () => {
    expect(validate(null).ok).toBe(false)
    expect(validate('nope').ok).toBe(false)
  })

  it('rejects an unknown action in a button mapping', () => {
    const bad = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
    bad.sort_settings.button_mappings.left_click = 'explode'
    const res = validate(bad)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/explode/)
  })

  it('rejects an unknown action in a key mapping', () => {
    const bad = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
    bad.view_settings.key_mappings.q = 'launch_missiles'
    expect(validate(bad).ok).toBe(false)
  })

  it('passes old-format configs through for migration rather than failing them', () => {
    expect(validate({ src: '', keep: '' }).ok).toBe(true)
  })
})
