import { useRef, useState } from 'react'
import { MONTHS, MONTHS_FULL } from '../../lib/constants'
import type { MonthData, Occupant, Property } from '../../lib/types'
import { activeContract, calcAnnual, contractForMonth, estimatedPropertyValueAtYear, expenseRowsForYear, getMonthData, projectedGpiAnnual, rentOnDate, resolveServices, sumMaintenanceForMonth, sumServiceOneTimeForMonth, vacancyLossMonthCount, yearMonths } from '../../lib/finance'
import { type CurrencyCode } from '../../lib/currency'
import { fmt, fmtCurrencyM } from '../../lib/format'
import { MonthModal } from '../modals/MonthModal'
import { OccupantModal } from '../modals/OccupantModal'
import { KpiInfoIcon } from '../KpiInfoIcon'
import { useReadOnly } from '../../context/ReadOnlyContext'
import { ActiveContractSummaryCard } from './ActiveContractSummaryCard'

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function OverviewTab({ prop, onUpdateProp, cx = (n) => n, displayCurrency }: Props) {
  const readOnly = useReadOnly()
  const dc = displayCurrency ?? prop.currency
  const ann = calcAnnual(prop)
  const gpiDisplay = projectedGpiAnnual(prop)
  const vacancyMonths = vacancyLossMonthCount(prop)
  const valueEst = estimatedPropertyValueAtYear(prop, prop.year)
  const capRatePct =
    valueEst.value != null &&
    valueEst.value > 0 &&
    Number.isFinite(ann.noi) &&
    Number.isFinite(cx(ann.noi)) &&
    Number.isFinite(cx(valueEst.value))
      ? (cx(ann.noi) / cx(valueEst.value)) * 100
      : null
  const [monthModal, setMonthModal] = useState<number | null>(null)
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [editCell, setEditCell] = useState<{ row: string; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [newCatName, setNewCatName] = useState('')
  const [showAddRow, setShowAddRow] = useState(false)
  const [editIncome, setEditIncome] = useState<number | null>(null)
  const [editIncomeValue, setEditIncomeValue] = useState('')
  const incomeInputRef = useRef<HTMLInputElement>(null)
  const [occModal, setOccModal] = useState(false)
  const active = activeContract(prop)
  const [editingOwner, setEditingOwner] = useState(false)
  const [ownerDraft, setOwnerDraft] = useState('')
  const [editingGroup, setEditingGroup] = useState(false)
  const [groupDraft, setGroupDraft] = useState('')

  const saveMonth = (mIdx: number, data: MonthData) => {
    onUpdateProp((p) => {
      const ym = p.months[p.year] ?? {}
      return { ...p, months: { ...p.months, [p.year]: { ...ym, [mIdx]: data } } }
    })
  }

  const startIncomeEdit = (mIdx: number, currentVal: number) => {
    setEditIncome(mIdx)
    setEditIncomeValue(currentVal ? String(currentVal) : '')
    setTimeout(() => incomeInputRef.current?.focus(), 0)
  }

  const commitIncomeEdit = () => {
    if (editIncome === null) return
    const val = Number(editIncomeValue.replace(/[,.\s]/g, '')) || 0
    const mIdx = editIncome
    onUpdateProp((p) => {
      const ym = p.months[p.year] ?? {}
      const existing = ym[mIdx] ?? { status: 'rented' as const, incomeOverride: null, expenses: {} }
      const c = contractForMonth(p.contracts, p.year, mIdx)
      const override = c && val === rentOnDate(c, new Date(p.year, mIdx, 15)) ? null : val
      return {
        ...p,
        months: { ...p.months, [p.year]: { ...ym, [mIdx]: { ...existing, incomeOverride: override } } },
      }
    })
    setEditIncome(null)
  }

  const saveOccupant = (occ: Occupant) => {
    onUpdateProp((p) => ({ ...p, occupant: occ }))
  }

  const removeOccupant = () => {
    onUpdateProp((p) => {
      const { occupant: _, ...rest } = p
      return rest as Property
    })
  }

  const startEdit = (rowKey: string, colIdx: number, currentVal: number) => {
    setEditCell({ row: rowKey, col: colIdx })
    setEditValue(currentVal ? String(currentVal) : '')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commitEdit = () => {
    if (!editCell) return
    const { row: key, col: mIdx } = editCell
    const val = Number(editValue.replace(/[,.\s]/g, '')) || 0
    onUpdateProp((p) => {
      const ym = p.months[p.year] ?? {}
      const existing = ym[mIdx] ?? { status: 'rented' as const, incomeOverride: null, expenses: {} }
      if (key.startsWith('extra_')) {
        const prev = existing.expenses[key]
        const label = prev && typeof prev === 'object' && 'label' in prev ? (prev as { label: string }).label : ''
        return {
          ...p,
          months: { ...p.months, [p.year]: { ...ym, [mIdx]: { ...existing, expenses: { ...existing.expenses, [key]: { label, amount: val } } } } },
        }
      }
      return {
        ...p,
        months: { ...p.months, [p.year]: { ...ym, [mIdx]: { ...existing, expenses: { ...existing.expenses, [key]: val } } } },
      }
    })
    setEditCell(null)
  }

  const addExpenseCat = (label: string) => {
    if (!label.trim()) return
    const key = `custom_${Date.now()}`
    onUpdateProp((p) => {
      const all = p.customExpenseCats ?? {}
      const yr = all[p.year] ?? []
      return { ...p, customExpenseCats: { ...all, [p.year]: [...yr, `${key}:${label.trim()}`] } }
    })
  }

  const removeExpenseCat = (rowKey: string) => {
    const isCustom = rowKey.startsWith('custom_') || rowKey.startsWith('extra_')
    onUpdateProp((p) => {
      let updated = p
      if (isCustom) {
        const allCats = p.customExpenseCats ?? {}
        const yr = (allCats[p.year] ?? []).filter((c) => !c.startsWith(`${rowKey}:`))
        updated = { ...p, customExpenseCats: { ...allCats, [p.year]: yr } }
      } else {
        const allHidden = p.hiddenExpenseCats ?? {}
        updated = { ...p, hiddenExpenseCats: { ...allHidden, [p.year]: [...(allHidden[p.year] ?? []), rowKey] } }
      }
      // Remove data from this year's months
      const ym = { ...(updated.months[p.year] ?? {}) }
      for (const [mIdx, mData] of Object.entries(ym)) {
        if (mData.expenses[rowKey] !== undefined) {
          const { [rowKey]: _, ...rest } = mData.expenses
          ym[Number(mIdx)] = { ...mData, expenses: rest }
        }
      }
      return { ...updated, months: { ...updated.months, [p.year]: ym } }
    })
  }

  const restoreExpenseCat = (key: string) => {
    onUpdateProp((p) => {
      const ym = { ...(p.months[p.year] ?? {}) }
      for (let i = 0; i < 12; i++) {
        const existing = ym[i] ?? { status: 'rented' as const, incomeOverride: null, expenses: {} }
        ym[i] = { ...existing, expenses: { ...existing.expenses, [key]: 0 } }
      }
      const allHidden = p.hiddenExpenseCats ?? {}
      return {
        ...p,
        hiddenExpenseCats: { ...allHidden, [p.year]: (allHidden[p.year] ?? []).filter((k) => k !== key) },
        months: { ...p.months, [p.year]: ym },
      }
    })
  }

  const fillRentFromContract = () => {
    onUpdateProp((p) => {
      const ym = { ...(p.months[p.year] ?? {}) }
      for (let i = 0; i < 12; i++) {
        const c = contractForMonth(p.contracts, p.year, i)
        const existing = ym[i] ?? { status: 'rented' as const, incomeOverride: null, expenses: {} }
        ym[i] = {
          ...existing,
          status: c ? 'rented' : existing.status,
          incomeOverride: null,
        }
      }
      return { ...p, months: { ...p.months, [p.year]: ym } }
    })
  }

  const setRentReceived = (mIdx: number, received: boolean) => {
    onUpdateProp((p) => {
      const ym = p.months[p.year] ?? {}
      const existing = ym[mIdx] ?? { status: 'rented' as const, incomeOverride: null, expenses: {} }
      return {
        ...p,
        months: { ...p.months, [p.year]: { ...ym, [mIdx]: { ...existing, rentReceived: received } } },
      }
    })
  }

  const fillFromServices = () => {
    onUpdateProp((p) => {
      const services = resolveServices(p)
      const costByType: Record<string, number> = {}
      for (const s of services) {
        const key = s.type.toLowerCase()
        costByType[key] = (costByType[key] ?? 0) + s.monthlyCost
      }
      if (Object.keys(costByType).length === 0) return p

      const ym = { ...(p.months[p.year] ?? {}) }
      for (let i = 0; i < 12; i++) {
        const existing = ym[i] ?? { status: 'rented' as const, incomeOverride: null, expenses: {} }
        const newExpenses = { ...existing.expenses }
        for (const [key, cost] of Object.entries(costByType)) {
          newExpenses[key] = cost
        }
        ym[i] = { ...existing, expenses: newExpenses }
      }
      return { ...p, months: { ...p.months, [p.year]: ym } }
    })
  }

  const ym = yearMonths(prop)
  const months = MONTHS.map((name, i) => {
    const d = getMonthData(prop, i)
    const m = ym[i]
    return {
      name,
      i,
      ...d,
      hasData: !!m,
      hasOverride: m?.incomeOverride != null,
      hasExpenses:
        m &&
        Object.values(m.expenses ?? {}).some((v) => typeof v === 'number' && v > 0),
      rentReceived: m?.rentReceived === true,
    }
  })

  // Compute monthly income/expense/tax data for the bar chart
  const taxItems = prop.taxes.items ?? []
  const monthlyData = months.map((m, i) => {
    const tax = taxItems
      .filter((t) => {
        if (!t.dueDate) return i === 11
        return new Date(t.dueDate + 'T12:00').getMonth() === i
      })
      .reduce((a, t) => a + (t.amount ?? 0), 0)
    const oneTime = sumServiceOneTimeForMonth(prop, i)
    return { income: m.income, expense: m.totalOpex, tax, oneTime }
  })
  const maxVal = Math.max(
    ...monthlyData.map((d) => d.income),
    ...monthlyData.map((d) => d.expense + d.tax + d.oneTime),
    1,
  )

  return (
    <div>
      <div className="kpi-row mb24">
        <div className="kpi-card">
          <div className="kpi-label">GPI <KpiInfoIcon tip="Gross Potential Income — contract rent when leased; for unleased months, Fact Sheet potential or the highest overlapping lease rent in this year." /></div>
          <div className="kpi-value">{fmtCurrencyM(cx(gpiDisplay), dc)}</div>
          <div className="kpi-sub">Gross potential</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Vacancy <KpiInfoIcon tip="Potential rent not collected: unleased months (gaps between leases), months marked vacant under a lease, or partial rent. Gap months use Fact Sheet potential rent if set, otherwise the highest monthly rent among leases that overlap this year." /></div>
          <div className="kpi-value red">
            {ann.vacancy > 0 ? '−' : ''}
            {fmtCurrencyM(cx(ann.vacancy), dc)}
          </div>
          <div className="kpi-sub">
            {vacancyMonths} {vacancyMonths === 1 ? 'month' : 'months'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">NOI <KpiInfoIcon tip="Net Operating Income — income minus operating expenses" /></div>
          <div className="kpi-value purple">{fmtCurrencyM(cx(ann.noi), dc)}</div>
          <div className="kpi-sub">After OPEX</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Cap rate <KpiInfoIcon tip="Capitalization rate — NOI for this year divided by estimated property value for the same year (Value and Equity: purchase model or manual appraisal). Pre-financing yield on the asset." /></div>
          <div
            className={`kpi-value${capRatePct == null || !Number.isFinite(capRatePct) ? '' : capRatePct < 0 ? ' red' : ' purple'}`}
          >
            {capRatePct != null && Number.isFinite(capRatePct) ? `${capRatePct.toFixed(2)}%` : '—'}
          </div>
          <div className="kpi-sub">NOI ÷ est. value</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">CAPEX <KpiInfoIcon tip="Capital Expenditures — major repairs & improvements" /></div>
          <div className="kpi-value red">
            {ann.totalCapex > 0 ? '−' : ''}
            {fmtCurrencyM(cx(ann.totalCapex), dc)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow <KpiInfoIcon tip="Final cashflow after all income and expenses" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCf), dc)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow (Amortized) <KpiInfoIcon tip="Net cashflow with capitalized CapEx spread across its depreciation schedule instead of hitting the year it was paid" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCfAmortized), dc)}</div>
        </div>
      </div>

      <div className="overview-duo mb24">
        {active ? (
          <ActiveContractSummaryCard prop={prop} contract={active} cx={cx} displayCurrency={displayCurrency} />
        ) : prop.occupant ? (
          <div className="card">
            <div className="card-inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="fw6" style={{ fontSize: '14px' }}>Occupant</div>
                {!readOnly && (
                  <div className="flex gap4">
                    <button type="button" className="ghost fs12" onClick={() => setOccModal(true)}>Edit</button>
                    <button type="button" className="ghost danger fs12" onClick={removeOccupant}>Remove</button>
                  </div>
                )}
              </div>
              <table className="contract-detail-table">
                <tbody>
                  <tr>
                    <td className="cdt-label">Name</td>
                    <td className="cdt-value">{prop.occupant.name}</td>
                  </tr>
                  <tr>
                    <td className="cdt-label">Relation</td>
                    <td className="cdt-value">{prop.occupant.relation}</td>
                  </tr>
                  {prop.occupant.since && (
                    <tr>
                      <td className="cdt-label">Since</td>
                      <td className="cdt-value">{formatDate(prop.occupant.since)}</td>
                    </tr>
                  )}
                  {prop.occupant.notes && (
                    <tr>
                      <td className="cdt-label">Notes</td>
                      <td className="cdt-value">{prop.occupant.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-inner">
              <div className="warn-box" style={{ marginBottom: 12 }}>No active contract — all months show as vacant.</div>
              {!readOnly && (
                <div className="flex gap8">
                  <button type="button" className="ghost fs12" style={{ color: 'var(--accent-bg)' }} onClick={() => setOccModal(true)}>
                    + Add occupant
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-inner">
            <div className="fw6 mb12" style={{ fontSize: '14px' }}>
              Income vs expenses — {prop.year} monthly ({displayCurrency ?? prop.currency})
            </div>
            <div className="ie-chart">
              <div className="ie-axis">
                <span>{fmtCurrencyM(cx(maxVal), dc)}</span>
                <span>{fmtCurrencyM(cx(maxVal / 2), dc)}</span>
                <span>0</span>
                <span>−{fmtCurrencyM(cx(maxVal / 2), dc)}</span>
                <span>−{fmtCurrencyM(cx(maxVal), dc)}</span>
              </div>
              <div className="ie-bars">
                {monthlyData.map((d, i) => {
                  const incPct = maxVal > 0 ? (d.income / maxVal) * 100 : 0
                  const expPct = maxVal > 0 ? (d.expense / maxVal) * 100 : 0
                  const taxPct = maxVal > 0 ? (d.tax / maxVal) * 100 : 0
                  const oneTimePct = maxVal > 0 ? (d.oneTime / maxVal) * 100 : 0
                  const stackH = expPct + taxPct + oneTimePct
                  return (
                    <div key={i} className="ie-col ie-col-hover">
                      <div className="ie-col-upper">
                        <div
                          className="ie-bar income"
                          style={{ height: `${incPct}%` }}
                        />
                      </div>
                      <div className="ie-col-lower" style={{ alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: `${stackH}%` }}>
                          {expPct > 0 && (
                            <div
                              className="ie-bar"
                              style={{
                                flex: expPct,
                                background: '#fca5a5',
                                borderRadius: taxPct || oneTimePct ? '3px 3px 0 0' : '3px',
                                minHeight: 1,
                              }}
                            />
                          )}
                          {taxPct > 0 && (
                            <div
                              className="ie-bar"
                              style={{
                                flex: taxPct,
                                background: '#c4b5fd',
                                borderRadius: oneTimePct ? 0 : expPct ? '0 0 3px 3px' : '3px',
                                minHeight: 1,
                              }}
                            />
                          )}
                          {oneTimePct > 0 && (
                            <div
                              className="ie-bar"
                              style={{
                                flex: oneTimePct,
                                background: '#fdba74',
                                borderRadius: '0 0 3px 3px',
                                minHeight: 1,
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <span className="ie-label">{MONTHS[i]}</span>
                      <div className="ie-tip">
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{MONTHS_FULL[i]}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#86efac' }}>Income</span><span>{fmt(cx(d.income))}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#fca5a5' }}>OPEX</span><span>{fmt(cx(d.expense))}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#c4b5fd' }}>Taxes</span><span>{fmt(cx(d.tax))}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: '#fdba74' }}>One-time</span><span>{fmt(cx(d.oneTime))}</span></div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 600 }}><span>Net</span><span>{fmt(cx(d.income - d.expense - d.tax - d.oneTime))}</span></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb24">
        <div className="card-inner">
          <div className="fw6 mb12" style={{ fontSize: '14px' }}>Property details</div>
          <table className="contract-detail-table">
            <tbody>
              <tr>
                <td className="cdt-label">Owner</td>
                <td className="cdt-value">
                  {editingOwner ? (
                    <div className="flex align-center gap8">
                      <input
                        autoFocus
                        type="text"
                        value={ownerDraft}
                        onChange={(e) => setOwnerDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateProp((p) => ({ ...p, owner: ownerDraft.trim() }))
                            setEditingOwner(false)
                          }
                          if (e.key === 'Escape') setEditingOwner(false)
                        }}
                        style={{ fontSize: 13, padding: '3px 8px', borderRadius: 6, border: '1px solid #e8ecf2', background: '#f7f9fc', width: 180 }}
                      />
                      <button type="button" className="primary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => { onUpdateProp((p) => ({ ...p, owner: ownerDraft.trim() })); setEditingOwner(false) }}>Save</button>
                      <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={() => setEditingOwner(false)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex align-center gap8">
                      <span>{prop.owner || '—'}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          className="ghost"
                          style={{ padding: '1px 5px', fontSize: 12, color: 'var(--text3)' }}
                          onClick={() => { setOwnerDraft(prop.owner || ''); setEditingOwner(true) }}
                          title="Edit owner"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
              <tr>
                <td className="cdt-label">Group</td>
                <td className="cdt-value">
                  {editingGroup ? (
                    <div className="flex align-center gap8">
                      <input
                        autoFocus
                        type="text"
                        value={groupDraft}
                        onChange={(e) => setGroupDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateProp((p) => ({ ...p, group: groupDraft.trim() || undefined }))
                            setEditingGroup(false)
                          }
                          if (e.key === 'Escape') setEditingGroup(false)
                        }}
                        style={{ fontSize: 13, padding: '3px 8px', borderRadius: 6, border: '1px solid #e8ecf2', background: '#f7f9fc', width: 180 }}
                      />
                      <button type="button" className="primary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => { onUpdateProp((p) => ({ ...p, group: groupDraft.trim() || undefined })); setEditingGroup(false) }}>Save</button>
                      <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={() => setEditingGroup(false)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex align-center gap8">
                      <span>{prop.group || '—'}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          className="ghost"
                          style={{ padding: '1px 5px', fontSize: 12, color: 'var(--text3)' }}
                          onClick={() => { setGroupDraft(prop.group || ''); setEditingGroup(true) }}
                          title="Edit group"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="sec-hdr mb8">
        <span className="sec-title">Monthly entry · {prop.year}</span>
        <div className="flex gap8 align-center">
          <span className="fs11 text3">Click a month to log expenses</span>
          <div className="flex" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              className={view === 'cards' ? 'primary' : 'ghost'}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 0 }}
              onClick={() => setView('cards')}
            >
              Cards
            </button>
            <button
              type="button"
              className={view === 'table' ? 'primary' : 'ghost'}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 0 }}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {prop.contracts.length > 0 && (
          <button
            type="button"
            className="ghost"
            style={{
              fontSize: 12,
              padding: '6px 14px',
              color: 'var(--accent-bg)',
              fontWeight: 500,
              border: '1px dashed var(--accent-bg)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={fillRentFromContract}
          >
            Fill rent from Contract · {prop.year}
          </button>
        )}
        {resolveServices(prop).length > 0 && (
          <button
            type="button"
            className="ghost"
            style={{
              fontSize: 12,
              padding: '6px 14px',
              color: 'var(--accent-bg)',
              fontWeight: 500,
              border: '1px dashed var(--accent-bg)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={fillFromServices}
          >
            Fill expenses from Services · {prop.year}
          </button>
        )}
      </div>

      {view === 'cards' && (
        <>
          <div className="month-grid mb24">
            {months.map((m) => {
              if (!m.contract) {
                return (
                  <div key={m.i} className="month-tile no-contract" onClick={readOnly ? undefined : () => setMonthModal(m.i)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
                    <div className="mt-header">
                      <span className="mt-month">{m.name}</span>
                      <span className="badge archived-c">No contract</span>
                    </div>
                    <div className="mt-income" style={{ color: 'var(--text3)' }}>
                      —
                    </div>
                    {m.hasExpenses ? (
                      <div className="mt-expense" style={{ color: '#b91c1c' }}>OPEX −{fmt(cx(m.totalOpex))}</div>
                    ) : (
                      <div className="mt-expense fs11 text3">Click to add expenses</div>
                    )}
                  </div>
                )
              }
              const cls = [
                'month-tile',
                m.status === 'vacant' ? 'vacant' : '',
                m.hasOverride ? 'has-override' : '',
                m.hasExpenses || m.status === 'vacant' ? 'complete' : 'pending',
                m.rentReceived && m.status !== 'vacant' ? 'rent-received' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const showPaidToggle = m.status !== 'vacant'
              return (
                <div key={m.i} className={cls} onClick={readOnly ? undefined : () => setMonthModal(m.i)} style={{ cursor: readOnly ? 'default' : undefined }}>
                  <div className="mt-header">
                    <span className="mt-month">{m.name}</span>
                    <span
                      className={`badge ${m.status === 'vacant' ? 'vacant' : m.hasOverride ? 'override' : 'rented'}`}
                    >
                      {m.status === 'vacant' ? 'Vacant' : m.hasOverride ? 'Override' : 'Rented'}
                    </span>
                  </div>
                  <div className="mt-income">{m.status === 'vacant' ? '—' : `+${fmt(cx(m.income))}`}</div>
                  <div className="mt-expense" style={{ color: '#b91c1c' }}>OPEX −{fmt(cx(m.totalOpex))}</div>
                  <div className="mt-footer mt-footer--stack">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span className={`mt-net ${m.noi >= 0 ? 'pos' : 'neg'}`}>
                        {m.noi >= 0 ? '+' : ''}
                        {fmt(cx(m.noi))}
                      </span>
                      <span className="fs11 text3">{m.hasExpenses ? 'OPEX logged' : 'OPEX pending'}</span>
                    </div>
                    {showPaidToggle && (
                      <div
                        role="presentation"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'default' }}
                        title="Mark when rent has been received. Click the rest of the card to edit the month."
                      >
                        <input
                          id={`rent-received-${m.i}`}
                          type="checkbox"
                          checked={m.rentReceived}
                          disabled={readOnly}
                          onChange={(e) => {
                            e.stopPropagation()
                            if (!readOnly) setRentReceived(m.i, e.target.checked)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 16, height: 16, flexShrink: 0, cursor: readOnly ? 'default' : 'pointer' }}
                        />
                        <label
                          htmlFor={`rent-received-${m.i}`}
                          className="fs11 text2"
                          style={{ cursor: 'pointer', userSelect: 'none', flex: 1, lineHeight: 1.3 }}
                        >
                          Rent received
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {view === 'table' && (() => {
        const hidden = new Set((prop.hiddenExpenseCats ?? {})[prop.year] ?? [])
        const rowDefs = expenseRowsForYear(prop)

        // Collect extra one-off expense keys across this year's months
        const extraKeys = new Map<string, string>()
        for (let i = 0; i < 12; i++) {
          const exp = ym[i]?.expenses ?? {}
          for (const [k, v] of Object.entries(exp)) {
            if (k.startsWith('extra_') && v && typeof v === 'object' && 'label' in v) {
              if (!extraKeys.has(k)) extraKeys.set(k, (v as { label: string }).label)
            }
          }
        }

        // Build rows from expenseRowsForYear + extras
        type Row = { key: string; label: string; editable: boolean; removable: boolean; values: number[]; total: number; avg: number }
        const rows: Row[] = []

        const buildRow = (key: string, label: string, removable: boolean, getVal: (exp: Record<string, unknown>, i: number) => number): Row => {
          const values = MONTHS.map((_, i) => getVal(ym[i]?.expenses ?? {}, i))
          const total = values.reduce((a, b) => a + b, 0)
          const filled = values.filter((v) => v > 0).length
          return { key, label, editable: true, removable, values, total, avg: filled ? total / filled : 0 }
        }

        for (const def of rowDefs) {
          rows.push(buildRow(def.key, def.label, def.type === 'custom', (exp) => {
            const v = exp[def.key]
            return typeof v === 'number' ? v : 0
          }))
        }

        for (const [key, label] of extraKeys) {
          rows.push(buildRow(key, label, true, (exp) => {
            const v = exp[key]
            if (v && typeof v === 'object' && 'amount' in v) return Number((v as { amount: number }).amount) || 0
            return 0
          }))
        }

        const maintenanceValues = MONTHS.map((_, i) => sumMaintenanceForMonth(prop, i))
        const maintenanceTotal = maintenanceValues.reduce((a, b) => a + b, 0)
        if (maintenanceTotal > 0) {
          const filled = maintenanceValues.filter((v) => v > 0).length
          rows.push({
            key: 'maintenance',
            label: 'Maintenance',
            editable: false,
            removable: false,
            values: maintenanceValues,
            total: maintenanceTotal,
            avg: filled ? maintenanceTotal / filled : 0,
          })
        }

        // Totals row
        const totals = MONTHS.map((_, i) => rows.reduce((a, r) => a + r.values[i], 0))
        const grandTotal = totals.reduce((a, b) => a + b, 0)
        const filledMonths = totals.filter((v) => v > 0).length

        // Income row (shared with income table and net row)
        const incomeVals = MONTHS.map((_, i) => {
          const c = contractForMonth(prop.contracts, prop.year, i)
          const m = ym[i]
          if (!c) return 0
          if (m?.incomeOverride !== null && m?.incomeOverride !== undefined) return m.incomeOverride
          return rentOnDate(c, new Date(prop.year, i, 15))
        })
        const incTotal = incomeVals.reduce((a, b) => a + b, 0)
        const incFilled = incomeVals.filter((v) => v > 0).length


        const stickyLabel: React.CSSProperties = {
          position: 'sticky', left: 0, zIndex: 2,
          background: '#fff', borderRight: '2px solid var(--border)',
          width: 160, minWidth: 160, maxWidth: 160, padding: '10px 14px',
          fontSize: 13, fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }
        const cellStyle: React.CSSProperties = {
          textAlign: 'right', padding: '10px 14px', fontSize: 13,
          minWidth: 100, whiteSpace: 'nowrap',
        }
        const summaryCell: React.CSSProperties = {
          ...cellStyle, background: '#f7f9fc', fontWeight: 600,
        }

        const scroll = (dir: 'left' | 'right') => {
          scrollRef.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' })
        }

        const arrowBtn: React.CSSProperties = {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          border: '1px solid var(--border)', background: '#fff',
          cursor: 'pointer', fontSize: 16, color: 'var(--text2)',
          transition: 'all 0.15s',
        }

        return (
          <div className="mb24">
            <div className="flex align-center gap8 mb8" style={{ justifyContent: 'flex-end' }}>
              <button type="button" style={arrowBtn} onClick={() => scroll('left')}>←</button>
              <button type="button" style={arrowBtn} onClick={() => scroll('right')}>→</button>
            </div>
            <style>{`
              .expense-table-scroll::-webkit-scrollbar { height: 10px; }
              .expense-table-scroll::-webkit-scrollbar-track { background: #f0f2f5; border-radius: 0 0 12px 12px; }
              .expense-table-scroll::-webkit-scrollbar-thumb { background: #c1c7d0; border-radius: 5px; border: 2px solid #f0f2f5; }
              .expense-table-scroll::-webkit-scrollbar-thumb:hover { background: #a0a8b4; }
              .exp-row:hover .exp-row-actions { opacity: 1 !important; }
            `}</style>
            <div
              ref={scrollRef}
              className="expense-table-scroll"
              style={{
                overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                scrollbarWidth: 'auto', scrollbarColor: '#c1c7d0 #f0f2f5',
              }}
            >
            {/* ── Income table ── */}
            {(() => {
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 2 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ ...stickyLabel, background: 'var(--surface2)', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '12px 14px' }}>Income</th>
                      {MONTHS.map((name, i) => (
                        <th key={i} style={{ textAlign: 'right', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', minWidth: 100 }}>
                          {name}
                        </th>
                      ))}
                      <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.6px', background: '#f0f2f5', minWidth: 110 }}>Total</th>
                      <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.6px', background: '#f0f2f5', minWidth: 110 }}>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: '#f0fdf4' }}>
                      <td style={{ ...stickyLabel, background: '#f0fdf4' }}>Rent</td>
                      {incomeVals.map((v, i) => {
                        const isEditing = editIncome === i
                        if (isEditing) {
                          return (
                            <td key={i} style={{ padding: 2 }}>
                              <input
                                ref={incomeInputRef}
                                type="text"
                                value={editIncomeValue}
                                onChange={(e) => setEditIncomeValue(e.target.value)}
                                onBlur={commitIncomeEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitIncomeEdit()
                                  if (e.key === 'Escape') setEditIncome(null)
                                }}
                                style={{
                                  width: '100%', textAlign: 'right', fontSize: 13,
                                  padding: '8px 12px', border: '2px solid #1A6B47',
                                  borderRadius: 6, outline: 'none', background: '#fff',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                          )
                        }
                        const mInc = ym[i]
                        const hasOverride = mInc?.incomeOverride !== null && mInc?.incomeOverride !== undefined
                        return (
                          <td
                            key={i}
                            style={{
                              ...cellStyle, cursor: 'text',
                              color: v ? '#1A6B47' : 'var(--text3)',
                              fontWeight: hasOverride ? 700 : 400,
                              borderBottom: '1px solid var(--border)',
                            }}
                            title={hasOverride ? 'Overridden' : undefined}
                            onClick={() => startIncomeEdit(i, v)}
                          >
                            {v ? `+${fmt(cx(v))}` : ''}
                          </td>
                        )
                      })}
                      <td style={{ ...summaryCell, borderBottom: '1px solid var(--border)', background: '#e8f5e9', color: '#1A6B47', fontWeight: 700 }}>
                        {incTotal ? `+${fmt(cx(incTotal))}` : ''}
                      </td>
                      <td style={{ ...summaryCell, borderBottom: '1px solid var(--border)', background: '#e8f5e9', color: 'var(--text3)', fontWeight: 500 }}>
                        {incFilled ? `+${fmt(cx(Math.round(incTotal / incFilled)))}` : ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )
            })()}
            {/* ── Expenses table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={{ ...stickyLabel, background: 'var(--surface2)', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '12px 14px' }}>Expenses</th>
                  {MONTHS.map((name, i) => (
                    <th
                      key={i}
                      onClick={readOnly ? undefined : () => setMonthModal(i)}
                      style={{ textAlign: 'right', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', cursor: readOnly ? 'default' : 'pointer', whiteSpace: 'nowrap', minWidth: 100 }}
                    >
                      {name}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.6px', background: '#f0f2f5', minWidth: 110 }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.6px', background: '#f0f2f5', minWidth: 110 }}>Average</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={row.key} className="exp-row" style={{ background: rowIdx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ ...stickyLabel, background: rowIdx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                        <span style={{ flex: 1 }}>{row.label}</span>
                        {row.key !== 'maintenance' && (
                        <span className="exp-row-actions" style={{ position: 'absolute', right: 0, display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s' }}>
                          <button
                            type="button"
                            onClick={() => removeExpenseCat(row.key)}
                            style={{
                              width: 20, height: 20, borderRadius: 4, border: '1px solid var(--border)',
                              background: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: '18px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#b91c1c', padding: 0,
                            }}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddRow(true)}
                            style={{
                              width: 20, height: 20, borderRadius: 4, border: '1px solid var(--border)',
                              background: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: '18px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#1A6B47', padding: 0,
                            }}
                          >
                            +
                          </button>
                        </span>
                        )}
                      </div>
                    </td>
                    {row.values.map((v, i) => {
                      const isEditing = editCell?.row === row.key && editCell?.col === i
                      if (isEditing) {
                        return (
                          <td key={i} style={{ padding: 2 }}>
                            <input
                              ref={inputRef}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit()
                                if (e.key === 'Escape') setEditCell(null)
                              }}
                              style={{
                                width: '100%', textAlign: 'right', fontSize: 13,
                                padding: '8px 12px', border: '2px solid var(--accent-bg)',
                                borderRadius: 6, outline: 'none', background: '#fff',
                                boxSizing: 'border-box',
                              }}
                            />
                          </td>
                        )
                      }
                      return (
                        <td
                          key={i}
                          style={{
                            ...cellStyle,
                            cursor: row.editable ? 'text' : 'default',
                            color: v ? 'var(--text)' : 'var(--text3)',
                            borderBottom: '1px solid var(--border)',
                          }}
                          onClick={() => row.editable && startEdit(row.key, i, v)}
                        >
                          {v ? fmt(cx(v)) : ''}
                        </td>
                      )
                    })}
                    <td style={{ ...summaryCell, borderBottom: '1px solid var(--border)', background: rowIdx % 2 === 0 ? '#f7f9fc' : '#f0f2f5' }}>
                      {row.total ? fmt(cx(row.total)) : ''}
                    </td>
                    <td style={{ ...summaryCell, borderBottom: '1px solid var(--border)', background: rowIdx % 2 === 0 ? '#f7f9fc' : '#f0f2f5', color: 'var(--text3)', fontWeight: 500 }}>
                      {row.avg ? fmt(cx(Math.round(row.avg))) : ''}
                    </td>
                  </tr>
                ))}
                {showAddRow && (
                  <tr style={{ background: '#f0fdf4' }}>
                    <td style={{ ...stickyLabel, background: '#f0fdf4', padding: '6px 10px' }} colSpan={15}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newCatName.trim()) {
                              addExpenseCat(newCatName)
                              setNewCatName('')
                              setShowAddRow(false)
                            }
                            if (e.key === 'Escape') { setShowAddRow(false); setNewCatName('') }
                          }}
                          placeholder="New category name..."
                          autoFocus
                          style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, flex: 1, maxWidth: 220 }}
                        />
                        <button
                          type="button"
                          className="primary"
                          style={{ fontSize: 12, padding: '5px 12px' }}
                          onClick={() => {
                            if (newCatName.trim()) {
                              addExpenseCat(newCatName)
                              setNewCatName('')
                              setShowAddRow(false)
                            }
                          }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                          onClick={() => { setShowAddRow(false); setNewCatName('') }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                <tr style={{ background: '#fef2f2' }}>
                  <td style={{ ...stickyLabel, background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: 13, borderRight: '2px solid #fecaca' }}>
                    Total
                  </td>
                  {totals.map((v, i) => (
                    <td key={i} style={{ ...cellStyle, color: '#b91c1c', fontWeight: 600 }}>
                      {v ? fmt(cx(v)) : ''}
                    </td>
                  ))}
                  <td style={{ ...cellStyle, color: '#b91c1c', fontWeight: 700, background: '#fee2e2' }}>
                    {grandTotal ? fmt(cx(grandTotal)) : ''}
                  </td>
                  <td style={{ ...cellStyle, color: '#991b1b', fontWeight: 600, background: '#fee2e2' }}>
                    {filledMonths ? fmt(cx(Math.round(grandTotal / filledMonths))) : ''}
                  </td>
                </tr>
                {(() => {
                  const taxItems = prop.taxes.items ?? []
                  const taxByMonth = MONTHS.map((_, i) =>
                    taxItems
                      .filter((t) => {
                        if (!t.dueDate) return i === 11
                        return new Date(t.dueDate + 'T12:00').getMonth() === i
                      })
                      .reduce((a, t) => a + (t.amount ?? 0), 0),
                  )
                  const taxTotal = taxByMonth.reduce((a, b) => a + b, 0)
                  const taxFilled = taxByMonth.filter((v) => v > 0).length
                  return (
                    <tr style={{ background: '#f3e8ff' }}>
                      <td style={{ ...stickyLabel, background: '#f3e8ff', color: '#7c3aed', fontWeight: 600, fontSize: 13, borderRight: '2px solid #e9d5ff' }}>
                        Taxes
                      </td>
                      {taxByMonth.map((v, i) => (
                        <td key={i} style={{ ...cellStyle, color: v ? '#7c3aed' : 'var(--text3)', fontWeight: v ? 600 : 400 }}>
                          {v ? `−${fmt(cx(v))}` : ''}
                        </td>
                      ))}
                      <td style={{ ...cellStyle, color: '#7c3aed', fontWeight: 700, background: '#ede9fe' }}>
                        {taxTotal ? `−${fmt(cx(taxTotal))}` : ''}
                      </td>
                      <td style={{ ...cellStyle, color: '#6d28d9', fontWeight: 500, background: '#ede9fe' }}>
                        {taxFilled ? fmt(cx(Math.round(taxTotal / taxFilled))) : ''}
                      </td>
                    </tr>
                  )
                })()}
                {(() => {
                  const oneTimeByMonth = MONTHS.map((_, i) => sumServiceOneTimeForMonth(prop, i))
                  const oneTimeTotal = oneTimeByMonth.reduce((a, b) => a + b, 0)
                  const oneTimeFilled = oneTimeByMonth.filter((v) => v > 0).length
                  return (
                    <tr style={{ background: '#fff7ed' }}>
                      <td style={{ ...stickyLabel, background: '#fff7ed', color: '#c2410c', fontWeight: 600, fontSize: 13, borderRight: '2px solid #fed7aa' }}>
                        One-time services
                      </td>
                      {oneTimeByMonth.map((v, i) => (
                        <td key={i} style={{ ...cellStyle, color: v ? '#c2410c' : 'var(--text3)', fontWeight: v ? 600 : 400 }}>
                          {v ? `−${fmt(cx(v))}` : ''}
                        </td>
                      ))}
                      <td style={{ ...cellStyle, color: '#c2410c', fontWeight: 700, background: '#ffedd5' }}>
                        {oneTimeTotal ? `−${fmt(cx(oneTimeTotal))}` : ''}
                      </td>
                      <td style={{ ...cellStyle, color: '#9a3412', fontWeight: 500, background: '#ffedd5' }}>
                        {oneTimeFilled ? fmt(cx(Math.round(oneTimeTotal / oneTimeFilled))) : ''}
                      </td>
                    </tr>
                  )
                })()}
                {(() => {
                  const taxItems = prop.taxes.items ?? []
                  const taxByMonth = MONTHS.map((_, i) =>
                    taxItems
                      .filter((t) => {
                        if (!t.dueDate) return i === 11
                        return new Date(t.dueDate + 'T12:00').getMonth() === i
                      })
                      .reduce((a, t) => a + (t.amount ?? 0), 0),
                  )
                  const oneTimeByMonth = MONTHS.map((_, i) => sumServiceOneTimeForMonth(prop, i))
                  const netAfter = MONTHS.map((_, i) => incomeVals[i] - totals[i] - taxByMonth[i] - oneTimeByMonth[i])
                  const netAfterTotal = netAfter.reduce((a, b) => a + b, 0)
                  const netAfterFilled = netAfter.filter((v) => v !== 0).length
                  return (
                <tr style={{ background: '#f0fdf4' }}>
                  <td style={{ ...stickyLabel, background: '#f0fdf4', fontWeight: 700, fontSize: 13, color: '#1A6B47' }}>
                    Net
                  </td>
                  {netAfter.map((v, i) => (
                    <td key={i} style={{ ...cellStyle, fontWeight: 600, color: v >= 0 ? '#1A6B47' : '#b91c1c' }}>
                      {v ? `${v >= 0 ? '+' : ''}${fmt(cx(v))}` : ''}
                    </td>
                  ))}
                  <td style={{ ...summaryCell, background: '#e8f5e9', fontWeight: 700, color: netAfterTotal >= 0 ? '#1A6B47' : '#b91c1c' }}>
                    {netAfterTotal ? `${netAfterTotal >= 0 ? '+' : ''}${fmt(cx(netAfterTotal))}` : ''}
                  </td>
                  <td style={{ ...summaryCell, background: '#e8f5e9', fontWeight: 500, color: 'var(--text3)' }}>
                    {netAfterFilled ? fmt(cx(Math.round(netAfterTotal / netAfterFilled))) : ''}
                  </td>
                </tr>
                  )
                })()}
              </tbody>
            </table>
            </div>
            {hidden.size > 0 && (
              <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Hidden:</span>
                {[...hidden].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => restoreExpenseCat(key)}
                      style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        border: '1px solid var(--border)', background: '#fff',
                        cursor: 'pointer', color: 'var(--text2)',
                      }}
                    >
                      + {key}
                    </button>
                ))}
              </div>
            )}
          </div>
        )
      })()}
      {monthModal !== null && (
        <MonthModal prop={prop} mIdx={monthModal} onSave={saveMonth} onClose={() => setMonthModal(null)} />
      )}
      {occModal && (
        <OccupantModal occupant={prop.occupant} onSave={saveOccupant} onClose={() => setOccModal(false)} />
      )}
    </div>
  )
}
