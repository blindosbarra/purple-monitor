// On-device purpura spot detection. Runs entirely in the phone's browser.
//
// v2 pipeline, built for real photos (shadows, background, hair):
//  1. Skin gate: pixels are classified as skin via the classic YCbCr range;
//     statistics and candidates are only accepted in/around skin.
//  2. Local contrast: a spot must be markedly green-poor and darker than its
//     *local neighborhood* (integral-image box means), not the global image —
//     this ignores lighting gradients and large shadows.
//  3. Blob filters: size range, compactness (excludes hairs/creases), and a
//     "ring test" — the area immediately around a spot must be mostly skin,
//     which rejects blobs belonging to background objects.
//  4. Manual corrections: spots can be added/removed by the parent; manual
//     spots are flagged and drawn in a different color.

export interface Spot {
  x: number // centroid, px in analysis space
  y: number
  area: number // px²
  d: number // equivalent diameter, px
  manual?: boolean
}

export interface Analysis {
  version: 2
  w: number
  h: number
  spots: Spot[]
  affectedPct: number // % of the image covered by detected spots
}

export type SizeClass = 'small' | 'medium' | 'large'
export type Sensitivity = 'low' | 'normal' | 'high'

// Local green-fraction deficit required to call a pixel a spot candidate.
export const SENSITIVITY_DELTA: Record<Sensitivity, number> = {
  low: 0.055,
  normal: 0.038,
  high: 0.026
}

const MAX_SIDE = 900

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Summed-area table for O(1) box sums.
function integralOf(src: ArrayLike<number>, w: number, h: number): Float64Array {
  const int = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x]
      int[(y + 1) * (w + 1) + (x + 1)] = int[y * (w + 1) + (x + 1)] + rowSum
    }
  }
  return int
}

function boxSum(
  int: Float64Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { sum: number; count: number } {
  x0 = Math.max(0, x0)
  y0 = Math.max(0, y0)
  x1 = Math.min(w - 1, x1)
  y1 = Math.min(h - 1, y1)
  if (x1 < x0 || y1 < y0) return { sum: 0, count: 0 }
  const s =
    int[(y1 + 1) * (w + 1) + (x1 + 1)] -
    int[y0 * (w + 1) + (x1 + 1)] -
    int[(y1 + 1) * (w + 1) + x0] +
    int[y0 * (w + 1) + x0]
  return { sum: s, count: (x1 - x0 + 1) * (y1 - y0 + 1) }
}

export function analyzeImageData(img: ImageData, delta = SENSITIVITY_DELTA.normal): Analysis {
  const { data, width: w, height: h } = img
  const n = w * h

  const gfrac = new Float32Array(n)
  const lum = new Float32Array(n)
  const skin = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gfrac[i] = g / (r + g + b + 1)
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b
    // classic YCbCr skin gate — broad across skin tones
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 177) skin[i] = 1
  }

  const intG = integralOf(gfrac, w, h)
  const intL = integralOf(lum, w, h)
  const intS = integralOf(skin, w, h)
  const R = Math.max(10, Math.round(Math.min(w, h) / 10))

  // Candidate mask: local anomaly on/near skin.
  const mask = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      if (r <= g + 8) continue // gray/green: shadows, hair, background
      const sBox = boxSum(intS, w, h, x - R, y - R, x + R, y + R)
      if (sBox.sum / sBox.count < 0.3) continue // not in a skin area
      const gBox = boxSum(intG, w, h, x - R, y - R, x + R, y + R)
      if (gfrac[i] >= gBox.sum / gBox.count - delta) continue // not locally red-violet
      const lBox = boxSum(intL, w, h, x - R, y - R, x + R, y + R)
      if (lum[i] >= lBox.sum / lBox.count - 5) continue // not locally darker
      mask[i] = 1
    }
  }

  // Connected components (4-connectivity, iterative flood fill)
  const minArea = Math.max(6, Math.round(n * 0.00002))
  const maxArea = Math.round(n * 0.012)
  const visited = new Uint8Array(n)
  const stack = new Int32Array(n)
  const spots: Spot[] = []
  let affected = 0

  for (let start = 0; start < n; start++) {
    if (!mask[start] || visited[start]) continue
    let top = 0
    stack[top++] = start
    visited[start] = 1
    let area = 0
    let sx = 0
    let sy = 0
    let minX = w
    let maxX = 0
    let minY = h
    let maxY = 0
    while (top > 0) {
      const p = stack[--top]
      const px = p % w
      const py = (p / w) | 0
      area++
      sx += px
      sy += py
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
      if (px > 0 && mask[p - 1] && !visited[p - 1]) {
        visited[p - 1] = 1
        stack[top++] = p - 1
      }
      if (px < w - 1 && mask[p + 1] && !visited[p + 1]) {
        visited[p + 1] = 1
        stack[top++] = p + 1
      }
      if (py > 0 && mask[p - w] && !visited[p - w]) {
        visited[p - w] = 1
        stack[top++] = p - w
      }
      if (py < h - 1 && mask[p + w] && !visited[p + w]) {
        visited[p + w] = 1
        stack[top++] = p + w
      }
    }
    if (area < minArea || area > maxArea) continue
    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    if (area / (bw * bh) < 0.3) continue // too stringy: hair, crease, edge
    // Ring test: the surroundings of a real skin spot are skin.
    const m = Math.max(4, Math.round((bw + bh) / 4))
    const outer = boxSum(intS, w, h, minX - m, minY - m, maxX + m, maxY + m)
    const inner = boxSum(intS, w, h, minX, minY, maxX, maxY)
    const ringCount = outer.count - inner.count
    if (ringCount > 0 && (outer.sum - inner.sum) / ringCount < 0.4) continue
    spots.push({
      x: Math.round(sx / area),
      y: Math.round(sy / area),
      area,
      d: 2 * Math.sqrt(area / Math.PI)
    })
    affected += area
  }

  spots.sort((a, b) => b.area - a.area)
  return { version: 2, w, h, spots, affectedPct: (affected / n) * 100 }
}

