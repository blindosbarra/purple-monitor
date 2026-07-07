// On-device purpura spot detection. Runs entirely in the phone's browser.
//
// Approach: purpuric lesions are darker and red-violet compared with the
// surrounding skin, which means their *green fraction* g/(r+g+b) drops
// well below the skin's. We threshold adaptively against the image's own
// statistics (robust to lighting and skin tone), then extract connected
// blobs and filter by size and compactness.

export interface Spot {
  x: number // centroid, px in analysis space
  y: number
  area: number // px²
  d: number // equivalent diameter, px
}

export interface Analysis {
  version: 1
  w: number
  h: number
  spots: Spot[]
  affectedPct: number // % of the image covered by detected spots
}

export type SizeClass = 'small' | 'medium' | 'large'

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

export function analyzeImageData(img: ImageData): Analysis {
  const { data, width: w, height: h } = img
  const n = w * h

  // Pass 1: image statistics (mean/std of green fraction, mean luminance)
  const gfrac = new Float32Array(n)
  const lum = new Float32Array(n)
  let gSum = 0
  let lSum = 0
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const gf = g / (r + g + b + 1)
    const l = 0.299 * r + 0.587 * g + 0.114 * b
    gfrac[i] = gf
    lum[i] = l
    gSum += gf
    lSum += l
  }
  const gMean = gSum / n
  const lMean = lSum / n
  let gVar = 0
  for (let i = 0; i < n; i++) {
    const d = gfrac[i] - gMean
    gVar += d * d
  }
  const gStd = Math.sqrt(gVar / n)

  // Pass 2: mask of candidate purpura pixels.
  // A spot pixel is markedly green-poor vs the skin, darker than average,
  // and redder than green (excludes gray shadows, where r ≈ g ≈ b).
  const gThresh = gMean - Math.max(0.03, 1.2 * gStd)
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    if (gfrac[i] < gThresh && lum[i] < lMean && r > g + 10) mask[i] = 1
  }

  // Pass 3: connected components (4-connectivity, iterative flood fill)
  const minArea = Math.max(6, Math.round(n * 0.00002))
  const maxArea = Math.round(n * 0.02)
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
    if (area / (bw * bh) < 0.25) continue // too stringy to be a spot
    spots.push({
      x: Math.round(sx / area),
      y: Math.round(sy / area),
      area,
      d: 2 * Math.sqrt(area / Math.PI)
    })
    affected += area
  }

  spots.sort((a, b) => b.area - a.area)
  return { version: 1, w, h, spots, affectedPct: (affected / n) * 100 }
}

export async function analyzeBlob(blob: Blob): Promise<Analysis> {
  return analyzeImageData(await blobToImageData(blob))
}

// Size relative to frame width; absolute mm needs the Phase-2 reference
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

// Draws the photo with detection circles for visual verification.
export async function renderOverlay(blob: Blob, a: Analysis): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = a.w
    canvas.height = a.h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, a.w, a.h)
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = Math.max(2, a.w / 450)
    for (const s of a.spots) {
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
