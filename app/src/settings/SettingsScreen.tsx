import { useEffect, useRef, useState } from 'react'
import { useLang, useT } from '../i18n'
import * as vault from '../storage/vault'
import { db } from '../storage/db'
import { exportBackup, importBackup } from '../storage/backup'

const REMINDER_OPTIONS = [0, 1, 3, 7, 14, 30]

export default function SettingsScreen({ onLock }: { onLock: () => void }) {
  const t = useT()
  const { lang, setLang } = useLang()
  const [reminderDays, setReminderDays] = useState(0)
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passMsg, setPassMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    db.meta.get('reminderDays').then((m) => setReminderDays((m?.value as number) ?? 0))
  }, [])

  const saveReminder = async (days: number) => {
    setReminderDays(days)
    await db.meta.put({ key: 'reminderDays', value: days })
  }

  const changePass = async () => {
    setPassMsg('')
    if (newPass.length < 6) return setPassMsg(t.lockTooShort)
    setBusy(true)
    const ok = await vault.changePassphrase(curPass, newPass)
    setBusy(false)
    if (ok) {
      setCurPass('')
      setNewPass('')
      setPassMsg(t.passChanged)
    } else {
      setPassMsg(t.passWrong)
    }
  }

  const doExport = async () => {
    const blob = await exportBackup()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `purple-monitor-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doImport = async (file: File) => {
    if (!window.confirm(t.importConfirm)) return
    try {
      await importBackup(await file.text())
      window.alert(t.importDone)
      onLock()
    } catch {
      window.alert(t.importError)
    }
  }

  const doWipe = async () => {
    if (!window.confirm(t.wipeConfirm1)) return
    if (!window.confirm(t.wipeConfirm2)) return
    await db.delete()
    localStorage.clear()
    location.reload()
  }

  return (
    <div className="screen">
      <h2>{t.settingsTitle}</h2>

      <div className="card">
        <h3>{t.language}</h3>
        <div className="btn-row">
          <button className={lang === 'it' ? 'active' : ''} onClick={() => setLang('it')}>
            🇮🇹 Italiano
          </button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
            🇬🇧 English
          </button>
        </div>
      </div>

      <div className="card">
        <h3>{t.reminderTitle}</h3>
        <p className="hint">{t.reminderDesc}</p>
        <select value={reminderDays} onChange={(e) => saveReminder(Number(e.target.value))}>
          {REMINDER_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {t.reminderLabels[String(d)]}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <h3>{t.securityTitle}</h3>
        <label className="field-label">{t.currentPass}</label>
        <input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} />
        <label className="field-label">{t.newPass}</label>
        <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        {passMsg && <p className="hint">{passMsg}</p>}
        <div className="btn-row">
          <button onClick={changePass} disabled={busy}>
            {t.change}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>{t.backupTitle}</h3>
        <p className="hint">{t.backupDesc}</p>
        <div className="btn-row">
          <button onClick={doExport}>⬇️ {t.exportBackup}</button>
          <button onClick={() => importRef.current?.click()}>⬆️ {t.importBackup}</button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void doImport(f)
            }}
          />
        </div>
      </div>

      <div className="card">
        <h3>{t.dangerTitle}</h3>
        <div className="btn-row">
          <button className="danger" onClick={doWipe}>
            🗑 {t.wipe}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>{t.aboutTitle}</h3>
        <p className="hint">{t.aboutText}</p>
      </div>
    </div>
  )
}
