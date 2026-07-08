import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { useLocale, useT } from '../i18n'
import { REGION_KEYS, type RegionKey } from '../i18n/translations'
import { db, type PhotoRec } from '../storage/db'
import * as vault from '../storage/vault'
import { EncImage } from '../components/images'
import {
  analyzeBlob,
  renderOverlay,
  sizeBreakdown,
  toggleSpot,
  SENSITIVITY_DELTA,
  type Analysis,
  type CropRect,
  type Sensitivity
} from '../analysis/detect'
import CaptureScreen from './CaptureScreen'

function AnalysisPanel({ photo }: { photo: PhotoRec }) {
  const t = useT()
  const [blob, setBlob] = useState<Blob | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sens, setSens] = useState<Sensitivity>('normal')
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [cropMode, setCropMode] = useState(false)
  const [drag, setDrag] = useState<CropRect | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const justCropped = useRef(false)

  // Decrypt the photo once; load a previously stored analysis with it.
  useEffect(() => {
    let alive = true
    setBlob(null)
    setAnalysis(null)
    setCrop(null)
    setCropMode(false)
    setDrag(null)
    vault.decryptToBlob(photo.enc).then((b) => {
      if (alive) setBlob(b)
    })
    if (photo.analysisEnc) {
      vault.decryptJSON<Analysis>(photo.analysisEnc).then((a) => {
        if (alive) {
          setAnalysis(a)
          setCrop(a.crop ?? null)
        }
      })
    }
    return () => {
      alive = false
    }
  }, [photo])

  useEffect(() => {
    if (!blob) {
      setBlobUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setBlobUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  // Re-render the annotated image whenever the analysis changes.
  useEffect(() => {
    let alive = true
    let u: string | null = null
    if (!blob || !analysis) {
      setOverlayUrl(null)
      return
    }
    renderOverlay(blob, analysis).then((ov) => {
      if (!alive) return
      u = URL.createObjectURL(ov)
      setOverlayUrl(u)
    })
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [blob, analysis])

  const persist = async (a: Analysis) => {
    await db.photos.update(photo.id!, { analysisEnc: await vault.encryptJSON(a) })
  }

  const analyze = async (s: Sensitivity = sens, cropArg: CropRect | null = crop) => {
    if (busy || !blob) return
    setBusy(true)
    try {
      const a = await analyzeBlob(blob, SENSITIVITY_DELTA[s], cropArg ?? undefined)
      setAnalysis(a)
      await persist(a)
    } finally {
      setBusy(false)
    }
  }

  const clearCrop = () => {
    setCrop(null)
    void analyze(sens, null)
  }

  // Drag-to-select the analysis area.
  const normPoint = (e: ReactPointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    }
  }
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!cropMode) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = normPoint(e)
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!cropMode || !drag) return
    const p = normPoint(e)
    setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d))
  }
  const onPointerUp = async () => {
    if (!cropMode || !drag) return
    const rect: CropRect = {
      x0: Math.min(drag.x0, drag.x1),
      y0: Math.min(drag.y0, drag.y1),
      x1: Math.max(drag.x0, drag.x1),
      y1: Math.max(drag.y0, drag.y1)
    }
    setDrag(null)
    setCropMode(false)
    justCropped.current = true
    if (rect.x1 - rect.x0 < 0.05 || rect.y1 - rect.y0 < 0.05) return
    setCrop(rect)
    await analyze(sens, rect)
  }

  // Tap a circle to remove it; tap a missed spot to add it.
  const onTap = async (e: MouseEvent<HTMLImageElement>) => {
    if (justCropped.current) {
      justCropped.current = false
      return
    }
    if (!analysis || cropMode) return
    const img = e.currentTarget
    const rect = img.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * analysis.w
    const y = ((e.clientY - rect.top) / rect.height) * analysis.h
    const next = toggleSpot(analysis, x, y)
    setAnalysis(next)
    await persist(next)
  }

  const sizes = analysis ? sizeBreakdown(analysis) : null

  return (
    <div className="analysis">
      <div
        className="img-wrap"
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {overlayUrl ? (
          <img
            src={overlayUrl}
            className={`modal-img ${cropMode ? 'cropping' : 'tappable'}`}
            alt=""
            draggable={false}
            onClick={onTap}
          />
        ) : (
          blobUrl && (
            <img
              src={blobUrl}
              className={`modal-img ${cropMode ? 'cropping' : ''}`}
              alt=""
              draggable={false}
            />
          )
        )}
        {drag && (
          <div
            className="crop-live"
            style={{
              left: `${Math.min(drag.x0, drag.x1) * 100}%`,
              top: `${Math.min(drag.y0, drag.y1) * 100}%`,
              width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
              height: `${Math.abs(drag.y1 - drag.y0) * 100}%`
            }}
          />
        )}
      </div>
      {cropMode ? (
        <p className="hint">✂️ {t.cropHint}</p>
      ) : (
        analysis && <p className="hint">☝️ {t.tapHint}</p>
      )}
      <div className="btn-row">
        <button className="primary" onClick={() => analyze()} disabled={busy || !blob}>
          🔬 {busy ? t.analyzing : t.analyze}
        </button>
        <button
          className={cropMode ? 'active' : ''}
          disabled={busy || !blob}
          onClick={() => setCropMode(!cropMode)}
        >
          ✂️ {t.cropStart}
        </button>
        {crop && !cropMode && (
          <button disabled={busy} onClick={clearCrop}>
            {t.cropClear}
          </button>
        )}
      </div>
      {analysis && (
        <>
          <label className="field-label">{t.sensitivity}</label>
          <div className="seg-row">
            {(['low', 'normal', 'high'] as Sensitivity[]).map((s) => (
              <button
                key={s}
                className={sens === s ? 'seg active' : 'seg'}
                disabled={busy}
                onClick={() => {
                  setSens(s)
                  void analyze(s)
                }}
              >
                {s === 'low' ? t.sensLow : s === 'normal' ? t.sensNormal : t.sensHigh}
              </button>
            ))}
          </div>
        </>
      )}
      {analysis && sizes && (
        <>
          <div className="badge-row">
            <span className="badge">
              {t.spots}: <strong>{analysis.spots.length}</strong>
            </span>
            <span className="badge">
              {t.affectedArea}: {analysis.affectedPct.toFixed(1)}%
            </span>
            <span className="badge">
              {t.sizeSmall}: {sizes.small}
            </span>
            <span className="badge">
              {t.sizeMedium}: {sizes.medium}
            </span>
            <span className="badge">
              {t.sizeLarge}: {sizes.large}
            </span>
          </div>
          <p className="hint">{t.analysisDisclaimer}</p>
        </>
      )}
    </div>
  )
}

