import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SharedViewProvider } from '../context/SharedViewProvider'
import { PortfolioPage } from './PortfolioPage'
import { PropertyPage } from './PropertyPage'
import AuthHeader from '../components/AuthHeader'
import { useAppState } from '../context/useAppState'

function SharedContent() {
  const { properties, selectedId, setSelectedId } = useAppState()
  const navigate = useNavigate()
  const activeProp = typeof selectedId === 'number' ? properties.find((p) => p.id === selectedId) : undefined

  useEffect(() => {
    if (typeof selectedId === 'number' && !activeProp) setSelectedId('portfolio')
  }, [selectedId, activeProp, setSelectedId])

  return (
    <>
      <AuthHeader />
      <div className="shared-view-banner">
        <span className="shared-view-badge">👁 View only</span>
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
  const { user } = useAuth() as unknown as { user: any }
  const navigate = useNavigate()

  if (!user) {
    navigate(`/login?redirect=/shared/${shareId}`)
    return null
  }

  return (
    <SharedViewProvider shareId={shareId!}>
      <SharedContent />
    </SharedViewProvider>
  )
}
