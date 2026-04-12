import { useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SharedViewProvider, useShareInfo } from '../context/SharedViewProvider'
import { PortfolioPage } from './PortfolioPage'
import { PropertyPage } from './PropertyPage'
import AuthHeader from '../components/AuthHeader'
import { useAppState } from '../context/useAppState'

function SharedContent() {
  const { properties, selectedId, setSelectedId } = useAppState()
  const navigate = useNavigate()
  const shareInfo = useShareInfo()
  const activeProp = typeof selectedId === 'number' ? properties.find((p) => p.id === selectedId) : undefined

  useEffect(() => {
    if (typeof selectedId === 'number' && !activeProp) setSelectedId('portfolio')
  }, [selectedId, activeProp, setSelectedId])

  return (
    <>
      <AuthHeader />
      <div className="shared-view-banner">
        <span className="shared-view-badge">👁 View only</span>
        {shareInfo && (
          <span className="shared-view-label">{shareInfo.ownerPortfolioName}</span>
        )}
        <button className="shared-view-back" onClick={() => navigate('/')}>← Back to my portfolio</button>
      </div>
      <div className="app-body">
        {activeProp ? (
          <PropertyPage
            key={activeProp.id}
            prop={activeProp}
            onUpdateProp={() => {}}
          />
        ) : (
          <PortfolioPage
            properties={properties}
            onSelectProperty={setSelectedId}
          />
        )}
      </div>
    </>
  )
}

export function SharedPortfolioPage() {
  const { shareId } = useParams<{ shareId: string }>()
  const { user, loading: authLoading } = useAuth() as unknown as { user: any; loading: boolean }

  if (authLoading) return null

  if (!user) {
    return <Navigate to={`/login?redirect=/shared/${shareId}`} replace />
  }

  return (
    <SharedViewProvider shareId={shareId!}>
      <SharedContent />
    </SharedViewProvider>
  )
}
