import { useState } from 'react'
import type { Property } from '../lib/types'
import { useAppState } from '../context/useAppState'
import { activeContract } from '../lib/finance'
import { YEAR_OPTIONS } from '../lib/constants'
import { ContractsTab } from '../components/property/ContractsTab'
import { CashflowTab } from '../components/property/CashflowTab'
import { OpexCapexTab } from '../components/property/OpexCapexTab'
import { OverviewTab } from '../components/property/OverviewTab'
import { TaxesTab } from '../components/property/TaxesTab'
import { ServicesTab } from '../components/property/ServicesTab'
import { FactSheetTab } from '../components/property/FactSheetTab'

type TabId = 'overview' | 'contracts' | 'cashflow' | 'opex' | 'taxes' | 'services' | 'factsheet'

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
}

const TABS: [TabId, string][] = [
  ['overview', 'Overview'],
  ['contracts', 'Contracts'],
  ['cashflow', 'Cashflow'],
  ['opex', 'OPEX / CAPEX'],
  ['taxes', 'Taxes'],
  ['services', 'Services'],
]

const RIGHT_TABS: [TabId, string][] = [
  ['factsheet', 'Fact Sheet'],
]

export function PropertyPage({ prop, onUpdateProp }: Props) {
  const [tab, setTab] = useState<TabId>('overview')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const active = activeContract(prop)
  const { setSelectedId } = useAppState()

  const startEditName = () => {
    setNameDraft(prop.name)
    setEditingName(true)
  }

  const saveName = () => {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== prop.name) {
      onUpdateProp((p) => ({ ...p, name: trimmed }))
    }
    setEditingName(false)
  }

  const cancelEditName = () => setEditingName(false)

  return (
    <div className="flex-col" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px 0', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <div>
          <button
            className="ghost"
            style={{ padding: '2px 0', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}
            onClick={() => setSelectedId('portfolio')}
          >
            ← Back to Portfolio
          </button>
          {editingName ? (
            <div className="flex align-center gap8">
              <input
                autoFocus
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') cancelEditName()
                }}
                style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', padding: '2px 8px', borderRadius: 8, border: '1px solid #e8ecf2', background: '#f7f9fc', width: 320 }}
              />
              <button type="button" className="primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={saveName}>Save</button>
              <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={cancelEditName}>Cancel</button>
            </div>
          ) : (
            <div className="flex align-center gap8">
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>{prop.name}</span>
              <button
                type="button"
                className="ghost"
                style={{ padding: '2px 6px', fontSize: 14, color: 'var(--text3)' }}
                onClick={startEditName}
                title="Edit property name"
              >
                ✎
              </button>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {prop.address} · {prop.bedrooms}BR / {prop.bathrooms}BA · {prop.area} m² · {active ? active.tenant : prop.occupant ? `${prop.occupant.name} (${prop.occupant.relation})` : 'Vacant'}
          </div>
        </div>
        <div className="flex gap8 align-center">
          {YEAR_OPTIONS.map((y) => (
            <button
              key={y}
              type="button"
              className={`year-btn${prop.year === y ? ' active' : ''}`}
              onClick={() => onUpdateProp((p) => ({ ...p, year: y }))}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {RIGHT_TABS.map(([id, label]) => (
          <button key={id} type="button" className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="content">
        {tab === 'overview' && <OverviewTab prop={prop} onUpdateProp={onUpdateProp} />}
        {tab === 'contracts' && <ContractsTab prop={prop} onUpdateProp={onUpdateProp} />}
        {tab === 'cashflow' && <CashflowTab prop={prop} />}
        {tab === 'opex' && <OpexCapexTab prop={prop} onUpdateProp={onUpdateProp} />}
        {tab === 'taxes' && <TaxesTab prop={prop} onUpdateProp={onUpdateProp} />}
        {tab === 'services' && <ServicesTab prop={prop} onUpdateProp={onUpdateProp} />}
        {tab === 'factsheet' && <FactSheetTab prop={prop} onUpdateProp={onUpdateProp} />}
      </div>
    </div>
  )
}