export default function PhotosScreen() {
  const t = useT()
  const locale = useLocale()
  const [photos, setPhotos] = useState<PhotoRec[] | null>(null)
  const [regionFilter, setRegionFilter] = useState<'all' | RegionKey>('all')
  const [capturing, setCapturing] = useState(false)
  const [viewer, setViewer] = useState<PhotoRec | null>(null)

  const load = useCallback(() => {
    db.photos
      .orderBy('dateISO')
      .reverse()
      .toArray()
      .then(setPhotos)
  }, [])

  useEffect(load, [load])

  if (capturing) {
    return (
      <CaptureScreen
        onDone={() => {
          setCapturing(false)
          load()
        }}
        onCancel={() => setCapturing(false)}
      />
    )
  }

  const shown =
    photos === null ? null : regionFilter === 'all' ? photos : photos.filter((p) => p.region === regionFilter)

  const deletePhoto = async (p: PhotoRec) => {
    if (!window.confirm(t.deletePhotoConfirm)) return
    await db.photos.delete(p.id!)
    setViewer(null)
    load()
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>{t.photosTitle}</h2>
        <button className="primary" onClick={() => setCapturing(true)}>
          ＋ {t.newPhoto}
        </button>
      </div>

      <div className="chip-row">
        <button
          className={regionFilter === 'all' ? 'chip active' : 'chip'}
          onClick={() => setRegionFilter('all')}
        >
          {t.allRegions}
        </button>
        {REGION_KEYS.map((r) => (
          <button
            key={r}
            className={regionFilter === r ? 'chip active' : 'chip'}
            onClick={() => setRegionFilter(r)}
          >
            {t.regions[r]}
          </button>
        ))}
      </div>

      {shown && shown.length === 0 && <p className="empty">{t.photosEmpty}</p>}

      <div className="photo-grid">
        {shown?.map((p) => (
          <button key={p.id} className="photo-card" onClick={() => setViewer(p)}>
            <EncImage payload={p.thumbEnc} className="photo-thumb" />
            <span className="photo-date">{fmt(p.dateISO)}</span>
            <span className="photo-region">{t.regions[p.region as RegionKey] ?? p.region}</span>
          </button>
        ))}
      </div>

      {viewer && (
        <div className="modal" onClick={() => setViewer(null)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <p className="photo-meta">
              {fmt(viewer.dateISO)} · {t.regions[viewer.region as RegionKey] ?? viewer.region}
            </p>
            <label className="field-label">{t.moveRegion}</label>
            <select
              value={viewer.region}
              onChange={async (e) => {
                const region = e.target.value
                await db.photos.update(viewer.id!, { region })
                setViewer({ ...viewer, region })
                load()
              }}
            >
              {REGION_KEYS.map((r) => (
                <option key={r} value={r}>
                  {t.regions[r]}
                </option>
              ))}
            </select>
            <AnalysisPanel photo={viewer} />
            <div className="btn-row">
              <button className="danger" onClick={() => deletePhoto(viewer)}>
                {t.delete}
              </button>
              <button onClick={() => setViewer(null)}>{t.close}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
