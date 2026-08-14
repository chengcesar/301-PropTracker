import { Fragment, useMemo, useState } from 'react'
import type { Property } from '../lib/types'
import { type CurrencyCode, type FxRates, convert } from '../lib/currency'
import { activeContract } from '../lib/finance'
import { buildCapexAmortizationSchedule, capexAmortizationProgress } from '../lib/capexAmortization'
import { fmtCurrency } from '../lib/format'
import { setPendingPropertyTab } from '../lib/pendingTab'

type RowItem = {
  id: number
  desc: string
  cat: string
  amortizeBasis: 'manual' | 'contract' | null
  originalAmount: number
  remaining: number
  pctDepreciated: number | null
  moLeft: number | null
  monthlyCost: number
}

type Row = {
  property: Property
  itemCount: number
  totalAmount: number
  remaining: number
  pctDepreciated: number | null
  moLeft: number | null
  monthlyCost: number
  contractEndDate: string | null
  monthsAway: number | null
  items: RowItem[]
}

function formatMonthYear(dateStr?: string | null): string {
  if (!dateStr?.trim()) return '—'
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function buildRow(p: Property, dc: CurrencyCode, fx: FxRates): Row | null {
  const capitalized = p.capex.filter((c) => c.treatment === 'capitalize')
  if (capitalized.length === 0) return null

  const today = new Date()
  let totalAmount = 0
  let amortized = 0
  let remaining = 0
  let monthlyCost = 0
  let moLeft: number | null = null
  const items: RowItem[] = []

  for (const item of capitalized) {
    const schedule = buildCapexAmortizationSchedule(item, p.contracts)
    const amount = convert(item.amount, p.currency, dc, fx)
    totalAmount += amount
    if (!schedule) {
      remaining += amount
      items.push({
        id: item.id,
        desc: item.desc,
        cat: item.cat,
        amortizeBasis: item.amortizeBasis ?? null,
        originalAmount: amount,
        remaining: amount,
        pctDepreciated: null,
        moLeft: null,
        monthlyCost: 0,
      })
      continue
    }
    const progress = capexAmortizationProgress(schedule, today.getFullYear(), today.getMonth())
    const itemAmortized = convert(progress.amountAmortized, p.currency, dc, fx)
    const itemRemaining = convert(progress.amountLeft, p.currency, dc, fx)
    const itemMonthlyCost = convert(schedule.monthlyAmount, p.currency, dc, fx)
    const left = schedule.totalMonths - progress.monthsElapsed
    amortized += itemAmortized
    remaining += itemRemaining
    if (left > 0) {
      monthlyCost += itemMonthlyCost
      if (moLeft === null || left > moLeft) moLeft = left
    }
    items.push({
      id: item.id,
      desc: item.desc,
      cat: item.cat,
      amortizeBasis: item.amortizeBasis ?? null,
      originalAmount: amount,
      remaining: itemRemaining,
      pctDepreciated: progress.percent,
      moLeft: left > 0 ? left : 0,
      monthlyCost: left > 0 ? itemMonthlyCost : 0,
    })
  }

  const contract = activeContract(p)
  let monthsAway: number | null = null
  if (contract?.endDate) {
    const end = new Date(`${contract.endDate}T12:00:00`)
    monthsAway = (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth())
  }

  return {
    property: p,
    itemCount: capitalized.length,
    totalAmount,
    remaining,
    pctDepreciated: totalAmount > 0 ? (amortized / totalAmount) * 100 : null,
    moLeft,
    monthlyCost,
    contractEndDate: contract?.endDate ?? null,
    monthsAway,
    items,
  }
}

function progressColor(pct: number): string {
  if (pct >= 90) return 'var(--green)'
  if (pct >= 50) return '#3b82f6'
  return '#f59e0b'
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex align-center gap8" style={{ maxWidth: 220 }}>
      <div className="capex-progress-track" style={{ flex: 1 }}>
        <div className="capex-progress-fill" style={{ width: `${pct}%`, background: progressColor(pct) }} />
      </div>
      <span className="fs12 fw6" style={{ flexShrink: 0 }}>{Math.round(pct)}%</span>
    </div>
  )
}

const VISIBLE_COUNT = 9

