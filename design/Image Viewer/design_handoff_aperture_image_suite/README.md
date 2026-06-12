# Handoff: Aperture Image Suite — Redesign

## Overview

Aperture is a desktop image-culling and viewing suite (Python/Tkinter origin in
`app.py` + `culler_settings.json`). This handoff covers a complete UI redesign
that:

1. Reskins the existing viewer chrome in a dark **burgundy / silver / obsidian**
   palette with subtle vintage-photographic and hardware-leather visual motifs.
2. Replaces the current settings dialog with a comprehensive multi-tab
   **Preferences** modal that fully exposes the existing config schema
   (`culler_settings.json`) plus new sections.
3. Introduces a new top-level **Utilities** suite with four planned tools:
   Cinema (Video) Player, File Conversion, Upscale Studio, AI Video Atelier.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX** —
prototypes that show the intended look, layout and behavior. They are **not
production code to copy verbatim**. Your task is to **recreate these designs in
the target codebase** (the existing Tkinter app, or — if rewriting — the chosen
target framework such as PyQt6, Electron + React, or Tauri + React) using its
established patterns and libraries.

The HTML prototype uses React 18 + inline JSX via Babel-standalone purely as a
quick visual scaffold. Do not bring Babel-standalone or the JSX scripts into the
real app.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, and component
treatments are intended to ship as-shown. Pixel-perfect re-implementation
expected. Where target framework primitives differ (e.g. Tk widgets cannot do
true gradients or backdrop-blur), approximate as close as possible without
breaking the established palette and rhythm.

## Target environment

Two viable paths — pick based on user preference:

- **In place (Tkinter)** — keep `app.py` and rebuild the settings dialog as a
  themed `Toplevel` window using `ttk.Style`. The vintage motifs (sprockets,
  film-grain overlays, deco corners) won't all render in Tk; substitute with
  flat colored frames, separators, and a single static grain PNG overlay where
  possible. The full color palette and typography below all translate.
- **Rewrite to React/Electron or PyQt6** — much closer 1:1 to the prototype.
  Recommended if the user wants the Utilities suite (video player, GPU queue,
  AI tools) which Tkinter is poorly suited for.

The HTML prototype is the single source of visual truth either way.

## Screens / Views

### 1. App Shell

CSS Grid: `grid-template-columns: 56px 1fr; grid-template-rows: 44px 1fr 28px;`

- **Title bar** (44 px, full-width, top): brand mark · menu (File · Edit · View
  · Tools · Preferences · Help) · spacer · mode toggle (Sort/View segmented) ·
  status meta · macOS-style traffic lights (decorative).
- **Left rail** (56 px): icon buttons for Browser, Cull/Sort, Film & Filters,
  Utilities, History; bottom: Preferences (gear).
- **Main area**: 2-column grid `1fr 280px` — canvas + right inspector panel.
- **Status bar** (28 px, full-width, bottom): mode pip · src path · keep path
  · GPU/MEM stats · version.

Backgrounds use a `.leather` class — radial wine glow + radial dark vignette +
2-layer dot noise via `radial-gradient` mixed with `mix-blend-mode: overlay`.
A site-wide `.grain::after` pseudo-element overlays an SVG turbulence noise at
~0.06 alpha for film-grain texture.

### 2. Canvas (center)

- Background: radial gradient from `#0c080d` to `#050308`.
- Four absolutely-positioned 28×28 corner brackets at canvas extents (1px
  silver-5 borders, opacity 0.35) — aperture marks.
- Two vertical "sprocket strips" (left/right edges) — column of 8 dark cells
  (`12 × 16 px`, 1px border `--silver-6`, inset shadow), opacity 0.4.
- HUD chips at four corners (mono 10px, uppercase, 0.12em letter-spacing,
  translucent black bg w/ 1px border, backdrop-blur 8px). Top-left chip is
  wine-bordered for mode label.
- Center **image-frame**: width `min(72%, 720px)`, aspect ratio `4/5`,
  diagonal-stripe placeholder when empty; when loaded, fills with the image
  plus a halation bloom layer (radial wine-toned screen blend), film-grain
  SVG turbulence (overlay blend), and inset vignette.
- **Action dock** centered along bottom: rounded 8px panel (gradient
  `#1a1218→#0a070d`, 1px silver border, deep drop-shadow + inset bevel), 36×36
  square buttons. Order: Prev · Keep (sage `#b8d4a8`) · Reject (wine
  `#a82d44`) · Skip · divider · Random · Star · zoom out / `100%` / zoom in
  group · Fit · divider · Fullscreen.

### 3. Inspector Panel (right, 280 px)

