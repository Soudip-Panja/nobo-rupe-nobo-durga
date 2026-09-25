import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { createTransitionLayer } from './transitionLayer.js'
import { TransitionContext } from './context.js'
import './TransitionLayer.css'

// Sits above every route and never unmounts, so particles carry across pages.
export default function TransitionLayer({ children }) {
  const hostRef = useRef(null)
  const flashRef = useRef(null)
  const layerRef = useRef(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const layer = createTransitionLayer(hostRef.current, flashRef.current)
    layerRef.current = layer
    return () => {
      layer.dispose()
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    layerRef.current?.setAmbient(pathname === '/home')
  }, [pathname])

  const api = useMemo(() => ({ start: () => layerRef.current?.start() }), [])

  return (
    <TransitionContext.Provider value={api}>
      {children}
      <div className="dp-transition-flash" ref={flashRef} aria-hidden="true" />
      <div className="dp-transition-layer" ref={hostRef} aria-hidden="true" />
    </TransitionContext.Provider>
  )
}
