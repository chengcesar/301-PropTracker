import { useContext } from 'react'
import { AppStateContext, type AppStateContextValue } from './app-state-context'

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
