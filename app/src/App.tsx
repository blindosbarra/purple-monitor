import { useState } from 'react'
import { useT } from './i18n'
import * as vault from './storage/vault'
import LockScreen from './lock/LockScreen'
import PhotosScreen from './photos/PhotosScreen'
import CompareScreen from './compare/CompareScreen'
import DiaryScreen from './diary/DiaryScreen'
import SettingsScreen from './settings/SettingsScreen'

type Tab = 'photos' | 'compare' | 'diary' | 'settings'

const TABS: { id: Tab; icon: string }[] = [
  { id: 'photos', icon: '📷' },
  { id: 'compare', icon: '🔍' },
  { id: 'diary', icon: '📒' },
  { id: 'settings', icon: '⚙️' }
]

export default function App() {
  const t = useT()
  const [unlocked, setUnlocked] = useState(false)
  const [tab, setTab] = useState<Tab>('photos')

  const doLock = () => {
    vault.lock()
    setUnlocked(false)
  }

  if (!unlocked) {
    return <LockScreen onUnlocked={() => setUnlocked(true)} />
  }

  const labels: Record<Tab, string> = {
    photos: t.navPhotos,
    compare: t.navCompare,
    diary: t.navDiary,
    settings: t.navSettings
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">{t.appName}</span>
        <button className="linklike" onClick={doLock}>
          🔒 {t.lockNow}
        </button>
      </header>
      <main className="content">
        {tab === 'photos' && <PhotosScreen />}
        {tab === 'compare' && <CompareScreen />}
        {tab === 'diary' && <DiaryScreen />}
        {tab === 'settings' && <SettingsScreen onLock={doLock} />}
      </main>
      <p className="disclaimer">{t.disclaimer}</p>
      <nav className="tabbar">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            className={tab === tb.id ? 'tab active' : 'tab'}
            onClick={() => setTab(tb.id)}
          >
            <span className="tab-icon">{tb.icon}</span>
            <span className="tab-label">{labels[tb.id]}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
