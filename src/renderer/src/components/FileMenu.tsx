import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useLoadFile } from '../hooks/useLoadFile'
import { useLoadFolder } from '../hooks/useLoadFolder'
import { IcFile, IcFolder, IcDownload, IcCopy, IcPrint, IcReveal } from './Icons'

export default function FileMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { state } = useApp()
  const { loadFile } = useLoadFile()
  const { loadFolder } = useLoadFolder()

  const currentFile = state.files.length > 0 ? state.files[state.currentIndex] : null
  const hasFile = currentFile !== null
  const isImage = hasFile && currentFile!.type === 'image'

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const run = (fn: () => void) => { setOpen(false); fn() }

  const handleSaveAs = async () => {
    if (!currentFile) return
    await window.api.dialog.saveAs({ filePath: currentFile.full_path })
  }

  const handlePrint = async () => {
    if (!currentFile) return
    await window.api.window.print({ filePath: currentFile.full_path })
  }

  const handleCopy = async () => {
    if (!currentFile) return
    await window.api.image.copyToClipboard({ filePath: currentFile.full_path })
  }

  const handleReveal = () => {
    if (!currentFile) return
    window.api.shell.showInExplorer({ filePath: currentFile.full_path })
  }

  return (
    <div className="file-menu" ref={ref}>
      <button
        className={`file-menu-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        File <span className="file-menu-arrow">▾</span>
      </button>

      {open && (
        <div className="file-menu-dropdown">
          <button className="fmi" onClick={() => run(loadFile)}>
            <IcFile width={13} height={13} /> Open File
          </button>
          <button className="fmi" onClick={() => run(() => loadFolder())}>
            <IcFolder width={13} height={13} /> Open Folder
          </button>

          <div className="fmi-sep" />

          <button className="fmi" disabled={!hasFile} onClick={() => run(handleSaveAs)}>
            <IcDownload width={13} height={13} /> Save As…
          </button>

          <div className="fmi-sep" />

          <button className="fmi" disabled={!isImage} onClick={() => run(handlePrint)}>
            <IcPrint width={13} height={13} /> Print…
          </button>
          <button className="fmi" disabled={!hasFile} onClick={() => run(handleCopy)}>
            <IcCopy width={13} height={13} /> Copy to Clipboard
          </button>
          <button className="fmi" disabled={!hasFile} onClick={() => run(handleReveal)}>
            <IcReveal width={13} height={13} /> Show in Explorer
          </button>
        </div>
      )}
    </div>
  )
}
