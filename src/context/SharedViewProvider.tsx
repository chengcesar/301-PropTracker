import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getShare } from '../services/sharesService'
import { subscribeProperties } from '../services/propertyService'
import { applyShareFilters } from '../lib/shareFilters'
import { AppStateContext, type Selection } from './app-state-context'
import { ReadOnlyContext } from './ReadOnlyContext'
import type { Share, Property } from '../lib/types'

const ShareInfoContext = createContext<Share | null>(null)
export function useShareInfo(): Share | null {
  return useContext(ShareInfoContext)
}

type Props = {
  shareId: string
  children: ReactNode
}

export function SharedViewProvider({ shareId, children }: Props) {
  const { user } = useAuth() as unknown as { user: any }
  const navigate = useNavigate()
  const [share, setShare] = useState<Share | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedIdRaw] = useState<Selection>('portfolio')

  useEffect(() => {
    if (!user) return
    getShare(shareId).then((s) => {
      if (!s) { setError('Share not found.'); setLoading(false); return }
      if (s.status === 'revoked') { setError('Access to this portfolio has been removed.'); setLoading(false); return }
      if (s.granteeUid !== user.uid) { setError('You do not have access to this share.'); setLoading(false); return }
      setShare(s)
    })
  }, [shareId, user])

  useEffect(() => {
    if (!share) return
    const unsub = subscribeProperties(share.ownerUid, (props) => {
      const filtered = applyShareFilters(props, share.scope, share.filters, share.propertyIds)
      setProperties(filtered)
      setLoading(false)
    })
    return () => unsub()
  }, [share])

  const setSelectedId = useCallback((id: Selection) => {
    setSelectedIdRaw(id)
  }, [])

  const contextValue = useMemo(() => ({
    properties,
    selectedId,
    setSelectedId,
    updateProperty: () => {},
    addProperty: () => {},
    removeProperty: () => {},
    addPropertyOpen: false,
    setAddPropertyOpen: () => {},
  }), [properties, selectedId, setSelectedId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#6b7280', fontSize: 14 }}>
        Loading shared portfolio…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <p style={{ color: '#374151', fontSize: 15 }}>{error}</p>
        <button className="add-btn" onClick={() => navigate('/')}>Back to my portfolio</button>
      </div>
    )
  }

  return (
    <ReadOnlyContext.Provider value={true}>
      <AppStateContext.Provider value={contextValue}>
        <ShareInfoContext.Provider value={share}>
          {children}
        </ShareInfoContext.Provider>
      </AppStateContext.Provider>
    </ReadOnlyContext.Provider>
  )
}
