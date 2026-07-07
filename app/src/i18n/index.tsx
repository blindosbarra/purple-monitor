import { createContext, useContext, useState, type ReactNode } from 'react'
import { translations, type Dict, type Lang } from './translations'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
}

const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {} })

function detectLang(): Lang {
  const stored = localStorage.getItem('pm-lang')
  if (stored === 'it' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)
  const setLang = (l: Lang) => {
    localStorage.setItem('pm-lang', l)
    setLangState(l)
  }
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>
}

export function useLang(): LangCtx {
  return useContext(Ctx)
}

export function useT(): Dict {
  return translations[useContext(Ctx).lang]
}

export function useLocale(): string {
  return useContext(Ctx).lang === 'it' ? 'it-IT' : 'en-GB'
}
