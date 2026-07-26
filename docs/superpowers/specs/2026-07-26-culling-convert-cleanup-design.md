# Aperture — Culling Workflow, File Conversion, and Dead-Feature Removal

**Date:** 2026-07-26
**Status:** Approved

## Summary

Three bodies of work in one pass:

1. **Culling workflow** — a physical `Delete` key that always deletes and advances in both modes, single-level undo, working session counters, and a fix for the thumbnail grid re-scanning the whole folder on every action.
2. **File Conversion** — turn the placeholder utility tile into a working single-file and batch image converter.
3. **Dead-feature removal** — strip Filmography, the inert rail tabs, and AI Video Atelier, none of which do anything.

## Motivation

Two live bugs make the culling loop worse the faster you work, and the new `Delete` key would amplify both. Meanwhile three areas of the UI advertise behavior that does not exist, which conflicts with the project's standing "no placeholders or dummy data" rule.

---

## Stage 1 — Culling Workflow

### 1.1 Delete key

**Behavior.** Pressing `Delete` moves the on-screen file to an app-managed trash and advances to the next image. No confirmation. Works in sort mode and view mode.

**Placement.** Hard-wired in `useActionRouter`'s `onKeyDown`, above the `key_mappings` lookup — the same tier as `Ctrl+O` and `F5`. A `key_mappings` entry would be mode-scoped and deletable from the Controls tab, so "always" would not hold.

**Ordering within `onKeyDown` matters:**

1. Existing `Ctrl+,` / `Ctrl+O` / `F5` handlers
2. Existing `INPUT` / `TEXTAREA` guard
3. **New:** bail out if `settingsOpen` is true
4. **New:** `Delete` and `Ctrl+Z` handlers
5. Existing `key_mappings` lookup

Steps 3 and 4 must sit after the input guard, or `Delete` while typing in a settings field would destroy the image behind the modal.

**Disposal.** Files move to `%APPDATA%\aperture\trash\`, not the Windows Recycle Bin. The Recycle Bin has no practical programmatic restore from Electron, and undo is a requirement.

- Trade-off accepted: when the library is on a different volume from `C:`, the move is a copy-plus-delete rather than an instant rename. Negligible for stills, a beat for large video.
- The trash is never emptied automatically. Preferences → General gets an **Empty Trash** control showing item count and total size.

**Unchanged.** The right-click *"Delete Permanently"* item and the bindable `delete` action keep their `fs.unlinkSync` + confirm behavior. Each is plainly labeled: the menu says permanent, the key is recoverable.

### 1.2 Undo

`Ctrl+Z`, single level, hard-wired alongside `Delete`. Restores the last keep, reject, or delete to its original path and re-inserts it at its original index, which becomes the current index.

**Why a dedicated `file:restore` IPC** rather than reusing `file:move`: `resolveConflict` may have renamed the file to `foo_1.jpg` on the way out, and `moveFile` takes a destination *directory*, so it cannot put `foo_1.jpg` back as `foo.jpg`. Restore needs an exact destination path.

**Edge cases:**

- If something now occupies the original path, restore conflict-resolves and re-inserts under the actual restored path. The in-memory `FileInfo` is patched to match before insertion — otherwise state would hold a path that does not exist.
- Undo is cleared on folder load. One level only: a second `Ctrl+Z` does nothing.

### 1.3 Session counters

`StatusBar.tsx:10` counts `state.dispositions`, but keep and reject stopped writing dispositions when they moved to `REMOVE_FILE`, and `REMOVE_FILE` deletes the entry outright (`AppContext.tsx:104`). The counters have read zero since commit `776514e`.

Add `sessionStats: { kept, rejected, deleted }` to `AppState`. Incremented by the action, decremented by undo, reset on folder load. `StatusBar` reads it instead of `dispositions`.

### 1.4 Thumbnail grid

Two defects, and they must be fixed together.

**Defect A — full re-scan on every action.** `Inspector.tsx:43` keys its loader on `[files]`, and `REMOVE_FILE` returns a new array. Every keep, reject, or delete clears `thumbMap` and re-decodes the folder from index 0. On a 3,000-image folder that is 3,000 IPC calls and sharp decodes per keystroke.

**Defect B — the map is keyed by index.** `thumbMap` is `Map<number, string>`. Removing the file at index 5 shifts every later file, so each one displays its former neighbor's thumbnail. Today the unconditional reset masks this. **Fixing A alone would expose B as visibly wrong thumbnails**, so both change at once.

**Fix.** Re-key to `Map<string, string>` by `full_path`. Load only paths missing from the map instead of resetting. Prune entries whose path has left `files` so memory stays bounded. Add `filesToken: number` to `AppState`, incremented by `SET_FILES`, as the explicit signal for a genuine folder change requiring a full reset.

**Out of scope:** the first load of a folder still decodes every image, with no viewport awareness. Pre-existing; this work only stops it recurring.

### 1.5 Shared action layer

`Canvas.tsx:297-325` duplicates keep, reject, and delete logic that already exists in `useActionRouter.ts:45-73`, because the native context menu routes through `canvas:action`. Two copies means counters and undo would have to be added twice and could drift.

Extract a `useFileActions()` hook owning keep, reject, delete, trash, and undo. `useActionRouter` and `Canvas` both call it. This is a precondition for 1.1–1.3, not optional cleanup.

---

## Stage 2 — File Conversion

### 2.1 Main process

New `convert:process` handler in `src/main/index.ts`, modeled on `upscale:process`.

```
{ filePath, format, quality, resize, stripMetadata, destDir, mirrorFrom? }
  format: 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'
  resize: { mode: 'none' } | { mode: 'long', px } | { mode: 'pct', pct }
