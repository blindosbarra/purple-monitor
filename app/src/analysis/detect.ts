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
  version: 3
  w: number
  h: number
  spots: Spot[]
  skinArea?: number // px² classified as skin
  affectedPct: number // % of the detected skin covered by spots
}

export type SizeClass = 'small' | 'medium' | 'large'
export type Sensitivity = 'low' | 'normal' | 'high'

// Combined chroma-anomaly score required to call a pixel a spot candidate.
export const SENSITIVITY_DELTA: Record<Sensitivity, number> = {
  low: 0.07,
  normal: 0.045,
  high: 0.03
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

function median(samples: number[]): number {
  samples.sort((a, b) => a - b)
  return samples.length ? samples[(samples.length / 2) | 0] : 0
}

export function analyzeImageData(img: ImageData, delta = SENSITIVITY_DELTA.normal): Analysis {
  const { data, width: w, height: h } = img
  const n = w * h

  // Normalized chromaticity + luminance per pixel.
  const rn = new Float32Array(n)
  const gn = new Float32Array(n)
  const lum = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const sum = r + g + b + 1
    rn[i] = r / sum
    gn[i] = g / sum
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }

  // Learn this photo's skin color from the frame center (guided capture
  // puts the limb there). A fixed "skin color" rule fails on warm-colored
  // backgrounds like blankets, which is why the model is per-photo.
  const sR: number[] = []
  const sG: number[] = []
  const sL: number[] = []
  for (let y = Math.round(h * 0.2); y < h * 0.8; y += 3) {
    for (let x = Math.round(w * 0.25); x < w * 0.75; x += 3) {
      const i = y * w + x
      sR.push(rn[i])
      sG.push(gn[i])
      sL.push(lum[i])
    }
  }
  const rnMed = median(sR)
  const gnMed = median(sG)
  const lumMed = median(sL)

  const skin = new Uint8Array(n)
  let skinTotal = 0
  for (let i = 0; i < n; i++) {
    if (
      Math.abs(rn[i] - rnMed) <= 0.06 &&
      Math.abs(gn[i] - gnMed) <= 0.045 &&
      lum[i] >= lumMed * 0.35 &&
      lum[i] <= lumMed * 1.7
    ) {
      skin[i] = 1
      skinTotal++
    }
  }
  // Fallback for degenerate frames (center not on skin): classic YCbCr gate.
  if (skinTotal < n * 0.08) {
    skinTotal = 0
    for (let i = 0; i < n; i++) {
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
      skin[i] = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 177 ? 1 : 0
      skinTotal += skin[i]
    }
  }

  // Skin-restricted local baselines: each pixel is compared with the mean
  // of the *skin* around it, never with background or shadow boundaries.
  const rnSkin = new Float32Array(n)
  const gnSkin = new Float32Array(n)
  const lumSkin = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (skin[i]) {
      rnSkin[i] = rn[i]
      gnSkin[i] = gn[i]
      lumSkin[i] = lum[i]
    }
  }
  const intS = integralOf(skin, w, h)
  const intRnS = integralOf(rnSkin, w, h)
  const intGnS = integralOf(gnSkin, w, h)
  const intLumS = integralOf(lumSkin, w, h)
  const R = Math.max(12, Math.round(Math.min(w, h) / 9))
  const R2 = Math.max(5, Math.round(R / 3))

  const mask = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      // must sit inside a skin area, away from the limb's outline
      const near = boxSum(intS, w, h, x - R2, y - R2, x + R2, y + R2)
      if (near.sum / near.count < 0.5) continue
      const local = boxSum(intS, w, h, x - R, y - R, x + R, y + R)
      if (local.sum / local.count < 0.4) continue
      const skinCnt = local.sum
      const meanRn = boxSum(intRnS, w, h, x - R, y - R, x + R, y + R).sum / skinCnt
      const meanGn = boxSum(intGnS, w, h, x - R, y - R, x + R, y + R).sum / skinCnt
      // red-violet anomaly vs surrounding skin: green deficit + red excess.
      // Shadows scale all channels equally and score ~0 here.
      const score = meanGn - gn[i] + 0.7 * (rn[i] - meanRn)
      if (score <= delta) continue
      const meanLum = boxSum(intLumS, w, h, x - R, y - R, x + R, y + R).sum / skinCnt
      if (lum[i] >= meanLum * 0.97) continue // spots are darker than skin
      if (lum[i] <= meanLum * 0.35) continue // near-black: hair, dirt
      mask[i] = 1
    }
  }

  // Connected components (4-connectivity, iterative flood fill).
  // Real petechiae on a full-limb photo can be only a few px across.
  const minArea = Math.max(5, Math.round(n * 0.000008))
  const maxArea = Math.round(n * 0.008)
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
  return {
    version: 3,
    w,
    h,
    spots,
    skinArea: skinTotal,
    affectedPct: skinTotal > 0 ? (affected / skinTotal) * 100 : 0
  }
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
  const base = a.skinArea ?? a.w * a.h
  return { ...a, spots, affectedPct: base > 0 ? (affected / base) * 100 : 0 }
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
