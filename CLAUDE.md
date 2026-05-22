# Aperture — Project Guide

## Directory Structure

| Path | Purpose |
|------|---------|
| `C:\AI\Aperture` | Source code, build tooling, git repo |
| `C:\AI\Image Viewer App` | Final distributed app (what the user actually runs) |

These are **two separate directories**. Edits happen in `C:\AI\Aperture\src`. The built output must be explicitly deployed to `C:\AI\Image Viewer App` before changes are visible in the running app.

## Tech Stack

- **Electron** + **React** + **TypeScript**
- **electron-vite** for bundling
- **electron-builder** for packaging

Key source paths:
- `src/renderer/src/components/` — UI components
- `src/renderer/src/styles/index.css` — all styles
- `src/renderer/src/context/AppContext.tsx` — global state
- `src/main/` — Electron main process

## Build & Deploy Workflow

Use the `/ship-aperture` skill — it handles everything in order:

1. `electron-vite build` — compiles source to `out/`
2. `electron-builder --dir` — packages to `dist/win-unpacked/`
3. Stops any running Aperture process
4. `robocopy` deploys `dist/win-unpacked/` → `C:\AI\Image Viewer App`
5. Commits and pushes to GitHub

**Never manually copy files.** Always go through the skill to keep the deploy consistent.

## GitHub

Remote: `https://github.com/SillySilk/imagesorter.git`  
Branch: `main`
