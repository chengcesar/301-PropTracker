import { useState } from 'react'
import { MONTHS } from '../../lib/constants'
import type { Contract, Property } from '../../lib/types'
import { contractForMonth } from '../../lib/finance'
import { fmtCurrency } from '../../lib/format'

type Props = {
  prop: Property
  contract: Contract
  onUpdateProp: (fn: (p: Property) => Property) => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ActiveContractCard({ prop, contract, onUpdateProp }: Props) {
  // Not used yet — wired up in Task 13 for saving per-year contract overrides.
  // `noUnusedParameters` in tsconfig.app.json errors on the unused destructured
  // param, so we reference it here; remove this line once Task 13 uses it.
  void onUpdateProp
  const [tab, setTab] = useState<'year' | 'full'>('year')

  const coverage = MONTHS.map((name, i) => ({
    name,
    contract: contractForMonth(prop.contracts, prop.year, i),
  }))
  const coveredCount = coverage.filter((c) => c.contract).length

  return (
    <div className="card">
      <div className="card-inner">
        <div className="flex align-center" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="fw6" style={{ fontSize: '14px' }}>Active contract</div>
          <div className="flex" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              className={tab === 'year' ? 'primary' : 'ghost'}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 0 }}
              onClick={() => setTab('year')}
            >
              {prop.year}
            </button>
            <button
              type="button"
              className={tab === 'full' ? 'primary' : 'ghost'}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 0 }}
              onClick={() => setTab('full')}
            >
              Full contract
            </button>
          </div>
        </div>

        <div className="fs12 text3 mb12">
          {formatDate(contract.startDate)} → {formatDate(contract.endDate)} · {fmtCurrency(contract.monthlyRent, prop.currency)}/mo base
        </div>

        {tab === 'year' ? (
          <>
            <div className="month-bar-row mb8">
              {coverage.map(({ name, contract: c }, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div className="month-bar-seg" style={{ background: c ? '#1A6B47' : '#E2DED6' }} />
                  <span className="fs11 text3">{name}</span>
                </div>
              ))}
            </div>
            <div className="flex gap16">
              <span className="fs11 text3 flex gap4 align-center">
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#1A6B47' }} />
                Covered
              </span>
              <span className="fs11 text3 flex gap4 align-center">
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#E2DED6' }} />
                Vacant / no contract
              </span>
              <span className="fs11 text3 mono" style={{ marginLeft: 'auto' }}>
                {coveredCount} / 12 months covered
              </span>
            </div>
          </>
        ) : (
          <div className="fs12 text3">Full contract view coming up next.</div>
        )}
      </div>
    </div>
  )
}