→ { ok, outputPath?, bytes?, error? }
```

- Source is read with `readFile` and handed to sharp as a **buffer**, matching `imageInfo.ts`. `sharp(path)` holds the file open while libvips works, which breaks an app whose whole job is moving and deleting those files.
- `.rotate()` always, baking EXIF orientation into pixels. Without it, stripping metadata silently rotates images.
- Long-edge resize uses `fit: 'inside'` with `withoutEnlargement: true`; percentage resize computes from source metadata.
- `stripMetadata: false` calls `.withMetadata()` — sharp strips by default, so the flag reads inverted in the pipeline.
- Output goes to `destDir` or the source directory, through `resolveConflict`. **The source file is never overwritten**, including when the target format matches the source.

### 2.2 Renderer

New `ConvertStudio.tsx` beside `UpscaleStudio.tsx`, reusing its card / seg / select / btn structure.

- Format: JPEG · PNG · WebP · AVIF · TIFF
- Quality: shown for JPEG/WebP/AVIF/TIFF, hidden for PNG, which is lossless and takes `compressionLevel`
- Resize: None / Long edge (px) / Percentage
- Strip metadata toggle
- Save To: source folder or a picked directory
- **Batch:** "Convert all N loaded files" with `12 / 340` progress and Cancel

The batch loop lives in the renderer and calls the single-file handler per file. Progress and cancellation come free with no new IPC events or main-process job state. Per-file failures are collected and reported at the end rather than aborting the run. Mirror-folder-structure applies only when a custom output directory is set.

---

## Stage 3 — Dead-Feature Removal

### Filmography — display-only, no effect on any pixel

| Item | Action |
|---|---|
| `utils/filmFilters.ts` | Delete — imported by zero files |
| `preferences/tabs/FilmographyTab.tsx` | Delete |
| `PreferencesModal.tsx:7,18,120` | Remove import, tab entry, render branch |
| `Inspector.tsx:194-211` | Remove "Active Filter" section, including its hardcoded stripe-gradient swatch |
| `config.ts` `filmography` block | Remove from interface and defaults; migration strips the saved key |

### Inert rail tabs

`App.tsx:24` only swaps the panel on `utils`. Browser, Film & Filters, and History all render the same Inspector — they highlight on click and change nothing.

- `Rail.tsx` — remove `browse`, `film`, `history`
- `AppContext.tsx:25` — narrow `railTab` to `'sort' | 'utils'`
- `Icons.tsx` — remove `IcGrid`, `IcFilm`, `IcHistory` once unreferenced

### AI Video Atelier

Tile, `PlannedPane` route, and `utilities.aivideo` config block removed. `PlannedPane` and `PlannedSubview` are deleted once nothing routes to them, along with `IcWand`.

### Preferences → Utilities tab

Its tiles click through to `PlannedSubview` placeholders for Convert and Upscale, even though Upscale ships today. Reduced to a read-only overview with no dead click-throughs. The Cinema subview stays; `cinema.auto_switch` is genuinely honored at `Canvas.tsx:36`.

### Config migration

Schema bumps to **9**, removing `filmography`, `utilities.aivideo`, and `utilities.convert.color_space`. `deepMerge` preserves unknown keys, so removal must be explicit or the dead fields survive in every saved config.

---

## Testing

The repo has no test harness and none is added here. Verification is `electron-vite build` plus a manual pass in the running app:

- `Delete` deletes and advances in both modes; at the end of the list the index clamps to the last remaining file
- `Delete` inside a Preferences text field types normally and destroys nothing
- `Ctrl+Z` restores the file to its original path and index after each of keep, reject, and delete
- Status bar counters track actions and undo
- Culling a large folder does not blank or reload the thumbnail grid, and thumbnails stay matched to their files
- Convert produces correct output for each format, single and batch, and never overwrites a source
- App builds and runs with no console errors after the removals

## Risks

- **Trash growth.** Nothing is deleted automatically. Mitigated by the Empty Trash control surfacing count and size.
- **Cross-volume trash moves.** Copy-plus-delete on a large video is perceptible. Accepted; `moveFile`'s existing EPERM retry loop is reused.
- **File handles.** `sharp.cache(false)` is already set (`main/index.ts:197`), but conversion output landing in a scanned folder can race the scanner. Buffer-based reads avoid holding source handles.

## Out of Scope

- Multi-level undo — single level only
- Viewport-aware thumbnail loading
- Rebuilding Filmography or the removed rail tabs as working features
- Anything touching Windows file associations (see the handoff block in `CLAUDE.md`)
