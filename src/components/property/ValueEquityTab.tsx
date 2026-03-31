import { useMemo, useState, useEffect, useCallback, type CSSProperties } from 'react'
import type { Property, MortgageInfo, OwnershipEntry, FactSheet } from '../../lib/types'
import { CURRENCIES, normalizeCurrencyCode, resolveFunctionalCurrency, type CurrencyCode } from '../../lib/currency'
import { CurrencySelect } from '../CurrencySelect'
import { fmtCurrency } from '../../lib/format'
import { buildAmortScheduleYearly, buildOutrightProjectionRows } from '../../lib/mortgageSchedule'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/** Equity vs debt line chart — palette aligned to product reference card */
const EQ_DEBT_CHART = {
  equity: '#26C6DA',
  debt: '#C62828',
  property: '#BDBDBD',
  grid: '#eceff1',
  axisTick: '#78909c',
  refLine: 'var(--accent-bg)',
} as const

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

const EMPTY_MORTGAGE: MortgageInfo = {
  hasMortgage: false, lender: '', loanNumber: '', originalAmount: null,
  outstandingBalance: null, monthlyPayment: null, interestRate: null,
  rateType: '', termMonths: null, startDate: '', endDate: '',
}

function IconPencilSmall() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconCopySmall() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function toDateInputValue(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Compact currency for KPI tiles (e.g. $350K). */
function fmtCompactCurrency(n: number, currency: CurrencyCode, cx: (v: number) => number): string {
  const v = cx(n)
  const cfg = CURRENCIES[currency]
  const abs = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}${cfg.symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${cfg.symbol}${Math.round(abs / 1_000)}K`
  return fmtCurrency(v, currency)
}

function fmtTableMoney(n: number, currency: CurrencyCode, cx: (v: number) => number): string {
  const v = cx(n)
  const cfg = CURRENCIES[currency]
  return (v < 0 ? '−' : '') + cfg.symbol + ' '
    + Math.abs(v).toLocaleString(cfg.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDisplayDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function ReadOnlyField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div>
      <div className="ct-field-label">{label}</div>
      <div className="ct-field-val">{display}</div>
    </div>
  )
}

const FS_EDIT_BTN: CSSProperties = {
  fontSize: 12,
  padding: '4px 14px',
  border: '1px solid var(--accent-bg)',
  color: 'var(--accent-bg)',
  background: 'transparent',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 500,
  cursor: 'pointer',
}

/**
 * Value & equity — **authoring surface** for ownership and property value on the fact sheet:
 * `purchasePrice`, `purchaseDate`, `appreciationRate`, `projectionYears`, `priceHistory`,
 * `mortgage`, `owners`, and `prop.owner` / currency are edited here (not on Fact Sheet).
 * Optional `factSheet.currentValue` is only used when a purchase-based estimate cannot be built.
 */
export function ValueEquityTab({ prop, cx = (n) => n, displayCurrency, onUpdateProp }: Props) {
  const functionalCurrency = useMemo(
    () => resolveFunctionalCurrency(prop),
    [prop.currency, prop.country],
  )

  useEffect(() => {
    const normalized = normalizeCurrencyCode(prop.currency)
    const resolved = resolveFunctionalCurrency(prop)
    if (normalized !== resolved) {
      onUpdateProp((p) => ({ ...p, currency: resolved }))
    }
  }, [prop.id, prop.currency, prop.country, onUpdateProp])

  const dc = displayCurrency ?? functionalCurrency
  const fs = prop.factSheet
  const mortgage = fs?.mortgage ?? EMPTY_MORTGAGE
  const outstandingBalance = mortgage.hasMortgage ? (mortgage.outstandingBalance ?? 0) : 0
  const currentYear = new Date().getFullYear()

  const mortgagePurchaseYear = useMemo(() => {
    if (!fs?.purchaseDate) return null
    const y = new Date(`${toDateInputValue(fs.purchaseDate)}T12:00:00`).getFullYear()
    return Number.isNaN(y) ? null : y
  }, [fs?.purchaseDate])

  const [outrightEditing, setOutrightEditing] = useState(false)
  const [realEstateEditing, setRealEstateEditing] = useState(false)
  const [mortgageEditOpen, setMortgageEditOpen] = useState(false)
  const [mortgageViewMode, setMortgageViewMode] = useState<'visual' | 'schedule'>('visual')
  /** Inline edit for Price history (yearly) property value cells */
  const [phEditYear, setPhEditYear] = useState<number | null>(null)
  const [phEditDraft, setPhEditDraft] = useState('')
  /** Inline edit for mortgage full schedule property value column */
  const [mtgPvEditYear, setMtgPvEditYear] = useState<number | null>(null)
  const [mtgPvEditDraft, setMtgPvEditDraft] = useState('')
  /** Price history (yearly): visual trendline vs historic prices grid */
  const [priceHistoryDisplayMode, setPriceHistoryDisplayMode] = useState<'table' | 'trend'>('trend')

  useEffect(() => {
    if (!mortgage.hasMortgage) setMortgageEditOpen(false)
  }, [mortgage.hasMortgage])

  useEffect(() => {
    if (mortgage.hasMortgage) setOutrightEditing(false)
  }, [mortgage.hasMortgage])

  useEffect(() => {
    setRealEstateEditing(false)
  }, [prop.id])

  useEffect(() => {
    setPhEditYear(null)
    setPhEditDraft('')
  }, [prop.id])

  useEffect(() => {
    setPhEditYear(null)
    setPhEditDraft('')
  }, [outrightEditing])

  useEffect(() => {
    setMtgPvEditYear(null)
    setMtgPvEditDraft('')
  }, [prop.id, mortgageViewMode, mortgage.hasMortgage])

  useEffect(() => {
    setPriceHistoryDisplayMode('trend')
  }, [prop.id])

  const patchFactSheet = useCallback((patch: Partial<FactSheet>) => {
    onUpdateProp((p) => ({
      ...p,
      factSheet: { ...(p.factSheet ?? {}) as FactSheet, ...patch } as FactSheet,
    }))
  }, [onUpdateProp])

  const patchMortgage = useCallback((patch: Partial<MortgageInfo>) => {
    onUpdateProp((p) => {
      const f = (p.factSheet ?? {}) as FactSheet
      const prevM = f.mortgage ?? EMPTY_MORTGAGE
      return {
        ...p,
        factSheet: {
          ...f,
          mortgage: { ...prevM, ...patch },
        } as FactSheet,
      }
    })
  }, [onUpdateProp])

  const updateMortgagePurchasePrice = useCallback((raw: string) => {
    const n = parseFloat(raw.replace(/[^\d.]/g, ''))
    const price = Number.isFinite(n) ? n : null
    onUpdateProp((p) => {
      const f = (p.factSheet ?? {}) as FactSheet
      const prevM = f.mortgage ?? EMPTY_MORTGAGE
      const down = prevM.downPayment ?? 0
      const loan = price != null ? Math.max(0, price - down) : null
      return {
        ...p,
        factSheet: {
          ...f,
          purchasePrice: price,
          mortgage: { ...prevM, originalAmount: loan },
        } as FactSheet,
      }
    })
  }, [onUpdateProp])

  const commitMortgagePropertyValue = useCallback(
    (year: number, draft: string, purchaseY: number | null) => {
      const n = parseFloat(draft.replace(/[^\d.]/g, ''))
      setMtgPvEditYear(null)
      setMtgPvEditDraft('')
      if (!Number.isFinite(n) || n <= 0) return
      if (purchaseY != null && year === purchaseY) {
        onUpdateProp((p) => {
          const f = (p.factSheet ?? {}) as FactSheet
          const prevM = f.mortgage ?? EMPTY_MORTGAGE
          const down = prevM.downPayment ?? 0
          const loan = Math.max(0, n - down)
          const ph = { ...(f.priceHistory ?? {}) }
          delete ph[year]
          return {
            ...p,
            factSheet: {
              ...f,
              purchasePrice: n,
              priceHistory: ph,
              mortgage: { ...prevM, originalAmount: loan },
            } as FactSheet,
          }
        })
        return
      }
      onUpdateProp((p) => {
        const f = (p.factSheet ?? {}) as FactSheet
        const ph = { ...(f.priceHistory ?? {}), [year]: n }
        return { ...p, factSheet: { ...f, priceHistory: ph } as FactSheet }
      })
    },
    [onUpdateProp],
  )

  const clearMortgagePropertyOverride = useCallback(
    (year: number, purchaseY: number | null) => {
      if (purchaseY != null && year === purchaseY) return
      onUpdateProp((p) => {
        const f = (p.factSheet ?? {}) as FactSheet
        const ph = { ...(f.priceHistory ?? {}) }
        delete ph[year]
        return { ...p, factSheet: { ...f, priceHistory: ph } as FactSheet }
      })
    },
    [onUpdateProp],
  )

  const updateDownPayment = useCallback((raw: string) => {
    const n = parseFloat(raw.replace(/[^\d.]/g, ''))
    const down = Number.isFinite(n) ? n : null
    onUpdateProp((p) => {
      const f = (p.factSheet ?? {}) as FactSheet
      const prevM = f.mortgage ?? EMPTY_MORTGAGE
      const price = f.purchasePrice
      const downEff = down ?? 0
      const loan = price != null ? Math.max(0, price - downEff) : null
      return {
        ...p,
        factSheet: {
          ...f,
          mortgage: { ...prevM, downPayment: down, originalAmount: loan },
        } as FactSheet,
      }
    })
  }, [onUpdateProp])

  const setMtgPurchaseDate = useCallback((d: string) => {
    onUpdateProp((p) => {
      const f = (p.factSheet ?? {}) as FactSheet
      const prevM = f.mortgage ?? EMPTY_MORTGAGE
      return {
        ...p,
        factSheet: {
          ...f,
          purchaseDate: d,
          valueEquityView: 'mortgage',
          mortgage: { ...prevM, startDate: d },
        } as FactSheet,
      }
    })
  }, [onUpdateProp])

  const { curVal, estimateYear } = useMemo(() => {
    if (!fs) return { curVal: null as number | null, estimateYear: null as number | null }

    const purchasePrice = fs.purchasePrice
    const purchaseDate = fs.purchaseDate
    const purchaseYear = purchaseDate ? new Date(purchaseDate).getFullYear() : NaN
    const canModel =
      purchasePrice != null &&
      purchasePrice > 0 &&
      Boolean(purchaseDate) &&
      !Number.isNaN(purchaseYear)

    if (canModel && purchasePrice != null) {
      const appreciationRate = fs.appreciationRate ?? 5
      const priceHistory = fs.priceHistory ?? {}
      let prev = purchasePrice
      let value = purchasePrice
      for (let y = purchaseYear + 1; y <= currentYear; y++) {
        if (priceHistory[y] != null) value = priceHistory[y]!
        else value = prev * (1 + appreciationRate / 100)
        prev = value
      }
      return { curVal: value, estimateYear: currentYear }
    }

    if (fs.currentValue != null) return { curVal: fs.currentValue, estimateYear: null }

    return { curVal: null, estimateYear: null }
  }, [fs, currentYear])

  const purchasePrice = fs?.purchasePrice ?? null
  const equity = curVal != null ? curVal - outstandingBalance : null
  const appreciation = purchasePrice != null && curVal != null ? curVal - purchasePrice : null
  const appreciationPct = purchasePrice && curVal ? ((curVal - purchasePrice) / purchasePrice) * 100 : null
  const ltv = curVal && outstandingBalance > 0 ? (outstandingBalance / curVal) * 100 : null
  const equityPct = curVal && equity != null && curVal > 0 ? (equity / curVal) * 100 : null

  const setOwnershipMode = (mode: 'outright' | 'financed') => {
    const nextHas = mode === 'financed'
    onUpdateProp((p) => {
      const f = (p.factSheet ?? {}) as FactSheet
      const prevM = f.mortgage ?? EMPTY_MORTGAGE
      return {
        ...p,
        factSheet: {
          ...f,
          valueEquityView: nextHas ? 'mortgage' : 'history',
          mortgage: { ...prevM, hasMortgage: nextHas },
        } as FactSheet,
      }
    })
  }

  const setFunctionalCurrency = (code: CurrencyCode) => {
    onUpdateProp((p) => ({ ...p, currency: code }))
  }

  const outrightProjection = useMemo(() => {
    if (mortgage.hasMortgage || !fs) return null
    const date = fs.purchaseDate
    const price = fs.purchasePrice
    const rate = fs.appreciationRate ?? null
    const years = fs.projectionYears
    if (!date || price == null || price <= 0 || rate == null || years == null || years < 0) return null
    return buildOutrightProjectionRows(date, price, rate, Math.round(years), fs.priceHistory)
  }, [mortgage.hasMortgage, fs])

  const outrightProjectionReady = Boolean(outrightProjection && outrightProjection.length > 0)
  const outrightBaseYear = outrightProjection?.[0]?.year ?? null
  const outrightChartData = useMemo(
    () => outrightProjection?.map((r) => ({ year: r.year, value: r.value })) ?? [],
    [outrightProjection],
  )

  const commitOutrightPriceCell = useCallback(
    (year: number, draft: string, baseYear: number | null) => {
      const n = parseFloat(draft.replace(/[^\d.]/g, ''))
      setPhEditYear(null)
      setPhEditDraft('')
      if (!Number.isFinite(n) || n <= 0 || baseYear == null) return
      if (year === baseYear) {
        patchFactSheet({ purchasePrice: n })
        return
      }
      onUpdateProp((p) => {
        const f = (p.factSheet ?? {}) as FactSheet
        const ph = { ...(f.priceHistory ?? {}), [year]: n }
        return { ...p, factSheet: { ...f, priceHistory: ph } as FactSheet }
      })
    },
    [onUpdateProp, patchFactSheet],
  )

  const clearOutrightPriceOverride = useCallback(
    (year: number, baseYear: number | null) => {
      if (baseYear == null || year === baseYear) return
      onUpdateProp((p) => {
        const f = (p.factSheet ?? {}) as FactSheet
        const ph = { ...(f.priceHistory ?? {}) }
        delete ph[year]
        return { ...p, factSheet: { ...f, priceHistory: ph } as FactSheet }
      })
    },
    [onUpdateProp],
  )

  const copyOutrightYearly = useCallback(async () => {
    if (!outrightProjection?.length) return
    const header = ['Year', 'Property value', 'Change %']
    const lines = [
      header.join('\t'),
      ...outrightProjection.map((r) => {
        const chg =
          r.yoyPct == null ? '' : `${r.yoyPct >= 0 ? '+' : ''}${r.yoyPct.toFixed(1)}%`
        return [r.year, r.value.toFixed(2), chg].join('\t')
      }),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      /* ignore */
    }
  }, [outrightProjection])

  const mortgageViz = useMemo(() => {
    if (!mortgage.hasMortgage || !fs) return null
    const date = fs.purchaseDate
    const price = fs.purchasePrice
    const downPmt = mortgage.downPayment ?? 0
    const termYears = mortgage.termMonths != null ? mortgage.termMonths / 12 : null
    const interest = mortgage.interestRate
    const appreciation = fs.appreciationRate ?? 0
    if (!date || price == null || price <= 0 || termYears == null || termYears <= 0 || interest == null || interest < 0) return null
    const loan = Math.max(0, price - downPmt)
    if (loan <= 0) return null
    const purchaseYear = new Date(`${date}T12:00:00`).getFullYear()
    if (Number.isNaN(purchaseYear)) return null
    const termMonths = Math.max(1, Math.round(termYears * 12))
    return buildAmortScheduleYearly(
      loan,
      interest,
      termMonths,
      price,
      appreciation,
      purchaseYear,
      purchaseYear,
      fs.priceHistory,
    )
  }, [mortgage.hasMortgage, fs, mortgage.termMonths, mortgage.interestRate, mortgage.downPayment])

  const mortgageMetrics = useMemo(() => {
    if (!mortgageViz?.yearly.length) return null
    const rows = mortgageViz.yearly
    const loan = rows[0]?.beginBalance ?? 0
    const totalInterest = rows.reduce((s, r) => s + r.interestPaid, 0)
    const last = rows[rows.length - 1]
    const purchase = fs?.purchasePrice ?? 0
    const ltvPct = purchase > 0 ? (loan / purchase) * 100 : 0
    const interestPctOfPrincipal = loan > 0 ? (totalInterest / loan) * 100 : 0
    const termYears = rows.length
    const rate = mortgage.interestRate ?? 0
    return {
      loan,
      monthlyPayment: mortgageViz.monthlyPayment,
      totalInterest,
      totalCost: loan + totalInterest,
      finalEquity: last.equity,
      finalPropertyValue: last.propertyValue,
      finalYear: last.year,
      ltvPct,
      interestPctOfPrincipal,
      termYears,
      rate,
    }
  }, [mortgageViz, fs?.purchasePrice, mortgage.interestRate])

  const ownersResolved = useMemo((): OwnershipEntry[] => {
    if (fs?.owners?.length) return fs.owners
    if (prop.owner)
      return [{ id: 0, name: prop.owner, idNumber: '', equityPct: 100, notes: '' }]
    return []
  }, [fs?.owners, prop.owner])

  const primary = ownersResolved[0]
  const ownerName = primary?.name ?? ''
  const ownerEquityPct = primary != null ? primary.equityPct : 100

  const patchPrimaryOwner = (patch: Partial<Pick<OwnershipEntry, 'name' | 'equityPct'>>) => {
    onUpdateProp((p) => {
      const f = (p.factSheet ?? {}) as FactSheet
      const current: OwnershipEntry[] = f.owners?.length
        ? [...f.owners]
        : p.owner
          ? [{ id: 0, name: p.owner, idNumber: '', equityPct: 100, notes: '' }]
          : []

      let next: OwnershipEntry[]
      if (current.length === 0) {
        next = [{
          id: Date.now(),
          name: patch.name ?? '',
          idNumber: '',
          equityPct:
            patch.equityPct !== undefined && Number.isFinite(patch.equityPct) ? patch.equityPct : 100,
          notes: '',
        }]
      } else {
        next = current.map((o, i) => (i === 0 ? { ...o, ...patch } : o))
      }

      const primaryOwner = next[0]?.name || ''
      const ownerDisplay = next.length <= 2
        ? next.map((o) => o.name).filter(Boolean).join(', ')
        : `${primaryOwner} +${next.length - 1}`

      return {
        ...p,
        owner: ownerDisplay || p.owner,
        factSheet: { ...f, owners: next } as FactSheet,
      } as Property
    })
  }

  const tableTh: CSSProperties = {
    textAlign: 'right',
    padding: '12px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.55px',
    background: 'var(--surface2)',
    whiteSpace: 'nowrap',
  }
  const tableThFirst: CSSProperties = { ...tableTh, textAlign: 'left' }
  const tableTd: CSSProperties = {
    textAlign: 'right',
    padding: '10px 14px',
    fontSize: 13,
    borderTop: '1px solid var(--border)',
  }
  const tableTdFirst: CSSProperties = { ...tableTd, textAlign: 'left', fontWeight: 500 }

  const mortgageChartData = mortgageViz?.yearly.map((r) => ({
    year: r.year,
    remainingDebt: r.endBalance,
    propertyValue: r.propertyValue,
    equity: r.equity,
    principalPaid: r.principalPaid,
    interestPaid: r.interestPaid,
  })) ?? []

  const mortgageProjectionReady = mortgageChartData.length > 0
  const showMortgageForm = mortgage.hasMortgage && mortgageEditOpen
  const showMortgageDashboard = mortgage.hasMortgage && mortgageProjectionReady && !mortgageEditOpen

  const copyMortgageSchedule = async () => {
    if (!mortgageViz?.yearly.length) return
    const header = ['Year', 'Beg. balance', 'Principal', 'Interest', 'End balance', 'Property value', 'Equity']
    const lines = [
      header.join('\t'),
      ...mortgageViz.yearly.map((r) =>
        [
          r.year,
          r.beginBalance.toFixed(2),
          r.principalPaid.toFixed(2),
          r.interestPaid.toFixed(2),
          r.endBalance.toFixed(2),
          r.propertyValue.toFixed(2),
          r.equity.toFixed(2),
        ].join('\t')),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Current Value</div>
          <div className="kpi-value">{curVal != null ? fmtCurrency(cx(curVal), dc) : '—'}</div>
          {estimateYear != null && curVal != null && (
            <div className="kpi-sub">{estimateYear} estimate</div>
          )}
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Equity</div>
          <div className={`kpi-value${equity != null && equity > 0 ? ' green' : ''}`}>
            {equity != null ? fmtCurrency(cx(equity), dc) : '—'}
          </div>
          {equityPct != null && <div className="kpi-sub">{equityPct.toFixed(1)}% of value</div>}
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Appreciation</div>
          <div className={`kpi-value${appreciation != null ? (appreciation >= 0 ? ' green' : ' red') : ''}`}>
            {appreciation != null ? fmtCurrency(cx(appreciation), dc) : '—'}
          </div>
          {appreciationPct != null && (
            <div className="kpi-sub">
              {(appreciationPct >= 0 ? '+' : '') + appreciationPct.toFixed(1)}% total
            </div>
          )}
        </div>
        <div className="kpi-card">
          <div className="kpi-label">LTV Ratio</div>
          <div className="kpi-value">
            {ltv != null ? `${ltv.toFixed(1)}%` : mortgage.hasMortgage ? '—' : 'No debt'}
          </div>
          {outstandingBalance > 0 && (
            <div className="kpi-sub">Debt: {fmtCurrency(cx(outstandingBalance), dc)}</div>
          )}
        </div>
      </div>

      <div className="card mb24">
        <div className="card-inner" aria-label="Ownership details">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="sec-title" style={{ margin: 0 }}>Ownership details</span>
            <button type="button" style={FS_EDIT_BTN} onClick={() => setRealEstateEditing((v) => !v)}>
              {realEstateEditing ? 'Done' : 'Edit'}
            </button>
          </div>
          {realEstateEditing
            ? (
                <div className="contract-grid">
                  <div className="field">
                    <label htmlFor="ve-ownership-select">How do you own this property?</label>
                    <select
                      id="ve-ownership-select"
                      value={mortgage.hasMortgage ? 'financed' : 'outright'}
                      onChange={(e) => setOwnershipMode(e.target.value as 'outright' | 'financed')}
                    >
                      <option value="outright">Owned outright</option>
                      <option value="financed">Financed / Mortgage</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="ve-currency-select">Functional currency</label>
                    <CurrencySelect
                      buttonId="ve-currency-select"
                      value={functionalCurrency}
                      onChange={setFunctionalCurrency}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ve-owner-name">Owner name</label>
                    <input
                      id="ve-owner-name"
                      type="text"
                      autoComplete="name"
                      placeholder="e.g. Jane Smith"
                      value={ownerName}
                      onChange={(e) => patchPrimaryOwner({ name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ve-owner-equity">Equity %</label>
                    <input
                      id="ve-owner-equity"
                      type="text"
                      inputMode="decimal"
                      placeholder="100"
                      value={primary != null ? String(ownerEquityPct) : ''}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value.replace(/[^\d.]/g, ''))
                        patchPrimaryOwner({ equityPct: Number.isFinite(n) ? n : 0 })
                      }}
                    />
                  </div>
                </div>
              )
            : (
                <div className="ct-fields">
                  <ReadOnlyField
                    label="Ownership"
                    value={mortgage.hasMortgage ? 'Financed / Mortgage' : 'Owned outright'}
                  />
                  <ReadOnlyField
                    label="Functional currency"
                    value={`${functionalCurrency} (${CURRENCIES[functionalCurrency].symbol})`}
                  />
                  <ReadOnlyField label="Owner name" value={ownerName || undefined} />
                  <ReadOnlyField
                    label="Equity %"
                    value={primary != null ? `${ownerEquityPct}` : '—'}
                  />
                </div>
              )}
        </div>
      </div>

      <div className="card mb24">
        <div className="card-inner">
          {!mortgage.hasMortgage
            ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span className="sec-title" style={{ margin: 0 }}>Price History (Yearly)</span>
                    <button type="button" style={FS_EDIT_BTN} onClick={() => setOutrightEditing((v) => !v)}>
                      {outrightEditing ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  {outrightEditing
                    ? (
                        <div className="contract-grid">
                          <div className="field">
                            <label htmlFor="ve-owned-since">Owned since</label>
                            <input
                              id="ve-owned-since"
                              type="date"
                              value={toDateInputValue(fs?.purchaseDate ?? '')}
                              onChange={(e) => patchFactSheet({ purchaseDate: e.target.value, valueEquityView: 'history' })}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="ve-outright-currency">Functional currency</label>
                            <CurrencySelect
                              buttonId="ve-outright-currency"
                              value={functionalCurrency}
                              onChange={setFunctionalCurrency}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="ve-outright-price">Purchase price</label>
                            <input
                              id="ve-outright-price"
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={fs?.purchasePrice != null ? String(fs.purchasePrice) : ''}
                              onChange={(e) => {
                                const n = parseFloat(e.target.value.replace(/[^\d.]/g, ''))
                                patchFactSheet({ purchasePrice: Number.isFinite(n) ? n : null })
                              }}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="ve-outright-rate">Annual appreciation (%)</label>
                            <input
                              id="ve-outright-rate"
                              type="text"
                              inputMode="decimal"
                              placeholder="6"
                              value={fs?.appreciationRate != null ? String(fs.appreciationRate) : ''}
                              onChange={(e) => {
                                const n = parseFloat(e.target.value.replace(/[^\d.]/g, ''))
                                patchFactSheet({ appreciationRate: Number.isFinite(n) ? n : undefined })
                              }}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="ve-outright-years">Years of projection</label>
                            <input
                              id="ve-outright-years"
                              type="text"
                              inputMode="numeric"
                              placeholder="15"
                              value={fs?.projectionYears != null ? String(fs.projectionYears) : ''}
                              onChange={(e) => {
                                const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
                                patchFactSheet({ projectionYears: Number.isFinite(n) ? n : undefined })
                              }}
                            />
                          </div>
                        </div>
                      )
                    : (
                        <div className="ct-fields">
                          <ReadOnlyField label="Owned since" value={fmtDisplayDate(fs?.purchaseDate)} />
                          <ReadOnlyField
                            label="Currency"
                            value={`${functionalCurrency} (${CURRENCIES[functionalCurrency].symbol})`}
                          />
                          <ReadOnlyField
                            label="Purchase price"
                            value={fs?.purchasePrice != null ? fmtCurrency(cx(fs.purchasePrice), dc) : undefined}
                          />
                          <ReadOnlyField
                            label="Annual appreciation"
                            value={fs?.appreciationRate != null ? `${fs.appreciationRate}%` : undefined}
                          />
                          <ReadOnlyField label="Years of projection" value={fs?.projectionYears} />
                        </div>
                      )}
                  {!outrightProjectionReady && !outrightEditing && (
                    <>
                      <div className="divider" />
                      <div className="empty-state" style={{ padding: '24px 16px 16px' }}>
                        <div className="empty-title">Fill in price history</div>
                        <div className="fs12 text3 mt4" style={{ maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.45 }}>
                          Add purchase date, purchase price, annual appreciation, and years of projection to see projected values by year.
                        </div>
                        <button
                          type="button"
                          className="primary mt12"
                          style={{ fontSize: 12, padding: '5px 14px' }}
                          onClick={() => setOutrightEditing(true)}
                        >
                          Edit details
                        </button>
                      </div>
                    </>
                  )}
                  {outrightProjectionReady && outrightProjection && outrightBaseYear != null && (
                    <>
                      <div className="divider" style={{ marginTop: 20 }} />
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                        <div
                          role="tablist"
                          aria-label="Visual trendline or historic prices"
                          style={{
                            display: 'inline-flex',
                            background: 'var(--surface2)',
                            borderRadius: 999,
                            padding: 3,
                            border: '1px solid var(--border)',
                            gap: 2,
                          }}
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={priceHistoryDisplayMode === 'trend'}
                            onClick={() => {
                              setPriceHistoryDisplayMode('trend')
                              setPhEditYear(null)
                              setPhEditDraft('')
                            }}
                            style={{
                              border: 'none',
                              borderRadius: 999,
                              padding: '8px 16px',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              background: priceHistoryDisplayMode === 'trend' ? 'var(--accent-hover)' : 'transparent',
                              color: priceHistoryDisplayMode === 'trend' ? '#fff' : 'var(--text2)',
                            }}
                          >
                            Visual trendline
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={priceHistoryDisplayMode === 'table'}
                            onClick={() => setPriceHistoryDisplayMode('table')}
                            style={{
                              border: 'none',
                              borderRadius: 999,
                              padding: '8px 16px',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              background: priceHistoryDisplayMode === 'table' ? 'var(--accent-hover)' : 'transparent',
                              color: priceHistoryDisplayMode === 'table' ? '#fff' : 'var(--text2)',
                            }}
                          >
                            Historic prices
                          </button>
                        </div>
                      </div>
                      {priceHistoryDisplayMode === 'trend'
                        ? (
                            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.45 }}>
                              Projected property value by year (includes manual overrides). Use Historic prices to edit yearly values.
                            </p>
                          )
                        : (
                            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.45 }}>
                              Click a property value to override that year; later years compound from it using your annual appreciation rate.
                            </p>
                          )}
                      {priceHistoryDisplayMode === 'trend'
                        ? (
                            <div className="prop-table-scroll" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 8px 4px' }}>
                              <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart data={outrightChartData} margin={{ top: 10, right: 8, left: 4, bottom: 4 }}>
                                    <defs>
                                      <linearGradient id={`ph-trend-${prop.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={EQ_DEBT_CHART.equity} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={EQ_DEBT_CHART.equity} stopOpacity={0} />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke={EQ_DEBT_CHART.grid} strokeDasharray="2 6" />
                                    <XAxis
                                      dataKey="year"
                                      tick={{ fontSize: 11, fill: EQ_DEBT_CHART.axisTick }}
                                      axisLine={{ stroke: EQ_DEBT_CHART.grid }}
                                      tickLine={{ stroke: EQ_DEBT_CHART.grid }}
                                    />
                                    <YAxis
                                      tick={{ fontSize: 11, fill: EQ_DEBT_CHART.axisTick }}
                                      width={56}
                                      axisLine={false}
                                      tickLine={{ stroke: EQ_DEBT_CHART.grid }}
                                      tickFormatter={(v) => {
                                        const n = Number(v)
                                        if (!Number.isFinite(n)) return ''
                                        return fmtCompactCurrency(n, dc, cx)
                                      }}
                                    />
                                    <Tooltip
                                      formatter={(value) =>
                                        fmtCurrency(cx(typeof value === 'number' ? value : Number(value)), dc)}
                                      labelFormatter={(y) => `Year ${y}`}
                                      contentStyle={{
                                        borderRadius: 12,
                                        border: `1px solid ${EQ_DEBT_CHART.grid}`,
                                        fontSize: 13,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                                      }}
                                    />
                                    <Legend iconType="line" wrapperStyle={{ fontSize: 12, paddingTop: 4 }} formatter={(v) => <span style={{ color: '#546e7a', fontWeight: 500 }}>{v}</span>} />
                                    <Area
                                      type="monotone"
                                      dataKey="value"
                                      stroke="none"
                                      fill={`url(#ph-trend-${prop.id})`}
                                      dot={false}
                                      isAnimationActive={false}
                                      legendType="none"
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="value"
                                      name="Property value"
                                      stroke={EQ_DEBT_CHART.equity}
                                      strokeWidth={2.5}
                                      dot={false}
                                      activeDot={{ r: 4, fill: EQ_DEBT_CHART.equity, strokeWidth: 0 }}
                                    />
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )
                        : (
                      <div className="prop-table-scroll" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                          <thead>
                            <tr>
                              <th style={tableThFirst}>Year</th>
                              <th style={tableTh}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  Property value
                                  <span style={{ color: 'var(--text3)' }} aria-hidden><IconPencilSmall /></span>
                                </span>
                              </th>
                              <th style={tableTh}>Change</th>
                              <th style={{ ...tableTh, width: 48, textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="ghost"
                                  title="Copy historic prices"
                                  aria-label="Copy historic prices table"
                                  onClick={() => void copyOutrightYearly()}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 4,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: 'var(--text3)',
                                    borderRadius: 6,
                                  }}
                                >
                                  <IconCopySmall />
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {outrightProjection.map((row) => {
                              const isBase = row.year === outrightBaseYear
                              const hasOv = !isBase && fs?.priceHistory?.[row.year] != null
                              const editing = phEditYear === row.year
                              return (
                                <tr key={row.year}>
                                  <td style={{ ...tableTdFirst, fontWeight: 700 }}>{row.year}</td>
                                  <td
                                    style={{ ...tableTd, cursor: 'pointer', color: hasOv ? 'var(--accent-hover)' : 'var(--text)' }}
                                    title="Click to edit"
                                    onClick={() => {
                                      if (!editing) {
                                        setPhEditYear(row.year)
                                        setPhEditDraft(row.value.toFixed(2))
                                      }
                                    }}
                                  >
                                    {editing
                                      ? (
                                          <input
                                            autoFocus
                                            type="text"
                                            inputMode="decimal"
                                            value={phEditDraft}
                                            onChange={(e) => setPhEditDraft(e.target.value)}
                                            onBlur={() => commitOutrightPriceCell(row.year, phEditDraft, outrightBaseYear)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.currentTarget.blur()
                                              }
                                              if (e.key === 'Escape') {
                                                setPhEditYear(null)
                                                setPhEditDraft('')
                                              }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              width: '100%',
                                              maxWidth: 140,
                                              textAlign: 'right',
                                              padding: '4px 8px',
                                              fontSize: 13,
                                              border: '1px solid var(--accent-bg)',
                                              borderRadius: 8,
                                              background: 'var(--surface)',
                                              color: 'var(--text)',
                                            }}
                                          />
                                        )
                                      : (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
                                            {fmtCurrency(cx(row.value), dc)}
                                            {hasOv && (
                                              <button
                                                type="button"
                                                title="Clear override"
                                                className="ghost"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  clearOutrightPriceOverride(row.year, outrightBaseYear)
                                                }}
                                                style={{
                                                  padding: '0 4px',
                                                  fontSize: 11,
                                                  color: 'var(--text3)',
                                                  border: 'none',
                                                  background: 'transparent',
                                                  cursor: 'pointer',
                                                  lineHeight: 1,
                                                }}
                                              >
                                                ×
                                              </button>
                                            )}
                                          </span>
                                        )}
                                  </td>
                                  <td style={tableTd}>
                                    {row.yoyPct == null
                                      ? <span style={{ color: 'var(--text3)' }}>—</span>
                                      : (
                                          <span
                                            style={{
                                              color: row.yoyPct >= 0 ? EQ_DEBT_CHART.equity : '#b91c1c',
                                              fontWeight: 600,
                                            }}
                                          >
                                            {row.yoyPct >= 0 ? '▲' : '▼'}
                                            {' '}
                                            {Math.abs(row.yoyPct).toFixed(1)}%
                                          </span>
                                        )}
                                  </td>
                                  <td style={tableTd} aria-hidden />
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                          )}
                    </>
                  )}
                </>
              )
            : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span className="sec-title" style={{ margin: 0 }}>Mortgage Details</span>
                    <button type="button" style={FS_EDIT_BTN} onClick={() => setMortgageEditOpen((v) => !v)}>
                      {mortgageEditOpen ? 'Done' : 'Edit'}
                    </button>
                  </div>

                  {showMortgageForm && (
                    <div className="contract-grid">
                      <div className="field">
                        <label htmlFor="ve-mtg-date">Purchase date</label>
                        <input
                          id="ve-mtg-date"
                          type="date"
                          value={toDateInputValue(fs?.purchaseDate ?? '')}
                          onChange={(e) => setMtgPurchaseDate(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ve-mtg-currency">Functional currency</label>
                        <CurrencySelect
                          buttonId="ve-mtg-currency"
                          value={functionalCurrency}
                          onChange={setFunctionalCurrency}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ve-mtg-price">Purchase price</label>
                        <input
                          id="ve-mtg-price"
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={fs?.purchasePrice != null ? String(fs.purchasePrice) : ''}
                          onChange={(e) => updateMortgagePurchasePrice(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ve-mtg-down">Down payment</label>
                        <input
                          id="ve-mtg-down"
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={mortgage.downPayment != null ? String(mortgage.downPayment) : ''}
                          onChange={(e) => updateDownPayment(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ve-mtg-term">Term (years)</label>
                        <input
                          id="ve-mtg-term"
                          type="text"
                          inputMode="decimal"
                          placeholder="20"
                          value={mortgage.termMonths != null ? String(Math.round(mortgage.termMonths / 12)) : ''}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value.replace(/[^\d.]/g, ''))
                            patchMortgage({ termMonths: Number.isFinite(n) && n > 0 ? Math.round(n * 12) : null })
                          }}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ve-mtg-interest">Interest rate (% E.A.)</label>
                        <input
                          id="ve-mtg-interest"
                          type="text"
                          inputMode="decimal"
                          placeholder="5"
                          value={mortgage.interestRate != null ? String(mortgage.interestRate) : ''}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value.replace(/[^\d.]/g, ''))
                            patchMortgage({ interestRate: Number.isFinite(n) ? n : null })
                          }}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ve-mtg-appreciation">Annual appreciation (%)</label>
                        <input
                          id="ve-mtg-appreciation"
                          type="text"
                          inputMode="decimal"
                          placeholder="6"
                          value={fs?.appreciationRate != null ? String(fs.appreciationRate) : ''}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value.replace(/[^\d.]/g, ''))
                            patchFactSheet({ appreciationRate: Number.isFinite(n) ? n : undefined })
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {!mortgageEditOpen && !mortgageProjectionReady && (
                    <>
                      <div className="ct-fields">
                        <ReadOnlyField label="Purchase date" value={fmtDisplayDate(fs?.purchaseDate)} />
                        <ReadOnlyField
                          label="Currency"
                          value={`${functionalCurrency} (${CURRENCIES[functionalCurrency].symbol})`}
                        />
                        <ReadOnlyField
                          label="Purchase price"
                          value={fs?.purchasePrice != null ? fmtCurrency(cx(fs.purchasePrice), dc) : undefined}
                        />
                        <ReadOnlyField
                          label="Down payment"
                          value={
                            mortgage.downPayment != null ? fmtCurrency(cx(mortgage.downPayment), dc) : undefined
                          }
                        />
                        <ReadOnlyField
                          label="Term (years)"
                          value={
                            mortgage.termMonths != null && mortgage.termMonths > 0
                              ? Math.round(mortgage.termMonths / 12)
                              : undefined
                          }
                        />
                        <ReadOnlyField
                          label="Interest rate (% E.A.)"
                          value={mortgage.interestRate != null ? `${mortgage.interestRate}%` : undefined}
                        />
                        <ReadOnlyField
                          label="Annual appreciation"
                          value={fs?.appreciationRate != null ? `${fs.appreciationRate}%` : undefined}
                        />
                      </div>
                      <div className="divider" />
                      <div className="empty-state" style={{ padding: '24px 16px 16px' }}>
                        <div className="empty-title">Fill in mortgage details</div>
                        <div className="fs12 text3 mt4" style={{ maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.45 }}>
                          Add purchase date, price, down payment, loan term, interest rate, and appreciation to see amortization, equity, and payment breakdowns.
                        </div>
                        <button
                          type="button"
                          className="primary mt12"
                          style={{ fontSize: 12, padding: '5px 14px' }}
                          onClick={() => setMortgageEditOpen(true)}
                        >
                          Edit details
                        </button>
                      </div>
                    </>
                  )}

                  {showMortgageDashboard && mortgageMetrics && mortgageViz && (
                  <>
                    <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(124px, 1fr))', gap: 12, marginBottom: 24 }}>
                      <div className="kpi-card">
                        <div className="kpi-label">Loan amount</div>
                        <div className="kpi-value" style={{ color: 'var(--accent-hover)' }}>{fmtCompactCurrency(mortgageMetrics.loan, dc, cx)}</div>
                        <div className="kpi-sub">{Number.isInteger(mortgageMetrics.rate) ? mortgageMetrics.rate : mortgageMetrics.rate.toFixed(2)}% fixed · {mortgageMetrics.termYears}yr</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-label">Monthly payment (P&I)</div>
                        <div className="kpi-value" style={{ color: 'var(--accent-hover)' }}>{fmtCurrency(cx(mortgageMetrics.monthlyPayment), dc)}</div>
                        <div className="kpi-sub">LTV {mortgageMetrics.ltvPct.toFixed(1)}%</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-label">Total interest</div>
                        <div className="kpi-value red">{fmtCompactCurrency(mortgageMetrics.totalInterest, dc, cx)}</div>
                        <div className="kpi-sub">{mortgageMetrics.interestPctOfPrincipal.toFixed(1)}% of principal</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-label">{`Final equity (yr ${mortgageMetrics.termYears})`}</div>
                        <div className="kpi-value" style={{ color: '#0d9488' }}>{fmtCompactCurrency(mortgageMetrics.finalEquity, dc, cx)}</div>
                        <div className="kpi-sub">Property: {fmtCompactCurrency(mortgageMetrics.finalPropertyValue, dc, cx)}</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-label">Total cost of loan</div>
                        <div className="kpi-value" style={{ color: 'var(--accent-hover)' }}>{fmtCompactCurrency(mortgageMetrics.totalCost, dc, cx)}</div>
                        <div className="kpi-sub">Principal + interest</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
                      <div
                        role="tablist"
                        aria-label="Mortgage view"
                        style={{
                          display: 'inline-flex',
                          background: 'var(--surface2)',
                          borderRadius: 999,
                          padding: 3,
                          border: '1px solid var(--border)',
                          gap: 2,
                        }}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mortgageViewMode === 'visual'}
                          onClick={() => setMortgageViewMode('visual')}
                          style={{
                            border: 'none',
                            borderRadius: 999,
                            padding: '8px 18px',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: mortgageViewMode === 'visual' ? 'var(--accent-hover)' : 'transparent',
                            color: mortgageViewMode === 'visual' ? '#fff' : 'var(--text2)',
                          }}
                        >
                          Visual Breakdown
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mortgageViewMode === 'schedule'}
                          onClick={() => setMortgageViewMode('schedule')}
                          style={{
                            border: 'none',
                            borderRadius: 999,
                            padding: '8px 18px',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: mortgageViewMode === 'schedule' ? 'var(--accent-hover)' : 'transparent',
                            color: mortgageViewMode === 'schedule' ? '#fff' : 'var(--text2)',
                          }}
                        >
                          Full Schedule
                        </button>
                      </div>
                    </div>

                    {mortgageViewMode === 'visual'
                      ? (
                          <>
                            <h3
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: EQ_DEBT_CHART.axisTick,
                                margin: '0 0 14px',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                              }}
                            >
                              Equity growth vs remaining debt
                            </h3>
                            <div style={{ width: '100%', height: 300, marginBottom: 32 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={mortgageChartData} margin={{ top: 10, right: 8, left: 4, bottom: 4 }}>
                                  <defs>
                                    <linearGradient id={`equity-area-${prop.id}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={EQ_DEBT_CHART.equity} stopOpacity={0.35} />
                                      <stop offset="55%" stopColor={EQ_DEBT_CHART.equity} stopOpacity={0.1} />
                                      <stop offset="100%" stopColor={EQ_DEBT_CHART.equity} stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid stroke={EQ_DEBT_CHART.grid} strokeDasharray="2 6" vertical />
                                  <XAxis
                                    dataKey="year"
                                    tick={{ fontSize: 11, fill: EQ_DEBT_CHART.axisTick }}
                                    axisLine={{ stroke: EQ_DEBT_CHART.grid }}
                                    tickLine={{ stroke: EQ_DEBT_CHART.grid }}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 11, fill: EQ_DEBT_CHART.axisTick }}
                                    width={56}
                                    axisLine={false}
                                    tickLine={{ stroke: EQ_DEBT_CHART.grid }}
                                    tickFormatter={(v) => {
                                      const n = Number(v)
                                      if (!Number.isFinite(n)) return ''
                                      if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
                                      if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
                                      return `$${Math.round(n)}`
                                    }}
                                  />
                                  <Tooltip
                                    formatter={(value) =>
                                      fmtCurrency(cx(typeof value === 'number' ? value : Number(value)), dc)}
                                    labelFormatter={(y) => `Year ${y}`}
                                    contentStyle={{
                                      borderRadius: 12,
                                      border: `1px solid ${EQ_DEBT_CHART.grid}`,
                                      fontSize: 13,
                                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                                    }}
                                  />
                                  <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                                    formatter={(value) => <span style={{ color: '#546e7a', fontWeight: 500 }}>{value}</span>}
                                  />
                                  {mortgageChartData[0] != null && (
                                    <ReferenceLine
                                      x={mortgageChartData[0].year}
                                      stroke={EQ_DEBT_CHART.refLine}
                                      strokeDasharray="4 4"
                                      strokeWidth={1}
                                    />
                                  )}
                                  <Area
                                    type="monotone"
                                    dataKey="equity"
                                    name="Equity"
                                    stroke={EQ_DEBT_CHART.equity}
                                    strokeWidth={2.5}
                                    fill={`url(#equity-area-${prop.id})`}
                                    dot={false}
                                    activeDot={false}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="remainingDebt"
                                    name="Remaining debt"
                                    stroke={EQ_DEBT_CHART.debt}
                                    strokeWidth={2.5}
                                    dot={false}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="propertyValue"
                                    name="Property value"
                                    stroke={EQ_DEBT_CHART.property}
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                  />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>

                            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
                              Annual Payment Breakdown — Principal vs Interest
                            </h3>
                            <div style={{ width: '100%', height: 300 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mortgageChartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                                  <CartesianGrid stroke={EQ_DEBT_CHART.grid} strokeDasharray="2 6" />
                                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: EQ_DEBT_CHART.axisTick }} />
                                  <YAxis
                                    tick={{ fontSize: 11 }}
                                    width={48}
                                    tickFormatter={(v) => {
                                      const n = Number(v)
                                      if (!Number.isFinite(n)) return ''
                                      if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`
                                      return String(Math.round(n))
                                    }}
                                  />
                                  <Tooltip
                                    formatter={(value) =>
                                      fmtCurrency(cx(typeof value === 'number' ? value : Number(value)), dc)}
                                    labelFormatter={(y) => `Year ${y}`}
                                    contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                                  />
                                  <Legend wrapperStyle={{ fontSize: 13 }} />
                                  <Bar dataKey="principalPaid" name="Principal" stackId="pay" fill={EQ_DEBT_CHART.equity} />
                                  <Bar dataKey="interestPaid" name="Interest" stackId="pay" fill={EQ_DEBT_CHART.debt} radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        )
                      : (
                          <>
                            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.45 }}>
                              Click a property value to override that year (purchase year updates purchase price); equity recalculates from the new value.
                            </p>
                            <div className="prop-table-scroll" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                                <thead>
                                  <tr>
                                    <th style={tableThFirst}>Year</th>
                                    <th style={tableTh}>Beg. balance</th>
                                    <th style={tableTh}>Principal</th>
                                    <th style={tableTh}>Interest</th>
                                    <th style={tableTh}>End balance</th>
                                    <th style={tableTh}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        Property value
                                        <span style={{ color: 'var(--text3)' }} aria-hidden><IconPencilSmall /></span>
                                      </span>
                                    </th>
                                    <th style={tableTh}>Equity</th>
                                    <th style={{ ...tableTh, width: 48, textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        className="ghost"
                                        title="Copy schedule"
                                        aria-label="Copy full schedule to clipboard"
                                        onClick={() => void copyMortgageSchedule()}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          padding: 4,
                                          border: 'none',
                                          background: 'transparent',
                                          cursor: 'pointer',
                                          color: 'var(--text3)',
                                          borderRadius: 6,
                                        }}
                                      >
                                        <IconCopySmall />
                                      </button>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mortgageViz.yearly.map((r) => {
                                    const hasOv = fs?.priceHistory?.[r.year] != null
                                    const editing = mtgPvEditYear === r.year
                                    return (
                                      <tr key={r.year}>
                                        <td style={{ ...tableTdFirst, fontWeight: 700 }}>{r.year}</td>
                                        <td style={tableTd}>{fmtTableMoney(r.beginBalance, dc, cx)}</td>
                                        <td style={{ ...tableTd, color: '#16a34a', fontWeight: 600 }}>{fmtTableMoney(r.principalPaid, dc, cx)}</td>
                                        <td style={{ ...tableTd, color: '#ef4444', fontWeight: 600 }}>{fmtTableMoney(r.interestPaid, dc, cx)}</td>
                                        <td style={tableTd}>{fmtTableMoney(r.endBalance, dc, cx)}</td>
                                        <td
                                          style={{
                                            ...tableTd,
                                            cursor: 'pointer',
                                            color: hasOv ? 'var(--accent-hover)' : 'var(--text2)',
                                          }}
                                          title="Click to edit"
                                          onClick={() => {
                                            if (!editing) {
                                              setMtgPvEditYear(r.year)
                                              setMtgPvEditDraft(r.propertyValue.toFixed(2))
                                            }
                                          }}
                                        >
                                          {editing
                                            ? (
                                                <input
                                                  autoFocus
                                                  type="text"
                                                  inputMode="decimal"
                                                  value={mtgPvEditDraft}
                                                  onChange={(e) => setMtgPvEditDraft(e.target.value)}
                                                  onBlur={() =>
                                                    commitMortgagePropertyValue(r.year, mtgPvEditDraft, mortgagePurchaseYear)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                      e.currentTarget.blur()
                                                    }
                                                    if (e.key === 'Escape') {
                                                      setMtgPvEditYear(null)
                                                      setMtgPvEditDraft('')
                                                    }
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  style={{
                                                    width: '100%',
                                                    maxWidth: 140,
                                                    textAlign: 'right',
                                                    padding: '4px 8px',
                                                    fontSize: 13,
                                                    border: '1px solid var(--accent-bg)',
                                                    borderRadius: 8,
                                                    background: 'var(--surface)',
                                                    color: 'var(--text)',
                                                  }}
                                                />
                                              )
                                            : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
                                                  {fmtTableMoney(r.propertyValue, dc, cx)}
                                                  {hasOv && (
                                                    <button
                                                      type="button"
                                                      title="Clear override"
                                                      className="ghost"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        clearMortgagePropertyOverride(r.year, mortgagePurchaseYear)
                                                      }}
                                                      style={{
                                                        padding: '0 4px',
                                                        fontSize: 11,
                                                        color: 'var(--text3)',
                                                        border: 'none',
                                                        background: 'transparent',
                                                        cursor: 'pointer',
                                                        lineHeight: 1,
                                                      }}
                                                    >
                                                      ×
                                                    </button>
                                                  )}
                                                </span>
                                              )}
                                        </td>
                                        <td style={{ ...tableTd, color: '#0d9488', fontWeight: 700 }}>{fmtTableMoney(r.equity, dc, cx)}</td>
                                        <td style={tableTd} aria-hidden />
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                  </>
                  )}
                </>
              )}
        </div>
      </div>

    </div>
  )
}
