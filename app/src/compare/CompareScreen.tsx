import { useEffect, useMemo, useState } from 'react'
import { useLocale, useT } from '../i18n'
import { REGION_KEYS, type RegionKey } from '../i18n/translations'
import { db, type PhotoRec } from '../storage/db'
import { usePhotoUrl } from '../components/images'

export default function CompareScreen() {
  const t = useT()
  const locale = useLocale()
  const [region, setRegion] = useState<RegionKey>('leftLegFront')
  const [photos, setPhotos] = useState<PhotoRec[]>([])
  const [aId, setAId] = useState<number | null>(null)
  const [bId, setBId] = useState<number | null>(null)
  const [mode, setMode] = useState<'slider' | 'side'>('slider')
  const [pos, setPos] = useState(50)

  useEffect(() => {
    let alive = true
    db.photos
      .where('region')
      .equals(region)
      .toArray()
      .then((list) => {
        if (!alive) return
        list.sort((a, b) => a.dateISO.localeCompare(b.dateISO))
        setPhotos(list)
        setAId(list.length >= 2 ? list[list.length - 2].id! : null)
        setBId(list.length >= 1 ? list[list.length - 1].id! : null)
      })
    return () => {
      alive = false
    }
  }, [region])

  const a = useMemo(() => photos.find((p) => p.id === aId) ?? null, [photos, aId])
  const b = useMemo(() => photos.find((p) => p.id === bId) ?? null, [photos, bId])
  const urlA = usePhotoUrl(a?.enc)
  const urlB = usePhotoUrl(b?.enc)

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })

  return (
    <div className="screen">
      <h2>{t.compareTitle}</h2>

      <label className="field-label">{t.captureRegion}</label>
      <select value={region} onChange={(e) => setRegion(e.target.value as RegionKey)}>
        {REGION_KEYS.map((r) => (
          <option key={r} value={r}>
            {t.regions[r]}
          </option>
        ))}
      </select>

      {photos.length < 2 ? (
        <p className="empty">{t.compareNeedTwo}</p>
      ) : (
        <>
          <div className="cmp-selects">
            <div>
              <label className="field-label">{t.compareOlder}</label>
              <select value={aId ?? ''} onChange={(e) => setAId(Number(e.target.value))}>
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fmt(p.dateISO)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">{t.compareNewer}</label>
              <select value={bId ?? ''} onChange={(e) => setBId(Number(e.target.value))}>
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fmt(p.dateISO)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="btn-row">
            <button className={mode === 'slider' ? 'active' : ''} onClick={() => setMode('slider')}>
              {t.compareSlider}
            </button>
            <button className={mode === 'side' ? 'active' : ''} onClick={() => setMode('side')}>
              {t.compareSide}
            </button>
          </div>

          {mode === 'slider' ? (
            <>
              <div className="cmp-stage">
                {urlA && <img src={urlA} className="camera-fill" alt="" />}
                {urlB && (
                  <div className="cmp-top" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
                    <img src={urlB} className="camera-fill" alt="" />
                  </div>
                )}
                <div className="cmp-divider" style={{ left: `${pos}%` }} />
                {a && <span className="cmp-label left">{fmt(a.dateISO)}</span>}
                {b && <span className="cmp-label right">{fmt(b.dateISO)}</span>}
              </div>
              <input
                className="cmp-range"
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
              />
            </>
          ) : (
            <div className="cmp-side">
              <figure>
                {urlA && <img src={urlA} alt="" />}
                <figcaption>{a && fmt(a.dateISO)}</figcaption>
              </figure>
              <figure>
                {urlB && <img src={urlB} alt="" />}
                <figcaption>{b && fmt(b.dateISO)}</figcaption>
              </figure>
            </div>
          )}
        </>
      )}
    </div>
  )
}
