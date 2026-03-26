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
          <svg width="24" height="24" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M36 56C36 55.4477 36.4477 55 37 55H54C54.5523 55 55 55.4477 55 56V82C55 82.5523 54.5523 83 54 83H37C36.4477 83 36 82.5523 36 82V56Z" fill="currentColor"/>
            <path d="M12 72C12 71.4477 12.4477 71 13 71H30C30.5523 71 31 71.4477 31 72V82C31 82.5523 30.5523 83 30 83H13C12.4477 83 12 82.5523 12 82L12 72Z" fill="currentColor"/>
            <path d="M59 45.8889C59 45.3366 59.4477 44.8889 60 44.8889H77C77.5523 44.8889 78 45.3366 78 45.8889V81.8889C78 82.4412 77.5523 82.8889 77 82.8889H60C59.4477 82.8889 59 82.4412 59 81.8889V45.8889Z" fill="currentColor"/>
            <path d="M12 40C12 21.7746 26.7746 7 45 7C62.5538 7 76.9064 20.7057 77.9404 37.9997C78.0063 39.1023 77.1046 40 76 40H60.4444C59.3399 40 58.4601 39.0993 58.2977 38.0068C57.3347 31.5268 51.7479 26.5556 45 26.5556C37.5748 26.5556 31.5556 32.5748 31.5556 40V64.5C31.5556 65.6046 30.6601 66.5 29.5556 66.5H14C12.8954 66.5 12 65.6046 12 64.5V40Z" fill="currentColor"/>
          </svg>
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
