import { createContext, useContext } from 'react'

export const TransitionContext = createContext({ start: () => {} })
export const useTransitionLayer = () => useContext(TransitionContext)
