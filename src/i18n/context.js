import { createContext, useContext } from 'react'

export const LanguageContext = createContext({ lang: 'bn', setLang: () => {}, t: (m) => m.bn })
export const useLanguage = () => useContext(LanguageContext)
