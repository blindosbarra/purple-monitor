import { useCallback, useEffect, useState } from 'react'
import { useLocale, useT } from '../i18n'
import { REGION_KEYS, type RegionKey } from '../i18n/translations'
import { db, type PhotoRec } from '../storage/db'
import { EncImage } from '../components/images'
import CaptureScreen from './CaptureScreen'

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
