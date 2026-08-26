export const PSD_EXTS = new Set(['.psd', '.psb'])

let canvasPolyfillReady = false

// ag-psd allocates its internal pixel buffers through a `createImageData`
// hook even when `useImageData` is set, and by default that hook requires
// node-canvas (a native dependency) — see ag-psd/dist/helpers.js. We only
// ever read the flattened composite as raw bytes, so a plain object is a
// sufficient stand-in and keeps this dependency pure-JS. `createCanvas`
// itself is unreachable on this path (layer/thumbnail decoding, which
// really does need a canvas, is always skipped below) and throws loudly if
// that assumption ever breaks.
function ensureCanvasPolyfill(agPsd: typeof import('ag-psd')): void {
  if (canvasPolyfillReady) return
  const initializeCanvas = agPsd.initializeCanvas as (createCanvas: unknown, createImageData: unknown) => void
  initializeCanvas(
    () => { throw new Error('ag-psd tried to create a canvas — composite-only decode assumption broke') },
    (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) })
  )
  canvasPolyfillReady = true
}

// PSD/PSB have no decoder in sharp/libvips. ag-psd parses the file's
// flattened composite — the same merged preview Photoshop itself shows —
// as raw pixels, which we hand to sharp like any other raw buffer. Layers
// are never touched: this is view-only, not a Photoshop replacement.
export async function loadPsdAsSharp(buf: Buffer): Promise<import('sharp').Sharp> {
  const sharp = (await import('sharp')).default
  const agPsd = await import('ag-psd')
  ensureCanvasPolyfill(agPsd)

  const psd = agPsd.readPsd(buf, { skipLayerImageData: true, skipThumbnail: true, useImageData: true })
  const composite = psd.imageData
  if (!composite) throw new Error('PSD has no composite image data')

  return sharp(to8BitBuffer(composite.data), {
    raw: { width: composite.width, height: composite.height, channels: 4 }
  })
}

// ag-psd preserves the file's own bit depth (8/16/32-bit) in the composite;
// sharp's raw input needs a flat 8-bit-per-channel buffer. Exported for
// tests — ag-psd's writer only supports 8-bit output, so 16/32-bit inputs
// can't be exercised through a real PSD round trip.
export function to8BitBuffer(data: import('ag-psd').PixelArray): Buffer {
  if (data instanceof Uint16Array) {
    const out = Buffer.allocUnsafe(data.length)
    for (let i = 0; i < data.length; i++) out[i] = data[i] >> 8
    return out
  }
  if (data instanceof Float32Array) {
    const out = Buffer.allocUnsafe(data.length)
    for (let i = 0; i < data.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(data[i] * 255)))
    return out
  }
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
}
