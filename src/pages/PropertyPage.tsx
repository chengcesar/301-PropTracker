import { useState } from 'react'
import type { Property } from '../lib/types'
import { type CurrencyCode, type FxRates, loadFxRates, convert } from '../lib/currency'
import { useAppState } from '../context/useAppState'
import { activeContract } from '../lib/finance'
import { getYearWindow } from '../lib/constants'
import { ContractsTab } from '../components/property/ContractsTab'
import { CashflowTab } from '../components/property/CashflowTab'
import { OpexCapexTab } from '../components/property/OpexCapexTab'
import { OverviewTab } from '../components/property/OverviewTab'
import { TaxesTab } from '../components/property/TaxesTab'
import { ServicesTab } from '../components/property/ServicesTab'
import { FactSheetTab } from '../components/property/FactSheetTab'
import { ValueEquityTab } from '../components/property/ValueEquityTab'

type TabId = 'overview' | 'contracts' | 'cashflow' | 'opex' | 'taxes' | 'services' | 'valuation' | 'factsheet'

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
  ['valuation', 'Value & Equity'],
  ['factsheet', 'Fact Sheet'],
]

export function PropertyPage({ prop, onUpdateProp }: Props) {
  const [tab, setTab] = useState<TabId>('overview')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const active = activeContract(prop)
  const { setSelectedId } = useAppState()
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(prop.currency)
  const [fxRates] = useState<FxRates>(loadFxRates)
  const cx = (n: number) => displayCurrency === prop.currency ? n : convert(n, prop.currency, displayCurrency, fxRates)
  const yearWindow = getYearWindow(prop.year)

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
          <button type="button" className="year-chevron" onClick={() => onUpdateProp((p) => ({ ...p, year: p.year - 1 }))}>‹</button>
          {yearWindow.map((y) => (
            <button
              key={y}
              type="button"
              className={`year-btn${prop.year === y ? ' active' : ''}`}
              onClick={() => onUpdateProp((p) => ({ ...p, year: y }))}
            >
              {y}
            </button>
          ))}
          <button type="button" className="year-chevron" onClick={() => onUpdateProp((p) => ({ ...p, year: p.year + 1 }))}>›</button>
          {prop.currency !== 'USD' && (
            <>
              <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
              <div
                style={{
                  display: 'inline-flex', borderRadius: 20, padding: 2,
                  background: '#e8ecf2', cursor: 'pointer', position: 'relative',
                }}
              >
                {([prop.currency, 'USD'] as CurrencyCode[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDisplayCurrency(c)}
                    style={{
                      position: 'relative', zIndex: 1, padding: '4px 14px',
                      fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 18,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: displayCurrency === c ? '#fff' : 'transparent',
                      color: displayCurrency === c ? '#1a1d23' : '#6b7280',
                      boxShadow: displayCurrency === c ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
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
        {tab === 'overview' && <OverviewTab prop={prop} onUpdateProp={onUpdateProp} cx={cx} displayCurrency={displayCurrency} />}
        {tab === 'contracts' && <ContractsTab prop={prop} onUpdateProp={onUpdateProp} />}
        {tab === 'cashflow' && <CashflowTab prop={prop} cx={cx} displayCurrency={displayCurrency} />}
        {tab === 'opex' && <OpexCapexTab prop={prop} onUpdateProp={onUpdateProp} cx={cx} displayCurrency={displayCurrency} />}
        {tab === 'taxes' && <TaxesTab prop={prop} onUpdateProp={onUpdateProp} cx={cx} displayCurrency={displayCurrency} />}
        {tab === 'services' && <ServicesTab prop={prop} onUpdateProp={onUpdateProp} cx={cx} displayCurrency={displayCurrency} />}
        {tab === 'valuation' && <ValueEquityTab prop={prop} onUpdateProp={onUpdateProp} cx={cx} displayCurrency={displayCurrency} />}
        {tab === 'factsheet' && <FactSheetTab prop={prop} onUpdateProp={onUpdateProp} cx={cx} displayCurrency={displayCurrency} />}
      </div>
    </div>
  )
}
