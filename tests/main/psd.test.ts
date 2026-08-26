import { describe, it, expect } from 'vitest'
import { writePsdBuffer } from 'ag-psd'
import { loadPsdAsSharp, to8BitBuffer } from '../../src/main/psd'

function makePsd(width: number, height: number, rgba: [number, number, number, number]): Buffer {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgba[0]
    data[i * 4 + 1] = rgba[1]
    data[i * 4 + 2] = rgba[2]
    data[i * 4 + 3] = rgba[3]
  }
  return writePsdBuffer({ width, height, imageData: { width, height, data } })
}

describe('loadPsdAsSharp', () => {
  it('decodes the flattened composite at the document dimensions', async () => {
    const image = await loadPsdAsSharp(makePsd(4, 3, [200, 50, 10, 255]))
    const meta = await image.metadata()
    expect(meta.width).toBe(4)
    expect(meta.height).toBe(3)
  })

  it('preserves composite pixel colour', async () => {
    const image = await loadPsdAsSharp(makePsd(2, 2, [10, 20, 30, 255]))
    const { data } = await image.raw().toBuffer({ resolveWithObject: true })
    expect(Array.from(data.slice(0, 4))).toEqual([10, 20, 30, 255])
  })
})

// ag-psd's writer only emits 8-bit PSDs, so 16/32-bit conversion is tested
// directly against synthetic typed arrays rather than a real file round trip.
describe('to8BitBuffer', () => {
  it('passes 8-bit data through unchanged', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255])
    expect(Array.from(to8BitBuffer(data))).toEqual([10, 20, 30, 255])
  })

  it('downscales 16-bit channels to 8-bit', () => {
    const data = new Uint16Array([0, 65535, 32768, 256])
    expect(Array.from(to8BitBuffer(data))).toEqual([0, 255, 128, 1])
  })

  it('scales 0..1 float channels to 8-bit', () => {
    const data = new Float32Array([0, 1, 0.5, 2])
    expect(Array.from(to8BitBuffer(data))).toEqual([0, 255, 128, 255])
  })
})
