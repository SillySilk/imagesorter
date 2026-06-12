# Aperture — Project Guide

## Directory Structure

Everything lives in **`C:\AI\Aperture`** — source code, build tooling, git repo, AND the runnable app. There is no separate deploy folder.

| Path | Purpose |
|------|---------|
| `src/` | Source code (edits happen here) |
| `out/` | electron-vite compile output |
| `dist/win-unpacked/` | The packaged, runnable app (`Aperture.exe`) |
| `Aperture.bat` | Root launcher — starts `dist\win-unpacked\Aperture.exe` |

The user runs `dist\win-unpacked\Aperture.exe` (via `Aperture.bat` or file associations). Windows file associations (HKCU, ProgId `ApertureImageSuite`) point at that exe, so the packaged path must not move. `register-associations.ps1` re-registers associations if needed; electron-builder copies it next to the exe.

## Tech Stack

- **Electron** + **React** + **TypeScript**
- **electron-vite** for bundling
- **electron-builder** for packaging

Key source paths:
- `src/renderer/src/components/` — UI components
- `src/renderer/src/styles/index.css` — all styles
- `src/renderer/src/context/AppContext.tsx` — global state
- `src/main/` — Electron main process

## Build & Ship Workflow

Use the `/ship-aperture` skill — it handles everything in order:

1. `electron-vite build` — compiles source to `out/`
2. Stops any running Aperture process
3. `electron-builder --dir` — packages to `dist/win-unpacked/` (this IS the app the user runs; no copy step)
4. Commits and pushes to GitHub

**Never deploy or copy the build anywhere else.** The old `C:\AI\Image Viewer App` deploy folder is retired (removed 2026-06-12).

## GitHub

Remote: `https://github.com/SillySilk/imagesorter.git`
Branch: `main`
