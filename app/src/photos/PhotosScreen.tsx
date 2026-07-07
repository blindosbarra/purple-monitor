import { useCallback, useEffect, useState } from 'react'
import { useLocale, useT } from '../i18n'
import { REGION_KEYS, type RegionKey } from '../i18n/translations'
import { db, type PhotoRec } from '../storage/db'
import * as vault from '../storage/vault'
import { EncImage } from '../components/images'
import { analyzeBlob, renderOverlay, sizeBreakdown, type Analysis } from '../analysis/detect'
import CaptureScreen from './CaptureScreen'

function AnalysisPanel({ photo }: { photo: PhotoRec }) {
  const t = useT()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Load a previously stored analysis (without the overlay, which is
  // re-rendered on demand).
  useEffect(() => {
    let alive = true
    setAnalysis(null)
    setOverlayUrl(null)
    if (photo.analysisEnc) {
      vault.decryptJSON<Analysis>(photo.analysisEnc).then((a) => {
        if (alive) setAnalysis(a)
      })
    }
    return () => {
      alive = false
    }
  }, [photo])

  useEffect(() => () => {
    if (overlayUrl) URL.revokeObjectURL(overlayUrl)
  }, [overlayUrl])

  const analyze = async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = await vault.decryptToBlob(photo.enc)
      const a = await analyzeBlob(blob)
      const overlay = await renderOverlay(blob, a)
      setAnalysis(a)
      setOverlayUrl(URL.createObjectURL(overlay))
      await db.photos.update(photo.id!, { analysisEnc: await vault.encryptJSON(a) })
    } finally {
      setBusy(false)
    }
  }

  const sizes = analysis ? sizeBreakdown(analysis) : null

  return (
    <div className="analysis">
      {overlayUrl && <img src={overlayUrl} className="modal-img" alt="" />}
      <div className="btn-row">
        <button className="primary" onClick={analyze} disabled={busy}>
          🔬 {busy ? t.analyzing : t.analyze}
        </button>
      </div>
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
            <EncImage payload={viewer.enc} className="modal-img" />
            <p className="photo-meta">
              {fmt(viewer.dateISO)} · {t.regions[viewer.region as RegionKey] ?? viewer.region}
            </p>
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
