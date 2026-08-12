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

/**
 * Color a covered month by its own contract-year number (odd/even), not by where the anniversary
 * falls within its row. Always the green pair — past rows are already dimmed via the row's own
 * `opacity: 0.7`, so a separate muted palette here would risk looking like the vacant gray.
 */
function monthColor(yearIndex: number | null): string {
  if (yearIndex == null) return '#E2DED6'
  return yearIndex % 2 === 1 ? '#8FE0B8' : '#1A6B47'
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

  /** The calendar-year row matching prop.year, if the contract touches that year — drives the {year} tab's two-tone bar. */
  const currentYearRow = rows.find((r) => r.calendarYear === prop.year)

  const contractStart = new Date(`${contract.startDate}T12:00:00`)
  const contractEnd = new Date(`${contract.endDate}T12:00:00`)
  const durationYears = Math.round((contractEnd.getTime() - contractStart.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  const totalContractValue = rows.reduce((sum, r) => sum + r.annualTotal, 0)

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

        <div className="flex align-center gap8 mb4">
          <span className="badge active-c">Active</span>
          <span className="fs11 text3">{durationYears} {durationYears === 1 ? 'yr' : 'yrs'}</span>
        </div>
        <div className="fs12 text3 mb12">
          {contract.tenant || '—'} · {formatDate(contract.startDate)} → {formatDate(contract.endDate)} · {fmtCurrency(cx(contract.monthlyRent), displayCurrency ?? prop.currency)}/mo base · {contract.deposit} mo. deposit · {fmtCurrency(cx(totalContractValue), displayCurrency ?? prop.currency)} total
        </div>

        {tab === 'year' ? (
          <>
            <div className="month-bar-row mb8">
              {coverage.map(({ name }, i) => {
                const monthYearIndex = currentYearRow?.months[i]?.yearIndex ?? null
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      className="month-bar-seg"
                      style={{ background: monthColor(monthYearIndex) }}
                    />
                    <span className="fs11 text3">{name}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap16">
              <span className="fs11 text3 flex gap4 align-center">
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#8FE0B8' }} />
                Year 1, 3, 5…
              </span>
              <span className="fs11 text3 flex gap4 align-center">
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#1A6B47' }} />
                Year 2, 4, 6…
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
              const segments: { rent: number; yearIndex: number; count: number }[] = []
              for (const m of row.months) {
                if (m.rent == null || m.yearIndex == null) continue
                const last = segments[segments.length - 1]
                if (last && last.yearIndex === m.yearIndex) last.count += 1
                else segments.push({ rent: m.rent, yearIndex: m.yearIndex, count: 1 })
              }
              return (
                <div key={row.calendarYear} style={rowStyle}>
                  <div className="flex align-center" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div className="fw6 fs13">
                        {row.calendarYear} <span className="text3">Year {row.yearIndex}</span>
                      </div>
                      <div className="flex align-center gap8 fs11 text3" style={{ marginTop: 2 }}>
                        {segments.map((s, idx) => (
                          <span key={idx} className="flex align-center gap4">
                            {idx > 0 && <span>+</span>}
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: monthColor(s.yearIndex) }} />
                            {fmtCurrency(cx(s.rent), displayCurrency ?? prop.currency)}/mo × {s.count} mos
                          </span>
                        ))}
                      </div>
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
                          style={{ background: monthColor(month.yearIndex) }}
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
