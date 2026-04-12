import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AppStateProvider } from './context/AppStateProvider'
import { useAppState } from './context/useAppState'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import AdminDesignSystemPage from './pages/AdminDesignSystemPage'
import AdminLayout from './components/admin/AdminLayout'
import AuthHeader from './components/AuthHeader'
import { PortfolioPage } from './pages/PortfolioPage'
import { PropertyPage } from './pages/PropertyPage'
import { ContactsPage } from './pages/ContactsPage'
import { AddPropertyModal } from './components/modals/AddPropertyModal'
import { UpgradeModal } from './components/modals/UpgradeModal'
import type { UpgradeReason } from './components/modals/UpgradeModal'
import { useEntitlements } from './hooks/useEntitlements'
import { SharedPortfolioPage } from './pages/SharedPortfolioPage'

function AppContent() {
  const { properties, selectedId, setSelectedId, updateProperty, addProperty, addPropertyOpen, setAddPropertyOpen } = useAppState()
  const { canAddProperty } = useEntitlements()
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null)
  const activeProp = properties.find((p) => p.id === selectedId)
  const showContacts = selectedId === 'contacts'
  const showPortfolio = !showContacts && (selectedId === 'portfolio' || !activeProp)

  useEffect(() => {
    if (selectedId !== 'portfolio' && selectedId !== 'contacts' && !activeProp) {
      setSelectedId('portfolio')
    }
  }, [selectedId, activeProp, setSelectedId])

  function handleOpenAddProperty() {
    if (!canAddProperty) { setUpgradeReason('property-limit'); return }
    setAddPropertyOpen(true)
  }

  return (
    <>
      <AuthHeader />
      <div className="app-body">
        {showContacts ? (
          <ContactsPage />
        ) : showPortfolio ? (
          <PortfolioPage
            properties={properties}
            onSelectProperty={setSelectedId}
            onAddProperty={handleOpenAddProperty}
          />
        ) : (
          <PropertyPage key={activeProp!.id} prop={activeProp!} onUpdateProp={(fn) => updateProperty(activeProp!.id, fn)} />
        )}
        {addPropertyOpen && (
          <AddPropertyModal onSave={addProperty} onClose={() => setAddPropertyOpen(false)} />
        )}
        {upgradeReason && (
          <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />
        )}
      </div>
    </>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth() as unknown as { user: any; loading: boolean }
  if (loading) return (
    <div className="app-loading">
      <svg width="48" height="48" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="65.6367" y="30.0342" width="12.3568" height="52.4532" fill="#6D2F20"/>
        <rect x="38.832" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
        <rect x="12" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
        <path d="M78.001 30.3232H65.623C65.5666 22.9727 59.5914 17.0313 52.2275 17.0312C44.8636 17.0312 38.8884 22.9726 38.832 30.3232H24.332V7H78.001V30.3232Z" fill="#6D2F20"/>
      </svg>
      <div className="app-loading-spinner" />
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminPage />} />
        <Route path="design-system" element={<AdminDesignSystemPage />} />
      </Route>
      <Route path="/shared/:shareId" element={<SharedPortfolioPage />} />
      <Route
        path="/"
        element={
          user ? (
            <AppStateProvider uid={user.uid}>
              <AppContent />
            </AppStateProvider>
          ) : (
            <LandingPage />
          )
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
