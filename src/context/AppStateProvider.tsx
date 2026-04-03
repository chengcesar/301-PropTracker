import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Property } from '../lib/types'
import { AppStateContext, type Selection } from './app-state-context'
import { subscribeProperties, saveProperty, removePropertyDoc } from '../services/propertyService'
import { createSeedProperties } from '../lib/seedProperties'

function selectionFromHash(): Selection {
  const hash = window.location.hash
  if (hash === '#contacts') return 'contacts'
  const match = hash.match(/^#property\/(\d+)$/)
  return match ? Number(match[1]) : 'portfolio'
}

function hashFromSelection(id: Selection): string {
  if (id === 'contacts') return '#contacts'
  return id === 'portfolio' ? '#' : `#property/${id}`
}

export function AppStateProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedIdRaw] = useState<Selection>(selectionFromHash)
  const [addPropertyOpen, setAddPropertyOpen] = useState(false)

  // Track whether Firestore snapshot has loaded to avoid writing back initial state
  const snapshotLoaded = useRef(false)

  const setSelectedId = useCallback((id: Selection) => {
    setSelectedIdRaw(id)
    window.history.pushState(null, '', hashFromSelection(id))
  }, [])

  // Subscribe to Firestore real-time updates; seed sample data for new users
  const seeded = useRef(false)
  useEffect(() => {
    snapshotLoaded.current = false
    seeded.current = false
    setLoading(true)
    const unsub = subscribeProperties(uid, (props) => {
      if (props.length === 0 && !seeded.current) {
        seeded.current = true
        const samples = createSeedProperties()
        samples.forEach((p) => saveProperty(uid, p))
        // Firestore listener will fire again with the saved data
        return
      }
      setProperties(props)
      snapshotLoaded.current = true
      setLoading(false)
    })
    return unsub
  }, [uid])

  // Hash-based navigation
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
    setProperties((ps) => {
      const updated = ps.map((p) => {
        if (p.id !== id) return p
        const next = fn(p)
        // Fire-and-forget save to Firestore
        saveProperty(uid, next)
        return next
      })
      return updated
    })
  }, [uid])

  const addProperty = useCallback((p: Property) => {
    setProperties((ps) => [...ps, p])
    setSelectedId(p.id)
    saveProperty(uid, p)
  }, [uid, setSelectedId])

  const removeProperty = useCallback((id: number) => {
    setProperties((ps) => ps.filter((p) => p.id !== id))
    setSelectedIdRaw((cur) => (cur === id ? 'portfolio' : cur))
    removePropertyDoc(uid, id)
  }, [uid])

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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#6b7280', fontSize: 14 }}>
        Loading portfolio…
      </div>
    )
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
