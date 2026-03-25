import { AppStateProvider } from './context/AppStateProvider'
import { useAppState } from './context/useAppState'
import { AddPropertyModal } from './components/modals/AddPropertyModal'
import { PortfolioPage } from './pages/PortfolioPage'
import { PropertyPage } from './pages/PropertyPage'

function AppRoutes() {
  const { properties, selectedId, setSelectedId, updateProperty, addProperty, addPropertyOpen, setAddPropertyOpen } = useAppState()
  const activeProp = properties.find((p) => p.id === selectedId)

  return (
    <>
      <header className="app-header">
        <div className="app-header-logo">
          <div className="app-header-logo-mark">P</div>
          PropTracker
        </div>
        <div className="app-header-right">
          <span className="app-header-user">user@example.com</span>
          <button>Sign out</button>
        </div>
      </header>
      <div className="app-body">
        {selectedId === 'portfolio' ? (
          <PortfolioPage properties={properties} onSelectProperty={setSelectedId} />
        ) : activeProp ? (
          <PropertyPage key={activeProp.id} prop={activeProp} onUpdateProp={(fn) => updateProperty(activeProp.id, fn)} />
        ) : null}
        {addPropertyOpen && (
          <AddPropertyModal onSave={addProperty} onClose={() => setAddPropertyOpen(false)} />
        )}
      </div>
    </>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <AppRoutes />
    </AppStateProvider>
  )
}
