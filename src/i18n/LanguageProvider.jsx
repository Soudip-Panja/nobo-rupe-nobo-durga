import { useEffect, useMemo, useState } from 'react'
import { LanguageContext } from './context.js'

const KEY = 'dp-lang'

function readSaved() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'en' || v === 'bn' ? v : null
  } catch {
    return null
  }
}

// Bengali by default; English only after the visitor switches with the toggle.
export default function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => readSaved() ?? 'bn')

  useEffect(() => {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'
    try {
      localStorage.setItem(KEY, lang)
    } catch {
      /* storage unavailable (private mode) — language still works for this visit */
    }
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      setLang: (l) => setLangState(l === 'en' ? 'en' : 'bn'),
      // t({ bn: 'প্রবেশ করুন', en: 'Enter' }) → text in the current language
      t: (msg) => msg[lang] ?? msg.bn,
    }),
    [lang]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