Vertical scrolling list of titled sections, each separated by 1px line-1
borders.

- Section title: mono 9px, uppercase, 0.22em tracking, with a 4×4 wine dot
  before the label and an optional right-aligned counter.
- **File** section: 5 key-value rows (`90 px` mono labels + value).
- **Exposure** section: 56 px full-width histogram strip (gradient stand-in for
  the prototype — replace with real luminance histogram canvas in production).
- **Disposition** section: destination, action, tags. Action shown in sage when
  pending Keep, wine when pending Reject.
- **Queue** section: 4-column grid of square thumbnails. States: empty
  (diagonal stripe), `current` (wine border + glow), `kept` (sage check
  bottom-right), `rejected` (40% opacity + wine ×).
- **Active Filter** section: 48×36 swatch + filter name (Cormorant Garamond
  italic 14px cream) + meta line (mono 9px).

### 4. Preferences Modal

Triggered from title-bar Preferences button, rail gear, or `Cmd/Ctrl + ,`.

- Scrim: full-viewport, `rgba(4,3,6,0.7)` + `backdrop-filter: blur(6px)`.
- Modal panel: `min(1100, 100%) × min(720, 100%)`, dark gradient bg, 1px
  silver border, 6px radius, deep drop-shadow.
- 2px wine top stripe (gradient transparent → wine-3 → transparent).
- Four corner deco ornaments (`<DecoCorner/>` SVG, wine-3, 26×26, opacity
  0.55).
- 3-row grid: header (60 px) / body (1fr) / footer (auto).
- Header: eyebrow `◆ PREFERENCES` (wine, mono, 0.32em tracking) + title
  `Aperture · settings` (Cormorant Garamond 26px) + close X.
- Body: 220 px tab rail + content. Tab groups (Library, Atelier, Suite) shown
  as muted mono labels; tab items are full-width left-aligned with icon +
  label + optional count, active state has wine left-border + radial
  background fade.
- Footer: meta hint (`◇ All edits apply live · ⌘S writes to disk`) + Reset /
  Cancel / Save buttons.

#### 4a. General tab

Form rows using a `.field` row primitive: 180 px label column + control. Rows
are separated by 1px dashed lines.

Fields in order:

1. **Source Folder** — text input + Browse button. Default value seeded from
   `culler_settings.json` `src` field.
2. **Keep Folder** — same. From `keep`.
3. **Reject Folder** — optional. Empty placeholder = "rejected files removed".
4. **Default App Mode** — segmented `Sort / View / Last Used`. Maps to
   `app_mode` in JSON.
5. **Recursive Loading** — toggle. Maps to `options.recursive_loading`.
6. **File Types** — chip set (jpg/jpeg/png/webp/gif/tiff/bmp/heic/raw/cr2/nef/
   arw/dng), active chips highlighted wine.
7. **Auto-advance** — toggle. New option.
8. **Confirm Before Delete** — toggle. New option.

#### 4b. Sort Mode / View Mode tabs

Two near-identical tabs that edit `sort_settings` and `view_settings`
respectively. Each contains three cards: **Mouse Buttons**, **Wheel**, **Keys**.

Within a card, each row is a `.keyrow` (4-col grid):
`110 px keycap | label | action select | trash button`.

- Keycap (`<span class="kbd">`) is a brushed-metal-look button with a thicker
  bottom border, mono 10px uppercase.
- Action select dropdown options: `keep, reject, next, previous, skip,
  disabled, random, zoom_in, zoom_out, fit_to_page, context_menu` — pulled
  directly from the existing `VALID_ACTIONS` set in `app.py`.
- Keys card has `+ Add key binding` ghost button at the bottom.

Validation rules (mirror `ConfigManager.validate`):
- `left_click`, `right_click`, `wheel_up`, `wheel_down` are required.
- `middle_click` optional.
- All actions must be in `VALID_ACTIONS`.

#### 4c. Filmography tab

Vintage non-destructive look presets.

- Top: horizontally-scrolling **filter strip**. Each cell = 110×80 swatch with
  filter-specific color overlay + name (mono 9px uppercase) + meta line.
  Active cell has wine outline + bloom shadow. Filters: None, Kodachrome '64,
  Velvia 50, Tri-X 400, Cyanotype, Platinum, Halation, 8mm Reel, Chamber.
- Field rows below: Grain (slider 0–100), Halation (0–100), Vignette (0–100),
  Color Cast (segmented Cool/Neutral/Warm/Wine), Letterbox (Off/1.85/2.39/4:3),
  "Live preview while culling" toggle.

