import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'es' | 'en'
const KEY = 'fff-lang'

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** Inline translate: pass the Spanish and English variants. */
  t: (es: string, en: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) as Lang | null
    return saved === 'en' || saved === 'es' ? saved : 'es'
  })
  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
    setLangState(l)
  }, [])
  const t = useCallback((es: string, en: string) => (lang === 'en' ? en : es), [lang])
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useT(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used within I18nProvider')
  return ctx
}

/** Non-hook translator for use outside React components. */
export function tr(lang: Lang, es: string, en: string): string {
  return lang === 'en' ? en : es
}
