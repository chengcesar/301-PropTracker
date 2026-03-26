import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { seedProperties } from '../data/seedProperties'
import type { Property } from '../lib/types'
import { AppStateContext, type Selection } from './app-state-context'

const STORAGE_KEY = 'proptracker-properties'

/** Migrate old taxes shape { predial, incomeTax } → { items } */
function migrateTaxes(p: any): Property {
  if (p.taxes && !Array.isArray(p.taxes.items)) {
    const predial = p.taxes.predial ?? 0
    p.taxes = {
      items: predial
        ? [{ id: Date.now() + p.id, taxId: p.name ?? 'Predial', amount: predial, dueDate: '', status: 'pending' as const }]
        : [],
    }
  }
  return p as Property
}

/** Migrate properties without currency / country fields */
function migrateCurrency(p: any): Property {
  if (!p.currency) p.currency = 'COP'
  if (!p.country) p.country = 'Colombia'
  return p as Property
}

function loadProperties(): Property[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(migrateTaxes).map(migrateCurrency)
    }
  } catch { /* ignore corrupted data */ }
  return seedProperties()
}

function selectionFromHash(): Selection {
  const hash = window.location.hash
  const match = hash.match(/^#property\/(\d+)$/)
  return match ? Number(match[1]) : 'portfolio'
}

function hashFromSelection(id: Selection): string {
  return id === 'portfolio' ? '#' : `#property/${id}`
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>(loadProperties)
  const [selectedId, setSelectedIdRaw] = useState<Selection>(selectionFromHash)
  const [addPropertyOpen, setAddPropertyOpen] = useState(false)

  const setSelectedId = useCallback((id: Selection) => {
    setSelectedIdRaw(id)
    window.history.pushState(null, '', hashFromSelection(id))
  }, [])

  // Persist properties to localStorage on change (skip initial load)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(properties))
    } catch { /* storage full — silently fail */ }
  }, [properties])

  useEffect(() => {
    const onHashChange = () => setSelectedIdRaw(selectionFromHash())
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('popstate', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('popstate', onHashChange)
    }
  }, [])

  const updateProperty = useCallback((id: number, fn: (p: Property) => Property) => {
    setProperties((ps) => ps.map((p) => (p.id === id ? fn(p) : p)))
  }, [])

  const addProperty = useCallback((p: Property) => {
    setProperties((ps) => [...ps, p])
    setSelectedId(p.id)
  }, [])

  const removeProperty = useCallback((id: number) => {
    setProperties((ps) => ps.filter((p) => p.id !== id))
    setSelectedIdRaw((cur) => (cur === id ? 'portfolio' : cur))
  }, [])

  const value = useMemo(
    () => ({
      properties,
      selectedId,
      setSelectedId,
      updateProperty,
      addProperty,
      removeProperty,
      addPropertyOpen,
      setAddPropertyOpen,
    }),
    [properties, selectedId, updateProperty, addProperty, removeProperty, addPropertyOpen],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
