# Aperture — Project Guide

---

## File Associations — resolved (2026-07-26)

The default-app registration silently failed because it was being applied from the sandboxed Claude Windows app, whose registry writes never reached the real hive; running the same fix natively from the CLI resolved it. `register-associations.ps1` now correctly registers Aperture end-to-end (ProgId, Applications, SupportedTypes, Capabilities, RegisteredApplications) against the real exe. Full debugging history is in git log if ever needed.
---

## Directory Structure

Everything lives in **`C:\AI\Aperture`** — source code, build tooling, git repo, AND the runnable app. There is no separate deploy folder.

| Path | Purpose |
|------|---------|
| `src/` | Source code (edits happen here) |
| `out/` | electron-vite compile output |
| `dist/win-unpacked/` | The packaged Electron app (the REAL `Aperture.exe` plus its DLLs/resources) |
| `Aperture.exe` (root) | Launcher stub — forwards to `dist\win-unpacked\Aperture.exe`. Built from `launcher.cs` with the .NET Framework `csc.exe` (rebuild command in that file's header) |

The user launches the root `Aperture.exe`. The Electron exe cannot live in the root because it needs its DLLs, `.pak` files, and `resources\` beside it.

**File associations MUST point at the real Electron exe `dist\win-unpacked\Aperture.exe` — never the root stub.** The root `Aperture.exe` spawns the real app and exits immediately; Windows' "Open with" rejects an instantly-exiting process as a file handler (it bounces back to the picker and won't set it as default). Only the persistent real exe works as a handler. HKCU ProgId `ApertureImageSuite` → `shell\open\command` points at `dist\win-unpacked\Aperture.exe`, so that packaged path must not move. The root stub is only for manually double-clicking to start the app. `register-associations.ps1` handles this (it auto-targets the real exe).

> Regression history: consolidating to a single folder once repointed associations at the root stub, which silently broke "Open with" (it would not associate / kept bouncing to the picker). Fixed by repointing to the real exe. If association breaks again, check the ProgId command target first.

## Tech Stack

- **Electron** + **React** + **TypeScript**
- **electron-vite** for bundling
- **electron-builder** for packaging

Key source paths:
- `src/renderer/src/components/` — UI components
- `src/renderer/src/styles/index.css` — all styles
- `src/renderer/src/context/AppContext.tsx` — global state
- `src/main/` — Electron main process
- `tests/` — Vitest suite (see Testing below)

## Destructive Actions & Undo

All file actions have exactly one implementation: **`src/renderer/src/hooks/useFileActions.ts`**. Both entry points use it — `useActionRouter` (keyboard/mouse/wheel) and `Canvas` (the native right-click menu, which arrives over IPC). Don't add a second copy; session counters and undo would drift.

| Input | Action | Reversible |
|---|---|---|
| `Delete` key | Moves to Aperture's trash, advances. No prompt. Works in **both** modes. | Yes — `Ctrl+Z` |
| `Ctrl+Z` | Restores the last keep/reject/delete to its original path *and index*. Single level. | — |
| Right-click → *Delete Permanently* | `fs.unlink`. Honors the Confirm-before-delete setting. | **No** |

- **`Delete` and `Ctrl+Z` are hard-wired** in `useActionRouter`'s `onKeyDown`, above the `key_mappings` lookup. A mapping would be mode-scoped and deletable from the Controls tab, so "always works" wouldn't hold. They sit *after* the INPUT/TEXTAREA and `settingsOpen` guards — moving them earlier would let `Delete` destroy the image behind an open Preferences modal.
- **Trash** is `%APPDATA%\aperture\trash\` with a JSON manifest (`src/main/trash.ts`), **not** the Recycle Bin — the Recycle Bin has no practical programmatic restore from Electron. Never emptied automatically; Preferences → General has the control.
- Undo uses `file:moveTo` (exact destination path), not `file:move` (destination *directory*), because `resolveConflict` may have renamed the file to `foo_1.jpg` on the way out.

## Thumbnail Grid — Two Traps

`Inspector.tsx`'s thumbnail cache is keyed by **`full_path`, never by index**, and resets only on **`filesToken`** (bumped by `SET_FILES` alone).

Both rules exist because of real bugs. Index keys shift every later thumbnail onto its neighbour's image the moment a file is culled. And keying the reset on the `files` array means every keep/reject/delete — which returns a new array — re-decodes the entire folder. If you touch this loader, keep the ref and the state cleared together; clearing only the state blanks the grid permanently on F5.

## Testing

**Vitest.** `npm test` (single run) or `npm run test:watch`. Config in `vitest.config.ts`.

| File | Covers |
|---|---|
| `tests/main/config.test.ts` | Schema-9 migration, `validate` |
| `tests/main/fileOps.test.ts` | `resolveConflict` / `movePath` / `moveFile`, against real temp dirs |
| `tests/main/trash.test.ts` | Trash → restore round trip, Electron `app` mocked |
| `tests/renderer/reducer.test.ts` | Undo, session counters, `REMOVE_FILE` advance semantics |
| `tests/renderer/useFileActions.test.tsx` | The real hook in a real provider, `window.api` mocked |

Node is the default environment; renderer files opt into a DOM with a `// @vitest-environment jsdom` docblock on line 1.

Main-process modules import `app` from `electron`, which doesn't resolve outside Electron — mock it (`vi.mock('electron', …)`) **before** the dynamic `await import(...)` of the module under test.

`migrate`, `validate`, `reducer` and `initialState` are exported *for tests*. They aren't part of any runtime API; don't route app code through them.

Most tests here are regression guards for specific bugs, and the comments say which. Before trusting a change in these areas, reintroduce the bug and confirm the test actually fails — a guard that can't fail is worse than none. **Commit before doing that**: reverting a mutation with `git checkout --` also throws away any uncommitted work in the same file.

## Build & Ship Workflow

Use the `/ship-aperture` skill — it handles everything in order:

1. `npm test` — the suite must pass before anything is packaged
2. `electron-vite build` — compiles source to `out/`
3. Stops any running Aperture process
4. `electron-builder --dir` — packages to `dist/win-unpacked/` (this IS the app the user runs; no copy step)
5. Commits and pushes to GitHub

**Never deploy or copy the build anywhere else.** The old `C:\AI\Image Viewer App` deploy folder is retired (removed 2026-06-12).

## GitHub

Remote: `https://github.com/SillySilk/imagesorter.git`
Branch: `main`
