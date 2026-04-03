import { createContext } from 'react'
import type { Property } from '../lib/types'

export type Selection = 'portfolio' | 'contacts' | number

export type AppStateContextValue = {
  properties: Property[]
  selectedId: Selection
  setSelectedId: (id: Selection) => void
  updateProperty: (id: number, fn: (p: Property) => Property) => void
  addProperty: (p: Property) => void
  removeProperty: (id: number) => void
  addPropertyOpen: boolean
  setAddPropertyOpen: (v: boolean) => void
}

export const AppStateContext = createContext<AppStateContextValue | null>(null)
