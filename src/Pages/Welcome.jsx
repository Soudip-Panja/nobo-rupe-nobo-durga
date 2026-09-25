import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createWelcomeScene } from './welcome/scene.js'
import { useTransitionLayer } from '../components/transition/context.js'
import { useLanguage } from '../i18n/context.js'
import btnEn from '../assets/welcome/btn.webp'
import btnEnMask from '../assets/welcome/btnMask.webp'
import btnBn from '../assets/welcome/bn/btn.webp'
import btnBnMask from '../assets/welcome/bn/btnMask.webp'
import './welcome/Welcome.css'

const BUTTONS = {
  en: { src: btnEn, mask: btnEnMask },
  bn: { src: btnBn, mask: btnBnMask },
}

export default function Welcome() {
  const stageRef = useRef(null)
  const btnRef = useRef(null)
  const sceneRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const navigate = useNavigate()
  const transition = useTransitionLayer()
  const { lang, t } = useLanguage()
  const langRef = useRef(lang)

  useEffect(() => {
    const scene = createWelcomeScene(stageRef.current, {
      buttonEl: btnRef.current,
      lang: langRef.current,
      onReady: () => setReady(true),
    })
    sceneRef.current = scene
    return () => scene.dispose()
  }, [])

  // crossfade the 3D title when the EN / BN toggle changes
  useEffect(() => {
    langRef.current = lang
    sceneRef.current?.setLang(lang)
  }, [lang])

  const enter = () => {
    if (leaving) return
    setLeaving(true)
    transition.start() // particles + golden flash that carry over into Home
    sceneRef.current?.enter(() => navigate('/home'))
  }

  return (
    <main className={`dp-welcome ${ready ? 'is-ready' : ''} ${leaving ? 'is-leaving' : ''}`}>
      <h1 className="dp-sr-only">{t({ bn: 'নব রূপে নব দুর্গা — দুর্গাপূজা ২০২৬', en: 'Nobo Rupe Nobo Durga — Durga Pooja 2026' })}</h1>
      <div className="dp-stage" ref={stageRef} aria-hidden="true" />
      <button ref={btnRef} className="dp-enter" onClick={enter} aria-label={t({ bn: 'প্রবেশ করুন', en: 'Enter' })}>
        {Object.entries(BUTTONS).map(([key, b]) => (
          <span key={key} className={`dp-enter__art ${lang === key ? 'is-active' : ''}`}>
            <img src={b.src} alt="" draggable="false" />
            <span
              className="dp-enter__sheen"
              style={{ WebkitMaskImage: `url(${b.mask})`, maskImage: `url(${b.mask})` }}
            />
          </span>
        ))}
      </button>
      <div className="dp-loader" aria-hidden="true">
        <span />
      </div>
    </main>
  )
}
