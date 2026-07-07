import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LangProvider } from './i18n'
import './styles.css'

// Ask the OS not to evict our IndexedDB data under storage pressure —
// months of medical history must not be silently deleted.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </React.StrictMode>
)
