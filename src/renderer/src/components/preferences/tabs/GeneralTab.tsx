import React from 'react'
import { Field, Toggle, Seg } from '../forms/Field'
import type { Config } from '../../../../../main/config'

const FILE_TYPE_OPTIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'bmp', 'heic', 'raw', 'cr2', 'nef', 'arw', 'dng']

interface Props {
  draft: Config
  onChange: (updated: Partial<Config>) => void
}

export default function GeneralTab({ draft, onChange }: Props) {
  const browseSrc = async () => {
    const path = await window.api.dialog.openFolder()
    if (path) onChange({ src: path })
  }
  const browseKeep = async () => {
    const path = await window.api.dialog.openFolder()
    if (path) onChange({ keep: path })
  }
  const browseReject = async () => {
    const path = await window.api.dialog.openFolder()
    if (path) onChange({ reject: path })
  }

  const toggleFileType = (ext: string) => {
    const current = draft.options.file_types || []
    const next = current.includes(ext) ? current.filter(e => e !== ext) : [...current, ext]
    onChange({ options: { ...draft.options, file_types: next } })
  }

  return (
    <div>
      <div className="section-title">General <em>settings</em></div>
      <div className="section-sub">Library · Source & destination paths</div>

      <Field label="Source Folder" desc="Folder to scan for images">
        <div className="input-with-btn">
          <input className="input" value={draft.src} onChange={e => onChange({ src: e.target.value })} placeholder="/path/to/source" />
          <button className="btn" onClick={browseSrc}>Browse</button>
        </div>
      </Field>

      <Field label="Keep Folder" desc="Where kept images are moved">
        <div className="input-with-btn">
          <input className="input" value={draft.keep} onChange={e => onChange({ keep: e.target.value })} placeholder="/path/to/keep" />
          <button className="btn" onClick={browseKeep}>Browse</button>
        </div>
      </Field>

      <Field label="Reject Folder" desc="Where rejected images go (empty = delete)">
        <div className="input-with-btn">
          <input className="input" value={draft.reject || ''} onChange={e => onChange({ reject: e.target.value })} placeholder="empty = files are deleted" />
          <button className="btn" onClick={browseReject}>Browse</button>
        </div>
      </Field>

      <Field label="Default App Mode">
        <Seg
          options={[{ value: 'sort', label: 'Sort' }, { value: 'view', label: 'View' }, { value: 'last', label: 'Last Used' }]}
          value={draft.app_mode}
          onChange={v => onChange({ app_mode: v as Config['app_mode'] })}
        />
      </Field>

      <Field label="Recursive Loading" desc="Include subfolders when scanning">
        <Toggle value={draft.options.recursive_loading} onChange={v => onChange({ options: { ...draft.options, recursive_loading: v } })} />
      </Field>

      <Field label="File Types" desc="Extensions to include when scanning">
        <div className="chipset">
          {FILE_TYPE_OPTIONS.map(ext => (
            <span
              key={ext}
              className={`chip-tag${draft.options.file_types?.includes(ext) ? ' on' : ''}`}
              onClick={() => toggleFileType(ext)}
            >
              {ext}
            </span>
          ))}
        </div>
      </Field>

      <Field label="Auto-advance" desc="Go to next image after keep or reject">
        <Toggle value={draft.options.auto_advance} onChange={v => onChange({ options: { ...draft.options, auto_advance: v } })} />
      </Field>

      <Field label="Confirm Before Delete" desc="Show dialog when no reject folder is set">
        <Toggle value={draft.options.confirm_delete} onChange={v => onChange({ options: { ...draft.options, confirm_delete: v } })} />
      </Field>
    </div>
  )
}
