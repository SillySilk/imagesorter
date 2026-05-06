export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function formatDate(iso: string): string {
  return iso.replace(/-/g, '·')
}

export function formatKey(key: string): string {
  const map: Record<string, string> = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Space: 'SPC', Enter: '↵', Escape: 'ESC', Tab: '⇥',
    Backspace: '⌫', Delete: 'DEL', Control: 'CTRL', Shift: '⇧',
    Alt: 'ALT', Meta: '⌘'
  }
  return map[key] || key.toUpperCase()
}
