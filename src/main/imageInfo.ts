import fs from 'fs'
import path from 'path'

export interface ImageMetadata {
  width: number
  height: number
  format: string
  size: number
  created: string
  color_space?: string
}

// Hand sharp the file's bytes (read once, handle closed immediately) rather
// than a path. sharp(path) keeps the source file open while libvips processes
// it, which on Windows blocks moving/deleting the displayed image — a
// cross-volume "keep" then fails at unlink with EPERM. Operating on a Buffer
// means the only file handle is this quick read, so the original is never
// locked.
async function loadSharp(filePath: string): Promise<import('sharp').Sharp> {
  const sharp = (await import('sharp')).default
  const buf = await fs.promises.readFile(filePath)
  return sharp(buf)
}

export async function getImageMetadata(filePath: string): Promise<ImageMetadata> {
  const stat = fs.statSync(filePath)
  const created = stat.birthtime.toISOString().split('T')[0]
  const size = stat.size

  try {
    const meta = await (await loadSharp(filePath)).metadata()
    return {
      width: meta.width || 0,
      height: meta.height || 0,
      format: (meta.format || path.extname(filePath).replace('.', '')).toUpperCase(),
      color_space: meta.space || 'sRGB',
      size,
      created
    }
  } catch {
    return {
      width: 0,
      height: 0,
      format: path.extname(filePath).replace('.', '').toUpperCase(),
      size,
      created
    }
  }
}

export async function getThumbnail(filePath: string, width: number, height: number): Promise<string> {
  try {
    const buf = await (await loadSharp(filePath))
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
    return buf.toString('base64')
  } catch {
    return ''
  }
}

export async function getHistogram(filePath: string): Promise<number[]> {
  try {
    const { data } = await (await loadSharp(filePath)).greyscale().raw().toBuffer({ resolveWithObject: true })
    const counts = new Array(256).fill(0)
    for (let i = 0; i < data.length; i++) counts[data[i]]++
    return counts
  } catch {
    return new Array(256).fill(0)
  }
}
