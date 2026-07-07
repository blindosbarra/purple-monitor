import { useCallback, useEffect, useState } from 'react'
import { useLocale, useT } from '../i18n'
import * as vault from '../storage/vault'
import { db } from '../storage/db'

export type Level = 'neg' | 'trace' | 'p1' | 'p2' | 'p3'
export type SymptomKey = 'abdominal' | 'joint' | 'rash' | 'fever'

export interface DiaryEntry {
  date: string // YYYY-MM-DD
  blood: Level
  protein: Level
  leukocytes: Level | ''
  nitrites: '' | 'neg' | 'pos'
  symptoms: SymptomKey[]
  meds: string
  notes: string
}

const LEVELS: Level[] = ['neg', 'trace', 'p1', 'p2', 'p3']
const SYMPTOMS: SymptomKey[] = ['abdominal', 'joint', 'rash', 'fever']

const today = () => new Date().toISOString().slice(0, 10)

const emptyEntry = (): DiaryEntry => ({
  date: today(),
  blood: 'neg',
  protein: 'neg',
  leukocytes: '',
  nitrites: '',
  symptoms: [],
  meds: '',
  notes: ''
})

function needsAttention(e: DiaryEntry): boolean {
  return e.blood !== 'neg' || e.protein !== 'neg'
}

