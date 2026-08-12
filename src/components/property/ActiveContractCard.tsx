import { useState } from 'react'
import { MONTHS } from '../../lib/constants'
import type { Contract, Property } from '../../lib/types'
import { contractForMonth, contractYearRows } from '../../lib/finance'
import { type CurrencyCode } from '../../lib/currency'
import { fmtCurrency } from '../../lib/format'

type Props = {
  prop: Property
  contract: Contract
  onUpdateProp: (fn: (p: Property) => Property) => void
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ActiveContractCard({ prop, contract, onUpdateProp, cx = (n) => n, displayCurrency }: Props) {
  const [tab, setTab] = useState<'year' | 'full'>('year')
  const [draftOverrides, setDraftOverrides] = useState<Record<number, string>>({})

  const coverage = MONTHS.map((name, i) => ({
    name,
    contract: contractForMonth(prop.contracts, prop.year, i),
  }))
  const coveredCount = coverage.filter((c) => c.contract).length

  const setYearOverride = (yearIndex: number, pct: number) => {
    onUpdateProp((p) => ({
      ...p,
      contracts: p.contracts.map((c) =>
        c.id === contract.id
          ? { ...c, yearOverrides: { ...(c.yearOverrides ?? {}), [yearIndex]: pct } }
          : c,
      ),
    }))
  }

  const rows = contractYearRows(contract, new Date())

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
          {contract.tenant || '—'} · {formatDate(contract.startDate)} → {formatDate(contract.endDate)} · {fmtCurrency(cx(contract.monthlyRent), displayCurrency ?? prop.currency)}/mo base · {contract.deposit} mo. deposit
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((row) => {
              const rowStyle: React.CSSProperties = row.isCurrent
                ? { border: '1px solid #1A6B47', background: '#f0fdf4', borderRadius: 10, padding: 12 }
                : row.isFuture
                  ? { border: '1px solid var(--purple)', background: 'var(--purple-bg)', borderRadius: 10, padding: 12 }
                  : { border: '1px solid var(--border)', borderRadius: 10, padding: 12, opacity: 0.7 }
              return (
                <div key={row.calendarYear} style={rowStyle}>
                  <div className="flex align-center" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <div className="fw6 fs13">
                      {row.calendarYear} <span className="text3">Year {row.yearIndex}</span>
                    </div>
                    <div className="flex align-center gap8">
                      <label className="fs11 text3">Increment %</label>
                      <input
                        type="number"
                        step={0.1}
                        value={draftOverrides[row.yearIndex] ?? row.incrementPct}
                        onChange={(e) => {
                          const raw = e.target.value
                          setDraftOverrides((d) => ({ ...d, [row.yearIndex]: raw }))
                          const parsed = parseFloat(raw)
                          if (!Number.isNaN(parsed)) setYearOverride(row.yearIndex, parsed)
                        }}
                        onBlur={() =>
                          setDraftOverrides((d) => {
                            const next = { ...d }
                            delete next[row.yearIndex]
                            return next
                          })
                        }
                        style={{ width: 60, fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                      <span className="fs11 text3">+{row.defaultIncrementPct}% default</span>
                      <span className="fs12 fw5">= {fmtCurrency(cx(row.annualTotal), displayCurrency ?? prop.currency)} / yr</span>
                    </div>
                  </div>
                  <div className="flex" style={{ gap: 2 }}>
                    {row.months.map((month, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div
                          className="month-bar-seg"
                          title={month.rent != null ? fmtCurrency(cx(month.rent), displayCurrency ?? prop.currency) : 'No contract'}
                          style={{
                            background:
                              month.rent == null
                                ? '#E2DED6'
                                : row.isPast
                                  ? '#c8c2b6'
                                  : '#1A6B47',
                          }}
                        />
                        <span className="fs11 text3">{MONTHS[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
