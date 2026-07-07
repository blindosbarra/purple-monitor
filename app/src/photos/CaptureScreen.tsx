import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useT } from '../i18n'
import { REGION_KEYS, type RegionKey } from '../i18n/translations'
import * as vault from '../storage/vault'
import { db } from '../storage/db'
import { usePhotoUrl } from '../components/images'

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
  })
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Re-encoding through a canvas strips EXIF metadata (including GPS).
async function blobToJpeg(file: Blob): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    return { blob: await toBlob(canvas, 0.92), w: canvas.width, h: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function makeThumb(blob: Blob, maxSide: number): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return toBlob(canvas, 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function CaptureScreen({
  onDone,
  onCancel
}: {
  onDone: () => void
  onCancel: () => void
}) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [region, setRegion] = useState<RegionKey>('leftLegFront')
  const [cameraOk, setCameraOk] = useState<boolean | null>(null)
  const [ghostOn, setGhostOn] = useState(true)
  const [ghostPayload, setGhostPayload] = useState<import('../storage/db').EncPayload | null>(null)
  const [preview, setPreview] = useState<{ blob: Blob; url: string; w: number; h: number } | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const ghostUrl = usePhotoUrl(ghostPayload)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
        setCameraOk(true)
      })
      .catch(() => setCameraOk(false))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [])

  // Ghost overlay: the most recent photo of the selected region.
  useEffect(() => {
    let alive = true
    db.photos
      .where('region')
      .equals(region)
      .toArray()
      .then((list) => {
        if (!alive) return
        list.sort((a, b) => a.dateISO.localeCompare(b.dateISO))
        setGhostPayload(list.length ? list[list.length - 1].enc : null)
      })
    return () => {
      alive = false
    }
  }, [region])

  const capture = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d')!.drawImage(v, 0, 0)
    const blob = await toBlob(canvas, 0.92)
    setPreview({ blob, url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height })
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const { blob, w, h } = await blobToJpeg(file)
    setPreview({ blob, url: URL.createObjectURL(blob), w, h })
  }

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const save = async () => {
    if (!preview || saving) return
    setSaving(true)
    const thumbBlob = await makeThumb(preview.blob, 320)
    const enc = await vault.encryptBlob(preview.blob)
    const thumbEnc = await vault.encryptBlob(thumbBlob)
    await db.photos.add({
      region,
      dateISO: new Date().toISOString(),
      w: preview.w,
      h: preview.h,
      enc,
      thumbEnc
    })
    URL.revokeObjectURL(preview.url)
    onDone()
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>{t.captureTitle}</h2>
        <button className="linklike" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>

      <label className="field-label">{t.captureRegion}</label>
      <select value={region} onChange={(e) => setRegion(e.target.value as RegionKey)}>
        {REGION_KEYS.map((r) => (
          <option key={r} value={r}>
            {t.regions[r]}
          </option>
        ))}
      </select>

      {preview ? (
        <>
          <div className="camera-stage">
            <img src={preview.url} className="camera-fill" alt="" />
          </div>
          <div className="btn-row">
            <button onClick={retake}>{t.retake}</button>
            <button className="primary" onClick={save} disabled={saving}>
              {t.savePhoto}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="camera-stage">
            <video ref={videoRef} className="camera-fill" autoPlay playsInline muted />
            {ghostOn && ghostUrl && <img src={ghostUrl} className="camera-fill ghost" alt="" />}
            {cameraOk === false && <p className="camera-msg">{t.cameraError}</p>}
          </div>
          {ghostUrl && <p className="hint">{t.ghostHint}</p>}
          <div className="btn-row">
            {ghostUrl && (
              <button onClick={() => setGhostOn(!ghostOn)}>
                {ghostOn ? '👻 ✓' : '👻'} {t.ghostToggle}
              </button>
            )}
            {cameraOk && (
              <button className="primary" onClick={capture}>
                📷 {t.takePhoto}
              </button>
            )}
            <label className="filebtn">
              {t.importPhoto}
              <input type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
            </label>
          </div>
        </>
      )}
    </div>
  )
}
