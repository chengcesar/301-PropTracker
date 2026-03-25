import { activeContract } from '../../lib/finance'
import { useAppState } from '../../context/useAppState'

function PortfolioIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  )
}

export function Sidebar() {
  const { properties, selectedId, setSelectedId, setAddPropertyOpen } = useAppState()
  const withoutActive = properties.filter((p) => !activeContract(p)).length

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">PropFlow</div>
        <div className="logo-sub">rental manager</div>
      </div>
      <div className="sidebar-section">Portfolio</div>
      <div
        className={`sidebar-item${selectedId === 'portfolio' ? ' active' : ''}`}
        onClick={() => setSelectedId('portfolio')}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedId('portfolio')}
        role="button"
        tabIndex={0}
      >
        <PortfolioIcon />
        All properties
      </div>
      <div className="sidebar-section">Properties</div>
      {properties.map((p) => {
        const ac = activeContract(p)
        return (
          <div
            key={p.id}
            className={`sidebar-item${selectedId === p.id ? ' active' : ''}`}
            onClick={() => setSelectedId(p.id)}
            onKeyDown={(e) => e.key === 'Enter' && setSelectedId(p.id)}
            role="button"
            tabIndex={0}
          >
            <span className={`dot ${ac ? 'rented' : 'vacant'}`} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </span>
          </div>
        )
      })}
      <div className="sidebar-add">
        <button
          type="button"
          style={{ width: '100%', fontSize: '12px', color: 'var(--text3)' }}
          onClick={() => setAddPropertyOpen(true)}
        >
          + Add property
        </button>
      </div>
      <div className="sidebar-footer">
        <div>{properties.length} properties</div>
        <div style={{ marginTop: '2px' }}>{withoutActive} without active contract</div>
      </div>
    </aside>
  )
}