Implementation note: In production these become CSS filter / WebGL shader
effects applied to the canvas image element. In Tkinter you'd pre-compose with
PIL (`ImageOps.colorize`, `ImageEnhance`, etc.) at view time and cache.

#### 4d. Appearance tab

- **Theme** — 4-tile picker (Burgundy active, Obsidian, Plum, Iron). Each tile
  shows three vertical color bands (accent / surface / silver).
- **Accent** — 5 colored circles, click to select, selected has silver ring +
  wine glow.
- **Display Font** — select (Cormorant Garamond, Playfair Display, EB Garamond,
  Cinzel).
- **UI Font** — select (Inter, IBM Plex Sans, Helvetica Neue, System Default).
- **Density** — segmented Compact/Comfortable/Spacious.
- **Film Grain on Chrome** — toggle.
- **Show Aperture Marks** — toggle.
- **Brushed Metal Hardware** — toggle.

#### 4e. Utilities tab

Index view: 2×2 grid of "util-tile" cards. Each tile:
`util-icon (36×36 dark-bg square w/ wine icon) → title (Cormorant 18px) →
description (silver-3, 11px) → status pill + OPEN → → feature list (mono 10px
with wine `+` markers)`.

Tile click opens its sub-view (covers same modal-content area, with a
`← Back to Utilities` button).

##### 4e-i. Cinema Player sub-view

- 16:9 video plate: wine "play orb" (56 px radial-gradient circle, silver
  border, wine glow), CRT scanlines overlay, recording dot + reel meta
  top-left, fps/codec top-right.
- Beneath: control strip — prev/play/next dock buttons + scrubber (4 px bar w/
  wine fill + silver knob with wine ring + tick marks for keyframes) + time
  display (wine current / muted total) + volume + fullscreen.
- Right sidebar: **Markers** card (timestamp + label + delete, with the active
  `KEEP` marker shown in sage) + Auto-Switch settings card (toggle to detect
  video files automatically, A/B loop key binding).

Behavior: when the main viewer is asked to load a file with extension in
`{mp4, mov, mkv, webm, avi}`, the Canvas is replaced with this Cinema Player
view automatically (no settings dialog needed). The "Detect video files"
toggle controls this auto-switch.

##### 4e-ii. File Conversion sub-view

- Drop zone (dashed border + offset outline) for files/folders.
- Two cards side-by-side: **Output** (Format select / Quality slider / Color
  space select) and **Transform** (Resize segmented / Strip metadata toggle /
  Mirror folders toggle).
- Conversion queue table: 4-col grid (File / From / To / Status). Wine arrow
  glyph in From→To column; cream-colored progress %.
- Footer actions: Clear queue (ghost) + Start batch (primary).

Supported formats: JPEG, PNG, WebP, AVIF, TIFF, HEIC for stills; MP4, MOV,
MKV, WebM for video. Color spaces: sRGB, Adobe RGB, DCI-P3, Rec.2020.

##### 4e-iii. Upscale Studio sub-view

- Top: `.compare` strip — two 16:10 panels split by 1px wine vertical line.
  Left panel labeled "Source · 1024×768" with a dark overlay; right labeled
  "Output · 4096×3072 · 4×" in wine, with a wine→transparent gradient.
- **Model** card: Engine select (Real-ESRGAN_4x, Real-ESRGAN_4x_anime, SwinIR,
  HAT, LDSR), Scale segmented (2×/3×/4×), Denoise slider, Tile size select.
- **Grain & Filmic** card: Preserve film grain toggle, Re-bake halation
  toggle, Match source filter select.
- **GPU Queue** card with progress bar and Pause button.
- Footer actions: Add reference (ghost) + Run upscale (primary).

##### 4e-iv. AI Video Atelier sub-view

- **Prompt area**: textarea + wine "Compose" send button (Cormorant italic).
- **Recipe chips** row: Tighten cuts / Color match / Re-time 60fps / Stabilize
  / Remove object / Match shot / B-roll fill.
- **Timeline** (140 px tall): ruler (mono 8px) + 4 tracks (V1, FX, A1, A2)
  with absolute-positioned `.clip` blocks. Clips have type styling — default
  wine for video, dark silver for audio, sepia/cream for FX. Each clip shows
  its name in mono 9px.
- Two cards: **Generation** (Model select, Style strength slider, Frame rate
  segmented 24/30/60) and **Output** (Resolution select, Render queue
  segmented Local GPU / Cloud, Auto-publish to Keep toggle).

## Interactions & Behavior

- **Mode toggle** (title bar): switches between Sort/View, swaps active
  control mappings, updates HUD label and status pip text.