export default function DiaryScreen() {
  const t = useT()
  const locale = useLocale()
  const [rows, setRows] = useState<{ id: number; entry: DiaryEntry }[] | null>(null)
  const [editing, setEditing] = useState<DiaryEntry | null>(null)
  const [reminderDays, setReminderDays] = useState(0)

  const load = useCallback(() => {
    db.diary
      .orderBy('dateISO')
      .reverse()
      .toArray()
      .then(async (recs) => {
        const out: { id: number; entry: DiaryEntry }[] = []
        for (const r of recs) {
          out.push({ id: r.id!, entry: await vault.decryptJSON<DiaryEntry>(r.enc) })
        }
        setRows(out)
      })
    db.meta.get('reminderDays').then((m) => setReminderDays((m?.value as number) ?? 0))
  }, [])

  useEffect(load, [load])

  const levelLabel: Record<Level, string> = {
    neg: t.levelNeg,
    trace: t.levelTrace,
    p1: t.levelP1,
    p2: t.levelP2,
    p3: t.levelP3
  }
  const symptomLabel: Record<SymptomKey, string> = {
    abdominal: t.symptomAbdominal,
    joint: t.symptomJoint,
    rash: t.symptomRash,
    fever: t.symptomFever
  }

  const testDue = (() => {
    if (!reminderDays || rows === null) return false
    if (rows.length === 0) return true
    const last = rows[0].entry.date
    const days = (Date.now() - new Date(last + 'T00:00:00').getTime()) / 86400000
    return days >= reminderDays
  })()

  const save = async () => {
    if (!editing) return
    const enc = await vault.encryptJSON(editing)
    await db.diary.add({ dateISO: editing.date + 'T12:00:00', enc })
    setEditing(null)
    load()
  }

  const remove = async (id: number) => {
    if (!window.confirm(t.deleteEntryConfirm)) return
    await db.diary.delete(id)
    load()
  }

  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })

  const set = <K extends keyof DiaryEntry>(k: K, v: DiaryEntry[K]) =>
    setEditing((e) => (e ? { ...e, [k]: v } : e))

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>{t.diaryTitle}</h2>
        {!editing && (
          <button className="primary" onClick={() => setEditing(emptyEntry())}>
            ＋ {t.newEntry}
          </button>
        )}
      </div>

      {testDue && !editing && <div className="banner warn">⏰ {t.testDue}</div>}

      {editing && (
        <div className="card form">
          <label className="field-label">{t.date}</label>
          <input type="date" value={editing.date} onChange={(e) => set('date', e.target.value)} />

          <label className="field-label">{t.blood}</label>
          <div className="seg-row">
            {LEVELS.map((l) => (
              <button
                key={l}
                className={editing.blood === l ? 'seg active' : 'seg'}
                onClick={() => set('blood', l)}
              >
                {levelLabel[l]}
              </button>
            ))}
          </div>

          <label className="field-label">{t.protein}</label>
          <div className="seg-row">
            {LEVELS.map((l) => (
              <button
                key={l}
                className={editing.protein === l ? 'seg active' : 'seg'}
                onClick={() => set('protein', l)}
              >
                {levelLabel[l]}
              </button>
            ))}
          </div>

          <label className="field-label">{t.leukocytes}</label>
          <select
            value={editing.leukocytes}
            onChange={(e) => set('leukocytes', e.target.value as Level | '')}
          >
            <option value="">{t.notMeasured}</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {levelLabel[l]}
              </option>
            ))}
          </select>

          <label className="field-label">{t.nitrites}</label>
          <select
            value={editing.nitrites}
            onChange={(e) => set('nitrites', e.target.value as '' | 'neg' | 'pos')}
          >
            <option value="">{t.notMeasured}</option>
            <option value="neg">{t.levelNeg}</option>
            <option value="pos">{t.positive}</option>
          </select>

          <label className="field-label">{t.symptomsLabel}</label>
          <div className="chip-row">
            {SYMPTOMS.map((s) => (
              <button
                key={s}
                className={editing.symptoms.includes(s) ? 'chip active' : 'chip'}
                onClick={() =>
                  set(
                    'symptoms',
                    editing.symptoms.includes(s)
                      ? editing.symptoms.filter((x) => x !== s)
                      : [...editing.symptoms, s]
                  )
                }
              >
                {symptomLabel[s]}
              </button>
            ))}
          </div>

          <label className="field-label">{t.meds}</label>
          <input type="text" value={editing.meds} onChange={(e) => set('meds', e.target.value)} />

          <label className="field-label">{t.notes}</label>
          <textarea value={editing.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />

          <div className="btn-row">
            <button onClick={() => setEditing(null)}>{t.cancel}</button>
            <button className="primary" onClick={save}>
              {t.save}
            </button>
          </div>
        </div>
      )}

      {rows && rows.length === 0 && !editing && <p className="empty">{t.diaryEmpty}</p>}

      {rows?.map(({ id, entry }) => (
        <div key={id} className="card entry">
          <div className="entry-head">
            <strong>{fmt(entry.date)}</strong>
            <button className="linklike danger" onClick={() => remove(id)}>
              ✕
            </button>
          </div>
          <div className="badge-row">
            <span className={entry.blood === 'neg' ? 'badge ok' : 'badge alert'}>
              {t.blood}: {levelLabel[entry.blood]}
            </span>
            <span className={entry.protein === 'neg' ? 'badge ok' : 'badge alert'}>
              {t.protein}: {levelLabel[entry.protein]}
            </span>
            {entry.leukocytes && (
              <span className="badge">
                {t.leukocytes.replace(/\s*\(.*\)/, '')}: {levelLabel[entry.leukocytes]}
              </span>
            )}
            {entry.nitrites && (
              <span className={entry.nitrites === 'pos' ? 'badge alert' : 'badge'}>
                {t.nitrites.replace(/\s*\(.*\)/, '')}:{' '}
                {entry.nitrites === 'pos' ? t.positive : t.levelNeg}
              </span>
            )}
          </div>
          {entry.symptoms.length > 0 && (
            <p className="entry-line">{entry.symptoms.map((s) => symptomLabel[s]).join(' · ')}</p>
          )}
          {entry.meds && <p className="entry-line">💊 {entry.meds}</p>}
          {entry.notes && <p className="entry-line">{entry.notes}</p>}
          {needsAttention(entry) && <div className="banner alert">⚠️ {t.attention}</div>}
        </div>
      ))}
    </div>
  )
}