export async function analyzeBlob(blob: Blob, delta?: number): Promise<Analysis> {
  return analyzeImageData(await blobToImageData(blob), delta)
}

// Size relative to frame width; absolute mm needs the planned reference
// sticker, so classes stay deliberately coarse.
export function sizeClass(spot: Spot, imageWidth: number): SizeClass {
  const rel = spot.d / imageWidth
  if (rel < 0.015) return 'small'
  if (rel < 0.04) return 'medium'
  return 'large'
}

export function sizeBreakdown(a: Analysis): Record<SizeClass, number> {
  const out: Record<SizeClass, number> = { small: 0, medium: 0, large: 0 }
  for (const s of a.spots) out[sizeClass(s, a.w)]++
  return out
}

// Draws the photo with detection circles: cyan = automatic, amber = manual.
export async function renderOverlay(blob: Blob, a: Analysis): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = a.w
    canvas.height = a.h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, a.w, a.h)
    ctx.lineWidth = Math.max(2, a.w / 450)
    for (const s of a.spots) {
      ctx.strokeStyle = s.manual ? '#fbbf24' : '#22d3ee'
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.d / 2 + ctx.lineWidth * 2, 0, Math.PI * 2)
      ctx.stroke()
    }
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9)
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Toggle a spot at analysis-space coordinates: removes the spot under the
// tap, or adds a manual one if the tap hit empty skin.
export function toggleSpot(a: Analysis, x: number, y: number): Analysis {
  const hitRadius = (s: Spot) => s.d / 2 + a.w * 0.015
  const idx = a.spots.findIndex((s) => Math.hypot(s.x - x, s.y - y) <= hitRadius(s))
  let spots: Spot[]
  if (idx >= 0) {
    spots = a.spots.filter((_, i) => i !== idx)
  } else {
    const ds = a.spots.map((s) => s.d).sort((p, q) => p - q)
    const d = ds.length ? ds[(ds.length / 2) | 0] : a.w * 0.02
    spots = [...a.spots, { x: Math.round(x), y: Math.round(y), d, area: Math.round(Math.PI * (d / 2) ** 2), manual: true }]
  }
  const affected = spots.reduce((acc, s) => acc + s.area, 0)
  return { ...a, spots, affectedPct: (affected / (a.w * a.h)) * 100 }
}

export interface MatchResult {
  newCount: number
  persistingCount: number
  resolvedCount: number
}

// Matches spots between two analyses of the same (ghost-aligned) region by
// nearest normalized centroid. Full image registration comes later; guided
// capture keeps framing close enough for a useful estimate.
export function matchSpots(a: Analysis, b: Analysis): MatchResult {
  const tol = 0.05 // of frame width
  const usedA = new Uint8Array(a.spots.length)
  let persisting = 0
  for (const sb of b.spots) {
    let best = -1
    let bestDist = tol
    for (let i = 0; i < a.spots.length; i++) {
      if (usedA[i]) continue
      const sa = a.spots[i]
      const dx = sa.x / a.w - sb.x / b.w
      const dy = sa.y / a.h - sb.y / b.h
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    if (best >= 0) {
      usedA[best] = 1
      persisting++
    }
  }
  return {
    newCount: b.spots.length - persisting,
    persistingCount: persisting,
    resolvedCount: a.spots.length - persisting
  }
}