- **Settings modal**: opens from title-bar Preferences, rail gear button, or
  Cmd/Ctrl+,. Closes on scrim click, X button, Cmd/Ctrl+W, or Esc. All edits
  apply live in-memory; **Save** writes to `culler_settings.json`. **Reset**
  reverts to `DEFAULT_CONFIG` from `ConfigManager`.
- **Tab switching**: tab item click swaps content pane; switching out of
  Utilities clears the sub-view state (so re-entering shows the index, not
  the last sub-view).
- **Field changes**: toggles flip immediately; sliders update on `input`;
  text inputs commit on blur or Enter; selects on change.
- **Folder Browse**: opens native folder picker (`tkinter.filedialog` /
  Electron `dialog.showOpenDialog`). On select, validate path exists and is
  writable.
- **Add key binding**: opens an inline capture row that listens for the next
  keypress, then offers an action select.
- **Filter strip**: click cell to set active filter; ⌘-click to compare A/B
  with current. Filter applies to canvas immediately when "Live preview while
  culling" is on.
- **Util tile click**: navigate to sub-view. Back button restores index.
- **Cinema Player auto-switch**: when the current file's extension is video,
  Canvas swaps for the player automatically. Mark/keep/reject keys still
  work; J/K/L provide shuttle. **In/Out** marks define a reel for the Keep
  destination.
- **Conversion queue / Upscale queue**: share a single GPU job runner
  (sequential by default). Show progress per row.
- **Loaded state toggle (LOAD/UNLOAD chip in HUD)**: prototype-only convenience.
  In production, "loaded" is determined by whether a source folder is set and
  has scannable files.

### Animations & Transitions

- All hover transitions: `120ms` ease-out for color and background; `180ms`
  for `transform: translateY(-1px)` on util tiles.
- Status pip pulse: `pulse 1.8s ease-in-out infinite` — opacity 1 → 0.4 → 1.
- Modal: fade scrim + scale-95-to-100 modal panel over `160ms`.

## State Management

Mirror the existing `ConfigManager` schema. Recommended state shape (TS-ish):

```ts
type Action =
  | 'keep' | 'reject' | 'next' | 'previous' | 'skip' | 'disabled'
  | 'random' | 'zoom_in' | 'zoom_out' | 'fit_to_page' | 'context_menu';

interface ModeSettings {
  button_mappings: { left_click: Action; right_click: Action; middle_click?: Action };
  wheel_mappings:  { wheel_up: Action; wheel_down: Action };
  key_mappings:    Record<string, Action>;
}

interface Config {
  src: string;
  keep: string;
  reject?: string;          // NEW
  app_mode: 'sort' | 'view' | 'last';
  sort_settings: ModeSettings;
  view_settings: ModeSettings;
  options: {
    recursive_loading: boolean;
    auto_advance: boolean;          // NEW
    confirm_delete: boolean;        // NEW
    file_types: string[];           // NEW
  };
  filmography: {                    // NEW
    active_filter: string;
    grain: number;        // 0–100
    halation: number;
    vignette: number;
    color_cast: 'cool' | 'neutral' | 'warm' | 'wine';
    letterbox: 'off' | '1.85' | '2.39' | 'academy';
    live_preview: boolean;
  };
  appearance: {                    // NEW
    theme: 'burgundy' | 'obsidian' | 'plum' | 'iron';
    accent: string;
    display_font: string;
    ui_font: string;
    density: 'compact' | 'comfortable' | 'spacious';
    chrome_grain: boolean;
    aperture_marks: boolean;
    brushed_metal: boolean;
  };
  utilities: {                     // NEW
    cinema:   { auto_switch: boolean; ab_loop_key: string };
    convert:  { format: string; quality: number; color_space: string;
                resize: 'none' | 'long' | 'pct'; strip_metadata: boolean;
                mirror_folders: boolean };
    upscale:  { engine: string; scale: 2|3|4; denoise: number; tile: number;
                preserve_grain: boolean; rebake_halation: boolean;
                match_source_filter: string };
    aivideo:  { model: string; style_strength: number; frame_rate: 24|30|60;
                resolution: string; render_queue: 'local' | 'cloud';
                auto_publish: boolean };
  };
}
```

Bump the schema version in `ConfigManager` and add a v5→v6 migration path
that fills the new fields with defaults. Existing users' configs stay valid.

## Design Tokens

### Colors

