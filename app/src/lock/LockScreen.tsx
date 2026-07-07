import { useEffect, useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import * as vault from '../storage/vault'

export default function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const t = useT()
  const [initialized, setInitialized] = useState<boolean | null>(null)
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    vault.isInitialized().then(setInitialized)
  }, [])

  if (initialized === null) return <div className="lock-screen" />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!initialized) {
      if (pass.length < 6) return setError(t.lockTooShort)
      if (pass !== confirm) return setError(t.lockMismatch)
      setBusy(true)
      await vault.setup(pass)
      onUnlocked()
    } else {
      setBusy(true)
      const ok = await vault.unlock(pass)
      setBusy(false)
      if (ok) onUnlocked()
      else setError(t.lockWrong)
    }
  }

  return (
    <div className="lock-screen">
      <form className="lock-card" onSubmit={submit}>
        <div className="lock-logo">🟣</div>
        <h1>{t.appName}</h1>
        <h2>{initialized ? t.lockUnlockTitle : t.lockCreateTitle}</h2>
        {!initialized && <p className="hint">{t.lockCreateDesc}</p>}
        <input
          type="password"
          placeholder={t.lockPassphrase}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoFocus
        />
        {!initialized && (
          <input
            type="password"
            placeholder={t.lockConfirm}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {initialized ? t.lockUnlock : t.lockCreate}
        </button>
      </form>
    </div>
  )
}