export function PortfolioCapexDepreciationCard({
  properties,
  displayCurrency,
  fxRates,
  onSelectProperty,
}: {
  properties: Property[]
  displayCurrency: CurrencyCode
  fxRates: FxRates
  onSelectProperty: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [openRows, setOpenRows] = useState<Set<number>>(new Set())
  const fm = (n: number) => fmtCurrency(n, displayCurrency)

  const rows = useMemo(() => {
    return properties
      .map((p) => buildRow(p, displayCurrency, fxRates))
      .filter((r): r is Row => r !== null)
      .sort((a, b) => (b.moLeft ?? -1) - (a.moLeft ?? -1))
  }, [properties, displayCurrency, fxRates])

  if (rows.length === 0) return null

  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_COUNT)
  const itemsTotal = rows.reduce((a, r) => a + r.itemCount, 0)
  const remainingTotal = rows.reduce((a, r) => a + r.remaining, 0)
  const monthlyCostTotal = rows.reduce((a, r) => a + r.monthlyCost, 0)

  const toggleRow = (id: number) => {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="card mt24 mb24">
      <div className="card-inner">
        <div className="sec-title mb12">CapEx Depreciation</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Location</th>
                <th style={{ textAlign: 'left' }}>Contract ends</th>
                <th>CapEx remaining</th>
                <th style={{ textAlign: 'left' }}>% Depreciated</th>
                <th>Mo. left</th>
                <th>Mo. CapEx cost</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const isOpen = openRows.has(r.property.id)
                const openProperty = () => {
                  setPendingPropertyTab('capex')
                  onSelectProperty(r.property.id)
                }
                return (
                  <Fragment key={r.property.id}>
                    <tr onClick={openProperty} style={{ cursor: 'pointer' }}>
                      <td style={{ textAlign: 'left' }}>
                        <div className="flex gap8" style={{ alignItems: 'flex-start' }}>
                          <button
                            type="button"
                            className="ghost"
                            style={{
                              padding: 2,
                              border: 'none',
                              background: 'transparent',
                              fontSize: 16,
                              lineHeight: 1,
                              color: 'var(--accent-bg)',
                              flexShrink: 0,
                            }}
                            title={isOpen ? 'Collapse' : 'Expand'}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleRow(r.property.id)
                            }}
                          >
                            {isOpen ? '▾' : '▸'}
                          </button>
                          <div>
                            <div className="fw6">{r.property.name}</div>
                            <div className="fs11 text3">
                              {r.property.factSheet?.propertyType ? `${r.property.factSheet.propertyType} · ` : ''}
                              {r.itemCount} item{r.itemCount === 1 ? '' : 's'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <div className="fw5">{formatMonthYear(r.contractEndDate)}</div>
                        <div className="fs11 text3">{r.monthsAway != null ? `${r.monthsAway} mos away` : '—'}</div>
                      </td>
                      <td>
                        <div className="fw6">{fm(r.remaining)}</div>
                        <div className="fs11 text3">of {fm(r.totalAmount)} total</div>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        {r.pctDepreciated != null ? <ProgressBar pct={r.pctDepreciated} /> : '—'}
                      </td>
                      <td>{r.moLeft != null ? `${r.moLeft} mos` : '—'}</td>
                      <td>{r.monthlyCost > 0 ? `${fm(r.monthlyCost)} / mo` : '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: 'var(--surface2)' }}>
                          <table className="cf-table" style={{ width: '100%' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Item</th>
                                <th style={{ textAlign: 'left' }}>Amort. basis</th>
                                <th>Original amt</th>
                                <th>Remaining</th>
                                <th style={{ textAlign: 'left' }}>Progress</th>
                                <th>Mo. left</th>
                                <th>Mo. cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.items.map((it) => (
                                <tr key={it.id}>
                                  <td style={{ textAlign: 'left' }}>
                                    <span className="fw5">{it.desc}</span>{' '}
                                    <span className="fs11 text3">· {it.cat}</span>
                                  </td>
                                  <td style={{ textAlign: 'left' }} className="fs12 text3">
                                    {it.amortizeBasis === 'contract' ? 'Contract' : it.amortizeBasis === 'manual' ? 'Manual' : '—'}
                                  </td>
                                  <td>{fm(it.originalAmount)}</td>
                                  <td className="fw6">{fm(it.remaining)}</td>
                                  <td style={{ textAlign: 'left' }}>
                                    {it.pctDepreciated != null ? <ProgressBar pct={it.pctDepreciated} /> : '—'}
                                  </td>
                                  <td>{it.moLeft != null ? `${it.moLeft} mos` : '—'}</td>
                                  <td>{it.monthlyCost > 0 ? fm(it.monthlyCost) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {!expanded && rows.length > VISIBLE_COUNT && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              type="button"
              className="ghost"
              style={{ color: 'var(--accent-bg)', fontWeight: 600 }}
              onClick={() => setExpanded(true)}
            >
              Show all {rows.length} properties
            </button>
          </div>
        )}
        <div className="fs12 text3 mt12" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {rows.length} properties · CapEx {itemsTotal} items · Portfolio remaining: {fm(remainingTotal)} · Total monthly CapEx cost: {fm(monthlyCostTotal)} / mo
        </div>
      </div>
    </div>
  )
}