| Role               | Hex / OKLCH                       |
| ------------------ | --------------------------------- |
| ink-0 (deepest)    | `#06040a`                         |
| ink-1 (page)       | `#0c080d`                         |
| ink-2 (card)       | `#14101a`                         |
| ink-3 (raised)     | `#1c151f`                         |
| ink-4 (hover)      | `#251c2a`                         |
| wine-9             | `#2a0a13`                         |
| wine-7             | `#3d0e1c`                         |
| wine-6             | `#4a0e21`                         |
| wine-5             | `#6b1828`                         |
| wine-4             | `#8a1f33`                         |
| wine-3 (accent)    | `#a82d44`                         |
| wine-glow          | `oklch(45% 0.13 12)`              |
| silver-1 (text-1)  | `#f4f2ee`                         |
| silver-2           | `#d8d6d2`                         |
| silver-3 (text-2)  | `#b6b4b0`                         |
| silver-4 (text-3)  | `#88858a`                         |
| silver-5           | `#5b5860`                         |
| silver-6           | `#3a3740`                         |
| cream              | `#e8d9b8`                         |
| sepia              | `#b8956a`                         |
| sage (keep)        | `#98c486`                         |
| line-1             | `rgba(196,192,200,0.08)`          |
| line-2             | `rgba(196,192,200,0.14)`          |
| line-wine          | `rgba(168,45,68,0.4)`             |

### Typography

- **Display / serif**: `Cormorant Garamond`, weights 400 / 500 / 600 / 700,
  italic 400. Used for section titles, modal title, brand wordmark, and
  emphasized italic phrases (in cream).
- **UI sans**: `Inter`, weights 300 / 400 / 500 / 600 / 700. Used everywhere
  for body, labels, buttons.
- **Mono**: `JetBrains Mono`, weights 300 / 400 / 500. Used for HUD chips,
  metadata, key captions, status bar, eyebrow labels.

Common scales: section titles 22–26px, body 11–13px, mono micro 9–11px with
0.18–0.22em letter-spacing and uppercase transform.

### Spacing

Modal padding: 22 px header, 24/32 content, 22 footer. Card padding 18.
Field row padding: 14 vertical. Inspector section 14×16. Standard small gap
6 / 8; medium 14; large 22.

### Radius

Pills 12 px, modals 6 px, cards 4–5 px, controls 3 px, dock 8 px.

### Shadows

```css
--shadow-deep: 0 24px 64px -12px rgba(0,0,0,0.85), 0 8px 24px -8px rgba(0,0,0,0.6);
--shadow-inset: inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4);
--bevel: inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5),
         inset 1px 0 0 rgba(255,255,255,0.02), inset -1px 0 0 rgba(0,0,0,0.3);
```

Wine accent glow on focused inputs, primary buttons, active rail items, and
the mode pip: `0 0 12px rgba(168,45,68,0.3)`.

## Assets

- **Brand mark**: composed inline with three concentric radial-gradient circles
  (silver shell → silver lens → wine pupil). Reuse the existing `favicon.svg`
  in the source repo as the high-fidelity version — it's an aperture/lens
  motif that already fits this redesign (only the color story shifts; if a
  variant in burgundy is desired, retint the existing radial gradients).
- **Icons**: minimal stroke set (1.4 stroke, round caps/joins) defined inline
  in `icons.jsx`. Compatible with any standard icon library — Lucide is the
  closest match if you want to swap to a bundled package.
- **Decorative ornaments** (modal corners): `<DecoCorner/>` SVG, also inline.
- **Film-grain overlay**: SVG `feTurbulence` data-URI generated inline; safe
  to extract to a static SVG file.
- **No raster assets are required.** All textures are CSS gradients + SVG
  noise. The "loaded image" plate in the prototype is itself a layered
  gradient stand-in; in production the canvas displays the real PIL/decoded
  image with overlay layers (halation, grain, vignette) composed on top.

## Files

```
design_handoff_aperture_image_suite/
├── README.md                    ← this document
├── Aperture Image Suite.html    ← entry point, open in a browser to view
├── styles.css                   ← all design tokens + component CSS
├── icons.jsx                    ← inline SVG icon set
├── viewer.jsx                   ← TitleBar, Rail, Canvas, Inspector, StatusBar
├── settings-forms.jsx           ← form primitives + General/Controls/Film/Appearance panes
├── utilities.jsx                ← Utilities index + Video/Convert/Upscale/AIVideo sub-views
└── app.jsx                      ← SettingsModal shell + App root
```

To preview locally: serve the folder with any static file server (e.g.
`python -m http.server`) — opening the HTML directly works in most browsers.

## Original codebase reference

The existing source lives in the user's local `image sort/` folder
(`app.py`, `culler_settings.json`, `favicon.svg`, etc.). The redesign
preserves the existing config schema and migration logic — just extends it.
Study `ConfigManager` in `app.py` for the validation/migration patterns to
follow when adding the new fields.
