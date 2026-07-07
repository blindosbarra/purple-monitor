// Generates the PWA icons (purple background with purpura-like dots)
// without any image-library dependency: raw RGBA -> zlib -> PNG chunks.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public')

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

const BG = [76, 29, 149] // deep violet
const DOTS = [
  { x: 0.34, y: 0.36, r: 0.1, c: [216, 180, 254] },
  { x: 0.62, y: 0.3, r: 0.055, c: [192, 132, 252] },
  { x: 0.56, y: 0.56, r: 0.075, c: [233, 213, 255] },
  { x: 0.34, y: 0.66, r: 0.05, c: [192, 132, 252] },
  { x: 0.68, y: 0.72, r: 0.09, c: [216, 180, 254] },
  { x: 0.5, y: 0.82, r: 0.04, c: [233, 213, 255] }
]

function makePng(size) {
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let [r, g, b] = BG
      for (const d of DOTS) {
        const dx = x / size - d.x
        const dy = y / size - d.y
        if (dx * dx + dy * dy <= d.r * d.r) {
          ;[r, g, b] = d.c
          break
        }
      }
      const i = (y * size + x) * 4
      px[i] = r
      px[i + 1] = g
      px[i + 2] = b
      px[i + 3] = 255
    }
  }
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `pwa-${size}.png`), makePng(size))
  console.log(`wrote public/pwa-${size}.png`)
}
