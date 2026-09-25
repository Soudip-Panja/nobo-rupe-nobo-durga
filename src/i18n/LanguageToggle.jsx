import { useLanguage } from './context.js'
import './LanguageToggle.css'

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage()
  return (
    <div className="dp-lang" role="group" aria-label="Language / ভাষা">
      <span className={`dp-lang__thumb ${lang === 'bn' ? 'is-right' : ''}`} aria-hidden="true" />
      <button
        type="button"
        className={lang === 'en' ? 'is-active' : ''}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={lang === 'bn' ? 'is-active' : ''}
        aria-pressed={lang === 'bn'}
        onClick={() => setLang('bn')}
      >
        BN
      </button>
    </div>
  )
}
