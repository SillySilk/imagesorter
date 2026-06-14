# Aperture — Project Guide

---
# ⚠️ ACTIVE HANDOFF — file-association fix not yet working (2026-06-13)

> Written from the Claude **Windows app**, which sandboxes shell commands. The user moved to the **CLI** (runs natively) to actually apply the fix. **First job: verify on the REAL machine, then apply.**

## Goal
Make **Aperture** the default handler for image files (PNG etc.) so double-click opens it and it shows in Windows "Open with" / Default Apps. It **worked before** when the association pointed at a real Electron exe deployed to `C:\AI\Image Viewer App` (now deleted); broke during single-folder consolidation.

## Probable root cause of "nothing I do changes anything": SANDBOX
From the Windows app, registry/file writes were verified as "success" by re-reading them, but the user's real Windows never reflected any of it (Open with still shows the deleted `C:\AI\Image Viewer App\Aperture.exe` as Default app + retired `Rapid_Image_Culler`; "Aperture" never appears by name; Settings → Default apps → search "Aperture" = not found). That = writes likely hitting a sandbox overlay, not the real hive.
**CAVEAT:** one read with the sandbox flag disabled *did* show the values present, so it's suspected-not-confirmed. **Verify reality first in the CLI:**
```powershell
Get-ItemProperty 'HKCU:\Software\RegisteredApplications' -Name Aperture
Test-Path 'HKCU:\Software\Aperture\Capabilities'
(Get-ItemProperty 'HKCU:\Software\Classes\ApertureImageSuite\shell\open\command').'(default)'
(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.png\UserChoice').ProgId
```
Then check Settings → Default apps → search "Aperture". If registry looks right but Aperture is missing there, (re)apply natively + restart explorer.

## Intended registry state (apply/verify natively; target real exe `C:\AI\Aperture\dist\win-unpacked\Aperture.exe`)
1. ProgId `Software\Classes\ApertureImageSuite`: `shell\open\command`=`"<real exe>" "%1"`, `DefaultIcon`=`<real exe>,0`.
2. `Software\Classes\Applications\Aperture.exe`: same command+icon, `FriendlyAppName`="Aperture", `SupportedTypes` = all exts.
3. `Software\Aperture\Capabilities`: `ApplicationName`="Aperture", `ApplicationDescription`, `ApplicationIcon`=`<real exe>,0`; subkey `FileAssociations` maps each ext → `ApertureImageSuite`.
4. `Software\RegisteredApplications\Aperture` = `Software\Aperture\Capabilities`.  ← **was missing the whole time; the registration that makes Windows treat Aperture as "an app." Most likely real fix.**
5. `.png` default: `FileExts\.png\UserChoice` ProgId = `ApertureImageSuite` (set via Settings UI once Aperture appears, or SetUserFTA hash — Win11 UCPD.sys reverts naive programmatic sets).
6. Exts: `.jpg .jpeg .png .gif .webp .tiff .tif .bmp .avif .heic .heif .mp4 .webm .mov .avi .mkv`
7. `SHChangeNotify(0x08000000,...)` + restart explorer after.

## Findings (don't relearn the hard way)
- **Associate with the real exe, NOT the root stub** `C:\AI\Aperture\Aperture.exe` (stub spawns+exits instantly → Windows rejects it as a handler → "kicks back"). Stub = manual starter only.
- Build was **self-signed with an untrusted cert** (`electron-builder.yml` `signtoolOptions`, `CN=PanPDX`); working version was unsigned. Current dist exe's sig was **stripped** (now NotSigned). **Remove `signtoolOptions` from `electron-builder.yml`** so rebuilds stay unsigned.
- **Win11 UCPD.sys** (active) reverts programmatic default-app changes for most types; only `.png/.jpg/.gif` (previously user-set) persisted. Use Settings UI or SetUserFTA for the rest.
- Old `C:\AI\Image Viewer App` deleted. Retired Python prototype `Rapid_Image_Culler` (`C:\AI\image sort`) deleted.
- Stale old-path refs were cleaned from usage caches (`FeatureUsage`, `UserAssist` (ROT13), 4 jumplists, `ComDlg32\OpenSavePidlMRU`, `MuiCache`) — NOT in any association key. May need re-cleaning natively if those edits were sandboxed too.

## Also wanted (feature)
- **No easy "Open File" / "Open Folder" button in the app's front UI** — add to `src/renderer`. Check `src/main/index.ts` for existing `dialog.showOpenDialog` IPC. A dependable way in regardless of OS associations.

## Tooling / housekeeping
- ProcMon at `C:\AI\Aperture\_diag\` (+ `capture.ps1`, root `run-assoc-capture.bat`) for tracing the picker — never completed; delete `_diag\` + the bat when done.
- `register-associations.ps1` does ProgId + Applications + SupportedTypes but **not** Capabilities/RegisteredApplications — extend it (steps 3–4).

## DO NOT
- **Do not commit until associations actually work on the real machine** (user's instruction). ~5 local commits on `main` + uncommitted working changes; nothing pushed.
- Don't point associations at the root stub. Don't re-add self-signing.
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
