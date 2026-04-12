import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { CapexItem, CapexStatus, Contract, Property } from '../lib/types'
import type { Share } from '../lib/types'
import { subscribeViewerShares } from '../services/sharesService'
import { useAuth } from '../contexts/AuthContext'
import { useReadOnly } from '../context/ReadOnlyContext'
import { activeContract, calcAnnual, calcIrr, calcPortfolioAssetKpis, calcPortfolioProjectedGpiIn, calcPortfolioTotalsIn, contractCoveringDate, contractForMonth, convertAnnual, estimatedPropertyValueAtYear, hasNonLeaseOccupant, negotiatedFollowOnAfterContract, nextNegotiatedLeaseNotYetStarted, nonLeaseOccupancyExportValue, nonLeaseOccupancyLabel, occupancyFilterBucket, projectedGpiAnnual, vacancyLossMonthCount } from '../lib/finance'
import { fmtCurrencyM } from '../lib/format'
import { type CurrencyCode, type FxRates, CURRENCIES, CURRENCY_LIST, convert, loadFxRates, saveFxRates, flagUrl } from '../lib/currency'
import { useAppState } from '../context/useAppState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { getYearWindow } from '../lib/constants'
import { KpiInfoIcon } from '../components/KpiInfoIcon'
import { COUNTRIES, countryFlagUrl } from '../lib/countries'
import { PropertyLeaderboardMap } from '../components/PropertyLeaderboardMap'
import { AssetValueAppreciationCard } from '../components/AssetValueAppreciationCard'
// @ts-ignore — JS component, types inferred as any
import PortfolioReport from '../../Temp/PortfolioReport'
import { UpgradeModal } from '../components/modals/UpgradeModal'
import { useEntitlements } from '../hooks/useEntitlements'
import {
  evaluatePropertyAlerts,
  loadAlertRuleConfig,
  type AlertPropertyMetrics,
  type AlertSeverity,
  type EvaluatedAlertMatch,
} from '../lib/alertRuleConfig'
import { isUnmodifiedDefaultSeedPortfolio } from '../lib/seedProperties'

type Props = {
  properties: Property[]
  onSelectProperty: (id: number) => void
  onAddProperty?: () => void
}

const IconDots = () => (
  <svg width="36" height="26" viewBox="0 0 36 26" fill="none"><rect x="0.5" y="0.5" width="34.83" height="25" rx="5.5" stroke="#E8ECF2"/><path d="M13.7294 19.0909C13.4491 19.0909 13.2086 18.9905 13.0078 18.7898C12.8071 18.589 12.7067 18.3485 12.7067 18.0682C12.7067 17.7879 12.8071 17.5473 13.0078 17.3466C13.2086 17.1458 13.4491 17.0455 13.7294 17.0455C14.0097 17.0455 14.2503 17.1458 14.451 17.3466C14.6518 17.5473 14.7521 17.7879 14.7521 18.0682C14.7521 18.2538 14.7048 18.4242 14.6101 18.5795C14.5192 18.7348 14.3961 18.8598 14.2408 18.9545C14.0893 19.0455 13.9188 19.0909 13.7294 19.0909ZM18.0931 19.0909C17.8128 19.0909 17.5722 18.9905 17.3715 18.7898C17.1707 18.589 17.0703 18.3485 17.0703 18.0682C17.0703 17.7879 17.1707 17.5473 17.3715 17.3466C17.5722 17.1458 17.8128 17.0455 18.0931 17.0455C18.3734 17.0455 18.6139 17.1458 18.8146 17.3466C19.0154 17.5473 19.1158 17.7879 19.1158 18.0682C19.1158 18.2538 19.0684 18.4242 18.9737 18.5795C18.8828 18.7348 18.7597 18.8598 18.6044 18.9545C18.4529 19.0455 18.2825 19.0909 18.0931 19.0909ZM22.4567 19.0909C22.1764 19.0909 21.9359 18.9905 21.7351 18.7898C21.5343 18.589 21.434 18.3485 21.434 18.0682C21.434 17.7879 21.5343 17.5473 21.7351 17.3466C21.9359 17.1458 22.1764 17.0455 22.4567 17.0455C22.737 17.0455 22.9775 17.1458 23.1783 17.3466C23.379 17.5473 23.4794 17.7879 23.4794 18.0682C23.4794 18.2538 23.4321 18.4242 23.3374 18.5795C23.2465 18.7348 23.1234 18.8598 22.9681 18.9545C22.8165 19.0455 22.6461 19.0909 22.4567 19.0909Z" fill="#6B7280"/></svg>
)
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11.5 2.5l2 2L5 13H3v-2z"/><path d="M10 4l2 2"/></svg>
)
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"/></svg>
)
const IconCopy = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><rect x="0.5" y="0.5" width="33" height="33" rx="7.5" fill="#F3F4F6"/><rect x="0.5" y="0.5" width="33" height="33" rx="7.5" stroke="#E5E7EB"/><path d="M22.3333 15H16.3333C15.597 15 15 15.597 15 16.3333V22.3333C15 23.0697 15.597 23.6667 16.3333 23.6667H22.3333C23.0697 23.6667 23.6667 23.0697 23.6667 22.3333V16.3333C23.6667 15.597 23.0697 15 22.3333 15Z" stroke="#374151" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/><path d="M12.334 19.0002H11.6673C11.3137 19.0002 10.9746 18.8597 10.7245 18.6096C10.4745 18.3596 10.334 18.0205 10.334 17.6668V11.6668C10.334 11.3132 10.4745 10.9741 10.7245 10.724C10.9746 10.474 11.3137 10.3335 11.6673 10.3335H17.6673C18.0209 10.3335 18.3601 10.474 18.6101 10.724C18.8602 10.9741 19.0007 11.3132 19.0007 11.6668V12.3335" stroke="#374151" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/></svg>
)
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4"/></svg>
)
const IconFilter = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.666 5.083h10.667" />
    <path d="M5.334 8.75h5.333" />
    <path d="M7.334 12.417h1.333" />
  </svg>
)
const IconSamplePortfolioTip = () => (
  <svg className="portfolio-sample-banner-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 4L3 19h18L12 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M12 10v5M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
)
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4B5563" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.75v8"/><path d="M5.5 8.417L8 10.75l2.5-2.333"/><path d="M2.833 10.75v2.667a1.333 1.333 0 001.334 1.333h7.666a1.333 1.333 0 001.334-1.333V10.75"/></svg>
)
/** Outward diagonal arrows — expand / maximize */
const IconWindowMaximize = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M8.75 7.25L13.25 2.75M13.25 2.75H9.75M13.25 2.75V6.25"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.25 8.75L2.75 13.25M2.75 13.25H6.25M2.75 13.25V9.75"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
const IconWindowRestore = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5.5 3.5h7v7h-7z" />
    <path d="M3.5 5.5h7v7h-7z" />
  </svg>
)
const IconSpreadsheet = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M.52 0A.525.525 0 000 .525v13.347c0 .29.235.525.52.525h14.96a.525.525 0 00.52-.525V.525A.525.525 0 0015.48 0H.52zm.53 1.05h4.55v2.287H1.05V1.05zm5.6 0h8.3v2.287h-8.3V1.05zM1.05 4.387h4.55V6.675H1.05V4.387zm5.6 0h8.3V6.675h-8.3V4.387zM1.05 7.724h4.55v2.286H1.05V7.724zm5.6 0h8.3v2.286h-8.3V7.724zM1.05 11.062h4.55v2.286H1.05v-2.286zm5.6 0h8.3v2.286h-8.3v-2.286z" fill="#4B5563"/></svg>
)

/** Upcoming lease starts in Feed use the same horizon as the longest default “contract ending” info rule (6 mo). */
const FEED_CONTRACT_START_WINDOW_MO = 6

const ALERT_SEV_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }

function monthsUntilCalendarMonth(dateStr: string): number {
  const end = new Date(dateStr)
  const now = new Date()
  return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
}

function alertMetricsForProperty(p: Property): AlertPropertyMetrics {
  const ac = activeContract(p)
  const pending = (p.taxes?.items ?? []).filter(t => t.status === 'pending')
  let taxDaysLeft: number | null = null
  if (pending.length > 0) {
    const nearest = pending.reduce((a, b) => (a.dueDate < b.dueDate ? a : b))
    taxDaysLeft = Math.ceil((new Date(nearest.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }
  return {
    monthsLeft: ac?.endDate ? monthsUntilCalendarMonth(ac.endDate) : null,
    vacant: !ac,
    taxPending: pending.length > 0,
    taxDaysLeft,
  }
}

function formatLeaseStartFeedDesc(contract: Contract, monthsUntilStart: number): string {
  const d = new Date(`${contract.startDate}T12:00:00`)
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  if (monthsUntilStart <= 0) return `Lease starts ${dateStr}`
  return `Starts ${dateStr} · in ${monthsUntilStart} month${monthsUntilStart === 1 ? '' : 's'}`
}

function sortTodoFeedAlertMatches<T extends { property: Property; match: EvaluatedAlertMatch }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const d = ALERT_SEV_ORDER[a.match.severity] - ALERT_SEV_ORDER[b.match.severity]
    if (d !== 0) return d
    return a.property.name.localeCompare(b.property.name)
  })
}

const SAMPLE_PROPERTIES = [
  { name: 'Apto 101', status: 'Rented', type: 'Apartment', area: 72,  gpi: 14400, egi: 14400, opex: 2800, noi: 11600, netCF: 10200, capex: 0,     taxes: 1400, value: 185000, debt: 95000,  capRate: 6.27, yoy: 4.2, monthsLeft: 8,    taxStatus: 'Paid' },
  { name: 'Apto 108', status: 'Rented', type: 'Apartment', area: 58,  gpi: 9600,  egi: 9600,  opex: 1900, noi: 7700,  netCF: 6500,  capex: 4200,   taxes: 1200, value: 145000, debt: 72000,  capRate: 5.31, yoy: 3.8, monthsLeft: 3,    taxStatus: 'Paid' },
  { name: 'Apto 128', status: 'Rented', type: 'Apartment', area: 95,  gpi: 18000, egi: 18000, opex: 4200, noi: 13800, netCF: 11600, capex: 8500,   taxes: 2000, value: 240000, debt: 140000, capRate: 5.75, yoy: 5.1, monthsLeft: 14,   taxStatus: 'Paid' },
  { name: 'Apto 102', status: 'Vacant', type: 'Apartment', area: 65,  gpi: 0,     egi: 0,     opex: 3100, noi: -3100, netCF: -3100, capex: 12000,  taxes: 0,    value: 160000, debt: 85000,  capRate: null,  yoy: 2.9, monthsLeft: null,  taxStatus: 'Pending' },
  { name: 'Casa Norte', status: 'Rented', type: 'House',    area: 180, gpi: 28800, egi: 26400, opex: 5800, noi: 20600, netCF: 17200, capex: 0,      taxes: 2800, value: 420000, debt: 220000, capRate: 4.9,  yoy: 6.3, monthsLeft: 22,   taxStatus: 'Paid' },
]

function toReportProps(p: Property, year: number, dc: CurrencyCode, fx: FxRates) {
  const py = { ...p, year }
  const a = convertAnnual(calcAnnual(py), p.currency, dc, fx)

  // Value & debt — same as estValue / debt table columns
  const valEst = estimatedPropertyValueAtYear(py, year)
  const value = valEst.value != null ? convert(valEst.value, p.currency, dc, fx) : 0
  const mortgage = p.factSheet?.mortgage
  const debt = mortgage?.hasMortgage && mortgage.outstandingBalance != null
    ? convert(mortgage.outstandingBalance, p.currency, dc, fx)
    : 0

  // YoY — same as valueYoY column (model-only)
  const prevEst = estimatedPropertyValueAtYear({ ...py, year: year - 1 }, year - 1)
  const yoy = valEst.source === 'model' && valEst.value != null && prevEst.value != null && prevEst.value > 0
    ? ((valEst.value - prevEst.value) / prevEst.value) * 100
    : null

  // Cap rate — same as capRate column
  const capRate = value > 0 && Number.isFinite(a.noi) ? (a.noi / value) * 100 : null

  // GPI — same as GPI column (projectedGpiAnnual, i.e. full-potential basis)
  const gpi = convert(projectedGpiAnnual(py), p.currency, dc, fx)

  // Margin — same as margin column: Net CF / GPI
  const margin = gpi > 0 ? (a.netCf / gpi) * 100 : null

  // Vacancy mo rate — same as vacancyMoRate column: months with vacancy loss / 12
  const vacMonths = vacancyLossMonthCount(py)
  const vacRate = vacMonths === 0 ? 0 : Math.round((vacMonths / 12) * 1000) / 10

  // Occupancy status + months left — same as status / endDate columns
  const contract = activeContract(p)
  const status = contract ? 'Rented' : occupancyFilterBucket(p) === 'Occupied' ? 'Occupied' : 'Vacant'
  const monthsLeft = contract?.endDate ? (() => {
    const end = new Date(contract.endDate)
    const now = new Date()
    return (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth()
  })() : null

  // Tax status — same as taxStatus column
  const pendingTaxItems = (p.taxes?.items ?? [])
    .filter(t => t.status === 'pending')
    .map(t => ({
      amount: convert(t.amount, p.currency, dc, fx),
      dueDate: t.dueDate,
    }))

  return {
    name: p.name,
    owner: p.owner,
    country: p.country,
    type: p.factSheet?.propertyType ?? '',
    beds: p.bedrooms,
    area: p.area,
    status,
    monthsLeft,
    taxStatus: pendingTaxItems.length > 0 ? 'Pending' : 'Paid',
    pendingTaxItems,
    vacRate,
    gpi,
    egi: a.egi,
    opex: a.totalOpex,
    noi: a.noi,
    capex: a.totalCapex,
    taxes: a.taxes,
    netCF: a.netCf,
    value,
    debt,
    capRate,
    yoy,
    margin,
  }
}

function AIAnalysisToolContent({ allProperties, initialFilters, year, displayCurrency, fxRates, step, onStep, onBack, onMaximize, onPaywall }: {
  allProperties: Property[]
  initialFilters: Record<string, PortfolioFilterSelection>
  year: number
  displayCurrency: CurrencyCode
  fxRates: FxRates
  step: null | 'ai' | 'sample'
  onStep: (s: 'ai' | 'sample') => void
  onBack: () => void
  onMaximize: () => void
  onPaywall: () => boolean
}) {
  const [modalFilters, setModalFilters] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(initialFilters)) {
      if (v && v.length > 0) out[k] = v
    }
    return out
  })
  const [showList, setShowList] = useState(false)

  const filterDims = useMemo(() => {
    const owners = Array.from(new Set(allProperties.map(p => p.owner).filter(Boolean) as string[])).sort()
    const countries = Array.from(new Set(allProperties.map(p => p.country).filter(Boolean) as string[])).sort()
    const cities = Array.from(new Set(allProperties.map(p => p.city).filter(Boolean) as string[])).sort()
    const dims: { key: string; label: string; values: string[] }[] = []
    if (owners.length > 1) dims.push({ key: 'owner', label: 'Owner', values: owners })
    if (countries.length > 1) dims.push({ key: 'country', label: 'Country', values: countries })
    if (cities.length > 1) dims.push({ key: 'city', label: 'City', values: cities })
    dims.push({ key: 'status', label: 'Status', values: ['Rented', 'Vacant'] })
    return dims
  }, [allProperties])

  const reportProperties = useMemo(() => {
    let result = allProperties
    for (const [key, selection] of Object.entries(modalFilters)) {
      if (!selection || selection.length === 0) continue
      if (key === 'status') {
        result = result.filter(p => selection.some(v => {
          if (v === 'Rented') return activeContract(p) !== null
          if (v === 'Vacant') return activeContract(p) === null
          return false
        }))
      } else {
        result = result.filter(p => selection.some(v => (p as any)[key] === v))
      }
    }
    return result
  }, [allProperties, modalFilters])

  function toggleFilter(key: string, value: string) {
    setModalFilters(prev => {
      const cur = prev[key] ?? []
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
      if (next.length === 0) {
        const { [key]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: next }
    })
  }

  function choose(mode: 'ai' | 'sample') {
    onStep(mode)
    onMaximize()
  }

  if (!step) {
    const hasFilters = Object.keys(modalFilters).length > 0
    const count = reportProperties.length
    const total = allProperties.length

    return (
      <div style={{ padding: '20px 24px 24px' }}>
        {/* Scope card */}
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          marginBottom: 20,
          overflow: 'hidden',
        }}>
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--surface2)',
            borderBottom: filterDims.length > 0 ? '1px solid var(--border)' : undefined,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Properties in report
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => setModalFilters({})}
                  style={{
                    fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Clear filters
                </button>
              )}
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: count === 0 ? '#dc2626' : 'var(--text)',
                background: count === 0 ? '#fef2f2' : 'var(--surface)',
                border: '1px solid',
                borderColor: count === 0 ? '#fca5a5' : 'var(--border)',
                borderRadius: 20, padding: '1px 10px',
              }}>
                {count} / {total}
              </span>
            </div>
          </div>

          {/* Filter rows */}
          {filterDims.length > 0 && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filterDims.map(dim => (
                <div key={dim.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    fontSize: 11, color: 'var(--text3)', fontWeight: 600,
                    whiteSpace: 'nowrap', paddingTop: 4, minWidth: 50, textAlign: 'right',
                  }}>
                    {dim.label}
                  </span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {dim.values.map(val => {
                      const active = modalFilters[dim.key]?.includes(val) ?? false
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => toggleFilter(dim.key, val)}
                          style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '3px 11px', borderRadius: 20, border: '1px solid',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            fontFamily: 'inherit', transition: 'all 0.12s',
                            background: active ? 'var(--accent-bg)' : 'var(--surface)',
                            color: active ? 'var(--accent-text)' : 'var(--text2)',
                            borderColor: active ? 'var(--accent-bg)' : 'var(--border)',
                          }}
                        >
                          {val}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Property list */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
            {count === 0 ? (
              <span style={{ fontSize: 13, color: '#dc2626' }}>No properties match these filters.</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowList(v => !v)}
                  style={{
                    fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: showList ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {showList ? 'Hide' : 'Show'} {count} {count === 1 ? 'property' : 'properties'}
                </button>
                {showList && (
                  <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {reportProperties.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 0',
                          borderBottom: i < reportProperties.length - 1 ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        {p.owner && (
                          <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{p.owner}</span>
                        )}
                        {p.country && (
                          <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{p.country}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => choose('ai')}
            disabled={count === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 20px', borderRadius: 10,
              border: '1.5px solid',
              borderColor: count === 0 ? 'var(--border)' : 'var(--accent-bg)',
              background: count === 0 ? 'var(--surface2)' : 'var(--accent-subtle-bg)',
              color: count === 0 ? 'var(--text3)' : 'var(--accent-bg)',
              fontSize: 14, fontWeight: 600,
              fontFamily: 'inherit',
              cursor: count === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              opacity: count === 0 ? 0.7 : 1,
            }}
          >
            <img src="/claude-color.svg" alt="" style={{ width: 16, height: 16, opacity: count === 0 ? 0.4 : 1 }} />
            AI Analysis
          </button>
          <button
            type="button"
            onClick={() => choose('sample')}
            className="filter-bar-btn"
            style={{ padding: '9px 20px', fontSize: 14, fontWeight: 600, borderRadius: 10 }}
          >
            Preview Sample
          </button>
        </div>
      </div>
    )
  }

  const propsToUse = step === 'sample'
    ? SAMPLE_PROPERTIES
    : reportProperties.map(p => toReportProps(p, year, displayCurrency, fxRates))
  return <PortfolioReport properties={propsToUse} year={year} displayCurrency={displayCurrency} onBack={onBack} onPaywall={onPaywall} />
}

const PORTFOLIO_TOOL_ICONS = ['/tool-icons/tool02.svg', '/tool-icons/tool01.svg', '/tool-icons/tool03.svg'] as const
const PORTFOLIO_TOOL_LABELS = ['AI Analysis', 'Vacancy Calculator', 'Field Notes'] as const
/** Properties table layout toggle — masked SVGs from `public/` */
const FILTER_BAR_LIST_VIEW_ICON = '/List-view.svg' as const
const FILTER_BAR_GRID_VIEW_ICON = '/Grid-view.svg' as const
const FILTER_BAR_TODO_VIEW_ICON = '/Todo-view.svg' as const

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const updatePos = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.right })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, updatePos])

  return (
    <>
      <button
        ref={btnRef}
        className="ghost"
        style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent' }}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        title="Options"
      >
        <IconDots />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)',
          background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 9999, minWidth: 140,
        }}>
          <button
            className="ghost"
            style={{ width: '100%', textAlign: 'left', borderRadius: '10px 10px 0 0', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={(e) => { e.stopPropagation(); onEdit(); setOpen(false) }}
          >
            <IconEdit /> Edit
          </button>
          <button
            className="ghost"
            style={{ width: '100%', textAlign: 'left', borderRadius: '0 0 10px 10px', padding: '9px 14px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={(e) => { e.stopPropagation(); onDelete(); setOpen(false) }}
          >
            <IconTrash /> Delete
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

function IconBuildingPlaceholder() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21h18M6 21V10l6-3.5L18 10v11M9 21v-6h6v6M10 13h4" />
    </svg>
  )
}

type GridCardLeaseStrip =
  | { kind: 'current'; pct: number; monthsLeftLabel: string; hasNegotiatedFollowOn: boolean }
  | { kind: 'upcoming'; startDate: string }

/** Months-left copy for grid card: avoids “Expired” when end is later in the same calendar month. */
function gridCardMonthsLeftLabel(end: Date, now: Date): string {
  const endT = end.getTime()
  const nowT = now.getTime()
  if (endT < nowT) return 'Expired'
  let months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth()
  if (end.getDate() < now.getDate()) months -= 1
  if (months <= 0) return '1 month left'
  return months === 1 ? '1 month left' : `${months} months left`
}

/** Lease strip for grid card: in-effect term, or future-dated active lease (“upcoming”). */
function gridCardContractProgress(p: Property): GridCardLeaseStrip | null {
  const now = new Date()
  const ac = contractCoveringDate(p.contracts, now)
  if (ac) {
    const followOn = negotiatedFollowOnAfterContract(p.contracts, ac)
    const start = new Date(`${ac.startDate}T12:00:00`)
    const end = new Date(`${ac.endDate}T12:00:00`)
    const totalMs = end.getTime() - start.getTime()
    if (totalMs <= 0) {
      return {
        kind: 'current',
        pct: 1,
        monthsLeftLabel: gridCardMonthsLeftLabel(end, now),
        hasNegotiatedFollowOn: followOn != null,
      }
    }
    let pct = (now.getTime() - start.getTime()) / totalMs
    pct = Math.max(0, Math.min(1, pct))
    return {
      kind: 'current',
      pct,
      monthsLeftLabel: gridCardMonthsLeftLabel(end, now),
      hasNegotiatedFollowOn: followOn != null,
    }
  }
  const next = nextNegotiatedLeaseNotYetStarted(p.contracts, now)
  if (next) return { kind: 'upcoming', startDate: next.startDate }
  return null
}

function gridCardLeasePrimaryLabel(leaseProgress: GridCardLeaseStrip | null): string {
  if (!leaseProgress) return 'No active contract'
  if (leaseProgress.kind === 'upcoming') {
    return `Upcoming contract · starts ${formatOwnedSinceCell(leaseProgress.startDate)}`
  }
  const prefix = leaseProgress.hasNegotiatedFollowOn ? 'Upcoming contract' : 'No contract negotiated'
  return `${prefix} · ${leaseProgress.monthsLeftLabel}`
}

const IconDeltaDown = () => (
  <svg width="4" height="3" viewBox="0 0 7 5" fill="currentColor" aria-hidden>
    <path d="M3.5 5L0 0h7L3.5 5z" />
  </svg>
)
const IconDeltaUp = () => (
  <svg width="4" height="3" viewBox="0 0 7 5" fill="currentColor" aria-hidden>
    <path d="M3.5 0L7 5H0L3.5 0z" />
  </svg>
)

const KpiDeltaPlaceholder = () => (
  <div className="kpi-delta-pill" style={{ background: '#f3f4f6', color: '#c0c5cc' }}>
    <span>—</span>
  </div>
)

function KpiPctOfEgiDelta({ pct, kind, base = 'EGI' }: { pct: number | null; kind: 'base100' | 'pct-up' | 'opex' | 'noi' | 'taxes' | 'net'; base?: string }) {
  if (kind === 'base100') {
    if (pct === null || !Number.isFinite(pct) || pct <= 0) return <KpiDeltaPlaceholder />
    return (
      <div className="kpi-delta-pill kpi-delta-pill--up" title={`Total ${base} ÷ total ${base} = 100% (baseline)`}>
        <IconDeltaUp />
        <span>100%</span>
      </div>
    )
  }

  if (pct === null || !Number.isFinite(pct)) return <KpiDeltaPlaceholder />

  if (kind === 'pct-up') {
    const shown = Math.abs(pct) < 0.05 ? '0' : pct.toFixed(1)
    return (
      <div className="kpi-delta-pill kpi-delta-pill--up" title={`EGI as % of total ${base}`}>
        <IconDeltaUp />
        <span>{shown}%</span>
      </div>
    )
  }

  if (kind === 'net') {
    const nearZero = Math.abs(pct) < 0.05
    const shown = nearZero ? '0' : Math.abs(pct).toFixed(1)
    const positive = pct > 0 || nearZero
    return positive ? (
      <div className="kpi-delta-pill kpi-delta-pill--up" title={`Net cashflow as % of total ${base}`}>
        <IconDeltaUp />
        <span>{shown}%</span>
      </div>
    ) : (
      <div className="kpi-delta-pill kpi-delta-pill--down" title={`Net cashflow as % of total ${base}`}>
        <IconDeltaDown />
        <span>−{shown}%</span>
      </div>
    )
  }

  const shown = Math.abs(pct) < 0.05 ? '0' : pct.toFixed(1)

  if (kind === 'noi') {
    return (
      <div className="kpi-delta-pill kpi-delta-pill--up" title={`NOI as % of total ${base}`}>
        <IconDeltaUp />
        <span>{shown}%</span>
      </div>
    )
  }

  const expenseTitle = kind === 'opex' ? `OPEX (−) as % of total ${base}` : `Taxes (−) as % of total ${base}`
  return (
    <div className="kpi-delta-pill kpi-delta-pill--down" title={expenseTitle}>
      <IconDeltaDown />
      <span>−{shown}%</span>
    </div>
  )
}

function formatOwnedSinceCell(iso: string | undefined | null): string {
  if (!iso?.trim()) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function propertyValueYoYPct(p: Property, year: number): number | null {
  const now = estimatedPropertyValueAtYear(p, year)
  if (now.source !== 'model') return null
  const prev = estimatedPropertyValueAtYear(p, year - 1)
  if (prev.value == null || now.value == null || prev.value <= 0) return null
  return ((now.value - prev.value) / prev.value) * 100
}

/** NOI ÷ estimated value for the year, in display currency; matches property overview cap rate. */
function propertyCapRatePct(
  p: Property,
  year: number,
  dc: CurrencyCode,
  fx: FxRates,
  annualInDc: ReturnType<typeof convertAnnual>,
): number | null {
  const e = estimatedPropertyValueAtYear({ ...p, year }, year)
  if (e.value == null || e.value <= 0) return null
  if (!Number.isFinite(annualInDc.noi)) return null
  const valueDc = convert(e.value, p.currency, dc, fx)
  if (!(valueDc > 0)) return null
  return (annualInDc.noi / valueDc) * 100
}

/** Full calendar years (and fraction) from now until mortgage end; 0 if matured. */
function mortgageYearsRemaining(endDateStr: string | undefined | null): number | null {
  if (!endDateStr?.trim()) return null
  const end = new Date(endDateStr)
  if (Number.isNaN(end.getTime())) return null
  const years = (end.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000)
  if (years <= 0) return 0
  return Math.round(years * 10) / 10
}

function KpiAvgAssetYoYPill({ pct }: { pct: number | null }) {
  if (pct === null || !Number.isFinite(pct)) return <KpiDeltaPlaceholder />
  const nearZero = Math.abs(pct) < 0.05
  const shown = nearZero ? '0' : Math.abs(pct).toFixed(1)
  const positive = pct > 0 || nearZero
  const title = 'Average year-over-year % change (modeled values only)'
  return positive ? (
    <div className="kpi-delta-pill kpi-delta-pill--up" title={title}>
      <IconDeltaUp />
      <span>{shown}%</span>
    </div>
  ) : (
    <div className="kpi-delta-pill kpi-delta-pill--down" title={title}>
      <IconDeltaDown />
      <span>−{shown}%</span>
    </div>
  )
}

const KPI_KEYS = ['gpi', 'egi', 'opex', 'noi', 'capex', 'taxes', 'net', 'assetValue', 'assetYoY', 'irrAnnualized', 'capRate', 'equityMultiplier'] as const
type KpiKey = typeof KPI_KEYS[number]
const KPI_META: Record<KpiKey, { label: string; cls?: string; negPrefix?: boolean; tip: string }> = {
  gpi: { label: 'GPI', tip: 'Gross Potential Income — full-year basis: contract rent when leased; otherwise Fact Sheet potential or, if unset, the highest monthly rent among leases overlapping the year (gaps between leases). Vacancy is potential minus actual collected rent.' },
  egi: { label: 'EGI', cls: 'green', tip: 'Effective Gross Income — actual rent collected' },
  opex: { label: 'OPEX', cls: 'red', negPrefix: true, tip: 'Operating expenses — admin, maintenance, insurance, etc.' },
  noi: { label: 'NOI', cls: 'purple', tip: 'Net Operating Income — income minus operating expenses' },
  capex: { label: 'CAPEX', cls: 'red', negPrefix: true, tip: 'Capital Expenditures — major repairs & improvements' },
  taxes: { label: 'Taxes', cls: 'red', negPrefix: true, tip: 'Annual property and income taxes' },
  net: { label: 'Net CF', cls: 'green', tip: 'Final cashflow after all income and expenses' },
  assetValue: { label: 'Asset Value', cls: 'purple', tip: 'Sum of estimated values for the selected year (purchase + appreciation and price history, or manual appraisal), in display currency' },
  assetYoY: { label: 'Value YoY', tip: 'Average year-over-year % change across properties with a modeled value history; appraisal-only holdings are excluded' },
  irrAnnualized: { label: 'IRR (ann.)', tip: 'Internal Rate of Return annualized — equity-weighted average across properties with purchase data. Uses constant annual cashflow assumption based on selected year.' },
  capRate: { label: 'Cap Rate', tip: 'Capitalization Rate — NOI divided by total estimated asset value. Measures yield on the asset base independent of financing.' },
  equityMultiplier: { label: 'Equity Mult.', tip: 'Total asset value divided by total equity (value − debt). Higher values indicate more leverage.' },
}

const COL_KEYS = [
  'owner', 'country', 'status', 'nonLeaseOcc', 'endDate', 'taxStatus',
  'propertyType', 'bedrooms', 'area', 'bathrooms', 'parking', 'floor', 'estrato', 'yearBuilt', 'lastRenovation',
  'estValue', 'valueYoY', 'ownedSince', 'debt', 'mtgYearsLeft',
  'gpi', 'egi', 'egiPerM2', 'vacancyMoRate', 'opex', 'noi', 'noiPerM2', 'valuePerM2', 'capRate', 'capex', 'yieldOnCapex', 'payback', 'taxes', 'netCf', 'margin',
] as const
type ColKey = typeof COL_KEYS[number]
const COL_LABELS: Record<ColKey, string> = {
  owner: 'Owner', country: 'Country', status: 'Status', nonLeaseOcc: 'Occupancy', endDate: 'Months Left', taxStatus: 'Tax Status',
  propertyType: 'Type', bedrooms: 'Beds', area: 'Area', bathrooms: 'Baths', parking: 'Parking',
  floor: 'Floor', estrato: 'Estrato', yearBuilt: 'Year Built', lastRenovation: 'Renovation',
  estValue: 'Est. value', valueYoY: 'Value YoY', ownedSince: 'Owned since', debt: 'Debt', mtgYearsLeft: 'Mortgage (yrs)',
  gpi: 'GPI', egi: 'EGI', egiPerM2: '$/m²', vacancyMoRate: 'Vac. mo rate', opex: 'OPEX', noi: 'NOI',
  noiPerM2: 'NOI/m²', valuePerM2: 'Value/m²',
  capRate: 'Cap rate', capex: 'CAPEX', yieldOnCapex: 'Yield on CAPEX', payback: 'Payback (yrs)', taxes: 'Taxes', netCf: 'Net CF', margin: 'Margin',
}
const DETAIL_COLS: ColKey[] = ['propertyType', 'bedrooms', 'area', 'bathrooms', 'parking', 'floor', 'estrato', 'yearBuilt', 'lastRenovation']
const BUILT_IN_PRESETS: { id: string; label: string; cols: ColKey[] }[] = [
  {
    id: 'financial',
    label: 'Financial',
    cols: ['owner', 'country', 'gpi', 'egi', 'vacancyMoRate', 'opex', 'noi', 'capRate', 'capex', 'netCf'],
  },
  { id: 'details', label: 'Details', cols: ['owner', 'country', 'status', 'nonLeaseOcc', 'endDate', 'taxStatus', ...DETAIL_COLS] },
  { id: 'all', label: 'All', cols: [...COL_KEYS] },
]
const CUSTOM_SLOT_COUNT = 3
type CustomPreset = { name: string; cols: ColKey[] }
const CUSTOM_PRESETS_KEY = 'col-custom-presets'
function loadCustomPresets(): (CustomPreset | null)[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY)
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length === 3) return arr }
  } catch {}
  return [null, null, null]
}
function saveCustomPresets(p: (CustomPreset | null)[]) {
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(p))
}

const COL_ACTIVE_PRESET_KEY = 'col-active-preset'

function loadColActivePreset(slots: (CustomPreset | null)[]): string | number | null {
  try {
    const raw = localStorage.getItem(COL_ACTIVE_PRESET_KEY)
    if (raw == null || raw === '') return BUILT_IN_PRESETS[0].id
    const v = JSON.parse(raw) as unknown
    if (v === null) return null
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < CUSTOM_SLOT_COUNT) {
      return slots[v] != null ? v : BUILT_IN_PRESETS[0].id
    }
    if (typeof v === 'string' && BUILT_IN_PRESETS.some(bp => bp.id === v)) return v
  } catch {}
  return BUILT_IN_PRESETS[0].id
}

/** When active preset was cleared (null) but columns still match a built-in, show that tab selected. */
function inferBuiltInPresetFromColVis(vis: Record<ColKey, boolean>): string | null {
  for (const bp of BUILT_IN_PRESETS) {
    const on = new Set(bp.cols)
    const ok = COL_KEYS.every(k => vis[k] === on.has(k))
    if (ok) return bp.id
  }
  return null
}

function loadInitialActivePreset(slots: (CustomPreset | null)[], vis: Record<ColKey, boolean>): string | number | null {
  const loaded = loadColActivePreset(slots)
  if (loaded !== null) return loaded
  return inferBuiltInPresetFromColVis(vis)
}

function saveColActivePreset(preset: string | number | null) {
  localStorage.setItem(COL_ACTIVE_PRESET_KEY, JSON.stringify(preset))
}

const COL_ORDER_KEY = 'col-order'
function loadColOrder(): ColKey[] {
  try {
    const raw = localStorage.getItem(COL_ORDER_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as ColKey[]
      const known = new Set<string>(COL_KEYS)
      const valid = arr.filter((k): k is ColKey => known.has(k))
      const missing = ([...COL_KEYS] as ColKey[]).filter(k => !valid.includes(k))
      return [...valid, ...missing]
    }
  } catch {}
  return [...COL_KEYS]
}
const COL_STORAGE_KEY = 'col-visibility'
function loadColVisibility(): Record<ColKey, boolean> {
  const financialCols = new Set<ColKey>(BUILT_IN_PRESETS[0].cols)
  const defaults = Object.fromEntries(COL_KEYS.map(k => [k, financialCols.has(k)])) as Record<ColKey, boolean>
  try {
    const raw = localStorage.getItem(COL_STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {}
  return defaults
}

const CARD_METRIC_VIS_KEY = 'portfolio-card-metric-visibility'
const CARD_METRIC_ORDER_KEY = 'portfolio-card-metric-order'
const CARD_METRIC_MAX_ON = 5

function defaultCardMetricVisibility(): Record<ColKey, boolean> {
  return Object.fromEntries(
    COL_KEYS.map(k => [k, k === 'area' || k === 'egi' || k === 'noi']),
  ) as Record<ColKey, boolean>
}

function loadCardMetricVisibility(): Record<ColKey, boolean> {
  const defaults = defaultCardMetricVisibility()
  try {
    const raw = localStorage.getItem(CARD_METRIC_VIS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next = { ...defaults }
    for (const k of COL_KEYS) {
      if (typeof parsed[k] === 'boolean') next[k] = parsed[k]
    }
    const order = loadCardMetricOrder()
    const visibleInOrder = order.filter(k => next[k])
    if (visibleInOrder.length > CARD_METRIC_MAX_ON) {
      for (let i = CARD_METRIC_MAX_ON; i < visibleInOrder.length; i++) {
        next[visibleInOrder[i]] = false
      }
      localStorage.setItem(CARD_METRIC_VIS_KEY, JSON.stringify(next))
    }
    return next
  } catch {
    return defaults
  }
}

function loadCardMetricOrder(): ColKey[] {
  try {
    const raw = localStorage.getItem(CARD_METRIC_ORDER_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as ColKey[]
      const known = new Set<string>(COL_KEYS)
      const valid = arr.filter((k): k is ColKey => known.has(k))
      const missing = ([...COL_KEYS] as ColKey[]).filter(k => !valid.includes(k))
      return [...valid, ...missing]
    }
  } catch {}
  return [...COL_KEYS]
}

/** Display string + optional tone for grid card metrics (aligned with wf-table cells). */
type CardMetricFmt = { text: string; tone?: 'pos' | 'neg' | 'purple' }

function formatCardMetricValue(
  key: ColKey,
  p: Property,
  ctx: {
    year: number
    displayCurrency: CurrencyCode
    fxRates: FxRates
    fm: (n: number | null | undefined) => string
  },
): CardMetricFmt {
  const { year, displayCurrency: dc, fxRates: fx, fm } = ctx
  const py = { ...p, year }
  const a = convertAnnual(calcAnnual(py), p.currency, dc, fx)
  const gpiRow = convert(projectedGpiAnnual(py), p.currency, dc, fx)
  const ac = activeContract(p)
  const countryCode = COUNTRIES.find(c => c.name === p.country)?.code
  const dash: CardMetricFmt = { text: '—' }

  switch (key) {
    case 'owner':
      return { text: p.owner?.trim() ? p.owner : '—' }
    case 'country':
      return { text: p.country ? (countryCode || p.country) : '—' }
    case 'status':
      return { text: ac ? 'Rented' : 'Vacant' }
    case 'nonLeaseOcc':
      return { text: nonLeaseOccupancyLabel(p) }
    case 'endDate': {
      if (!ac) return dash
      const end = new Date(ac.endDate), now = new Date()
      const months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth()
      const text = months <= 0 ? 'Expired' : `${months}m`
      return months <= 3 ? { text, tone: 'neg' } : { text }
    }
    case 'taxStatus': {
      const items = p.taxes?.items ?? [], pending = items.filter(t => t.status === 'pending')
      if (items.length === 0) return dash
      if (pending.length === 0) return { text: 'Paid' }
      const nearest = pending.reduce((x, b) => x.dueDate < b.dueDate ? x : b)
      const daysLeft = Math.ceil((new Date(nearest.dueDate).getTime() - Date.now()) / 864e5)
      return { text: `Due ${daysLeft <= 0 ? 'overdue' : `${daysLeft}d`}` }
    }
    case 'propertyType':
      return { text: p.factSheet?.propertyType || '—' }
    case 'bedrooms':
      return { text: p.bedrooms != null ? String(p.bedrooms) : '—' }
    case 'area':
      return { text: p.area ? `${p.area} m²` : '—' }
    case 'bathrooms':
      return { text: p.bathrooms != null ? String(p.bathrooms) : '—' }
    case 'parking':
      return { text: p.parking != null ? String(p.parking) : '—' }
    case 'floor':
      return { text: p.factSheet?.floor != null ? String(p.factSheet.floor) : '—' }
    case 'estrato':
      return { text: p.factSheet?.estrato != null ? String(p.factSheet.estrato) : '—' }
    case 'yearBuilt':
      return { text: p.factSheet?.yearBuilt != null ? String(p.factSheet.yearBuilt) : '—' }
    case 'lastRenovation':
      return { text: p.factSheet?.lastRenovation != null ? String(p.factSheet.lastRenovation) : '—' }
    case 'estValue': {
      const e = estimatedPropertyValueAtYear(py, year)
      const conv = e.value != null ? convert(e.value, p.currency, dc, fx) : null
      if (conv == null) return dash
      return { text: fm(conv), tone: 'purple' }
    }
    case 'valueYoY': {
      const y = propertyValueYoYPct(py, year)
      if (y == null || !Number.isFinite(y)) return dash
      const near = Math.abs(y) < 0.05
      const shown = near ? '0' : Math.abs(y).toFixed(1)
      const positive = y > 0 || near
      return { text: `${positive ? '+' : '−'}${shown}%`, tone: positive ? 'pos' : 'neg' }
    }
    case 'ownedSince':
      return { text: formatOwnedSinceCell(p.factSheet?.purchaseDate) }
    case 'debt': {
      const m = p.factSheet?.mortgage
      if (!m?.hasMortgage || m.outstandingBalance == null) return dash
      const conv = convert(m.outstandingBalance, p.currency, dc, fx)
      return { text: `−${fm(conv)}`, tone: 'neg' }
    }
    case 'mtgYearsLeft': {
      const y = mortgageYearsRemaining(p.factSheet?.mortgage?.endDate)
      if (y == null) return dash
      return { text: y === 0 ? '0' : String(y) }
    }
    case 'gpi':
      return { text: fm(gpiRow) }
    case 'egi':
      return { text: fm(a.egi), tone: 'pos' }
    case 'egiPerM2': {
      const ar = p.area
      if (ar == null || ar <= 0) return dash
      return { text: fm(a.egi / ar), tone: 'pos' }
    }
    case 'vacancyMoRate': {
      const m = vacancyLossMonthCount(py)
      const pct = (m / 12) * 100
      return { text: `${pct.toFixed(1)}%` }
    }
    case 'opex':
      return { text: `−${fm(a.totalOpex)}`, tone: 'neg' }
    case 'noi':
      return { text: fm(a.noi), tone: a.noi >= 0 ? 'pos' : 'neg' }
    case 'noiPerM2': {
      const ar = p.area
      if (ar == null || ar <= 0 || !Number.isFinite(a.noi)) return dash
      const v = a.noi / ar
      return { text: fm(v), tone: v >= 0 ? 'pos' : 'neg' }
    }
    case 'valuePerM2': {
      const ar = p.area
      if (ar == null || ar <= 0) return dash
      const e = estimatedPropertyValueAtYear(py, year)
      if (e.value == null || e.value <= 0) return dash
      const v = convert(e.value, p.currency, dc, fx) / ar
      return { text: fm(v), tone: 'purple' }
    }
    case 'capRate': {
      const cap = propertyCapRatePct(py, year, dc, fx, a)
      if (cap == null || !Number.isFinite(cap)) return dash
      return { text: `${cap.toFixed(2)}%`, tone: cap < 0 ? 'neg' : 'purple' }
    }
    case 'capex':
      return a.totalCapex ? { text: `−${fm(a.totalCapex)}`, tone: 'neg' } : dash
    case 'yieldOnCapex': {
      if (!a.totalCapex || !Number.isFinite(a.noi)) return dash
      const pct = (a.noi / a.totalCapex) * 100
      return { text: `${pct.toFixed(1)}%`, tone: pct >= 0 ? 'purple' : 'neg' }
    }
    case 'payback': {
      if (!a.totalCapex || !Number.isFinite(a.noi) || a.noi <= 0) return dash
      return { text: (a.totalCapex / a.noi).toFixed(1) }
    }
    case 'taxes':
      return a.taxes ? { text: `−${fm(a.taxes)}`, tone: 'neg' } : dash
    case 'netCf':
      return { text: `${a.netCf >= 0 ? '+' : ''}${fm(a.netCf)}`, tone: a.netCf >= 0 ? 'pos' : 'neg' }
    case 'margin':
      return gpiRow ? { text: `${Math.round((a.netCf / gpiRow) * 100)}%` } : dash
    default:
      return dash
  }
}

function PaymentTodoCard({
  propertyName,
  rent,
  currency,
  rentInDisplay,
  displayCurrency,
  received,
  overdueCount,
  onToggle,
  onOpen,
}: {
  propertyName: string
  rent: number
  currency: CurrencyCode
  rentInDisplay: string | null
  displayCurrency: CurrencyCode
  received: boolean
  overdueCount?: number
  onToggle: (() => void) | undefined
  onOpen: () => void
}) {
  return (
    <div
      className="todo-feed-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
    >
      <div className="todo-feed-card-left">
        <div className="todo-feed-card-initial" aria-hidden>
          {propertyName.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="todo-feed-card-body">
        <div className="todo-feed-card-top">
          <span className="todo-feed-card-name">{propertyName}</span>
          {overdueCount != null && overdueCount > 0 && (
            <span className="todo-overdue-badge">{overdueCount} {overdueCount === 1 ? 'month' : 'months'} overdue</span>
          )}
        </div>
        <div className="todo-feed-card-amounts">
          <span className="todo-feed-card-amount-primary">
            <span className="todo-amount-code">{currency}</span>
            {fmtCurrencyM(rent, currency)}
          </span>
          {rentInDisplay !== null && (
            <span className="todo-feed-card-amount-secondary">
              <span className="todo-amount-code">{displayCurrency}</span>
              {rentInDisplay}
            </span>
          )}
        </div>
        {onToggle != null && (
          <button
            type="button"
            className="ghost"
            aria-label={received ? 'Mark as not received' : 'Mark rent as received'}
            title={received ? 'Received' : 'Mark received'}
            onClick={e => { e.stopPropagation(); onToggle() }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 7, padding: 0, lineHeight: 0,
              color: received ? 'var(--accent-bg)' : 'var(--text3)',
              fontSize: 12, fontWeight: 500,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="13" height="13" rx="2.5"
                fill={received ? 'var(--accent-bg)' : 'none'}
                stroke={received ? 'var(--accent-bg)' : 'currentColor'}
              />
              {received && <path d="M3.5 7.5l2.5 2.5L11 5" stroke="#fff" strokeWidth="1.8" />}
            </svg>
            Receive payment
          </button>
        )}
      </div>
    </div>
  )
}

const CAT_COLORS: Record<string, string> = {
  Improvement: '#3b82f6',
  Equipment:   '#8b5cf6',
  Repair:      '#f59e0b',
  Other:       '#6b7280',
}

function CapexTodoCard({
  item,
  onStatusChange,
  onOpen,
}: {
  item: CapexItem & { propertyName: string }
  onStatusChange: (next: CapexStatus) => void
  onOpen: () => void
}) {
  const status = item.status ?? 'To do'
  const catColor = CAT_COLORS[item.cat] ?? '#6b7280'

  const nextStatus: CapexStatus | null =
    status === 'To do'    ? 'Ongoing'   :
    status === 'Ongoing'  ? 'Completed' : null

  const prevStatus: CapexStatus | null =
    status === 'Completed' ? 'Ongoing' :
    status === 'Ongoing'   ? 'To do'   : null

  return (
    <div
      className="todo-feed-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
    >
      <div className="todo-feed-card-left">
        <div
          className="todo-feed-card-initial"
          style={{ background: catColor + '18', color: catColor }}
          aria-hidden
        >
          {item.cat.charAt(0)}
        </div>
      </div>
      <div className="todo-feed-card-body">
        <div className="todo-feed-card-top">
          <span className="todo-feed-card-name" style={{ flex: 1 }}>{item.desc}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
          {item.propertyName}
          <span style={{
            display: 'inline-block', marginLeft: 6,
            padding: '0 6px', borderRadius: 4,
            background: catColor + '18', color: catColor,
            fontWeight: 600, fontSize: 11,
          }}>{item.cat}</span>
        </div>
        <div className="todo-feed-card-amounts" style={{ marginTop: 4 }}>
          <span className="todo-feed-card-amount-primary" style={{ fontSize: 13 }}>
            {item.amount > 0 ? `−${item.amount.toLocaleString()}` : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {nextStatus && (
            <button
              type="button"
              className="ghost"
              onClick={e => { e.stopPropagation(); onStatusChange(nextStatus) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                fontSize: 12, fontWeight: 500, color: 'var(--text2)',
                cursor: 'pointer',
              }}
            >
              {nextStatus === 'Ongoing'   ? '▶ Start'  : '✓ Complete'}
            </button>
          )}
          {prevStatus && (
            <button
              type="button"
              className="ghost"
              onClick={e => { e.stopPropagation(); onStatusChange(prevStatus) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                fontSize: 12, fontWeight: 500, color: 'var(--text3)',
                cursor: 'pointer',
              }}
            >
              ↩ Undo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PortfolioPropertyGridCard({
  property: p,
  year,
  displayCurrency,
  fxRates,
  formatMoney: fm,
  activeCardMetrics,
  onOpen,
}: {
  property: Property
  year: number
  displayCurrency: CurrencyCode
  fxRates: FxRates
  formatMoney: (n: number | null | undefined) => string
  /** Up to five column keys in display order (first 3 = main strip, next 2 = detail rows). */
  activeCardMetrics: ColKey[]
  onOpen: (id: number) => void
}) {
  const rawPhoto = p.factSheet?.photos?.[0]?.trim()
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = Boolean(rawPhoto && !imgFailed)
  const leaseProgress = gridCardContractProgress(p)
  const badgeClass =
    leaseProgress?.kind === 'current' ? 'active-c' : leaseProgress?.kind === 'upcoming' ? 'upcoming-c' : 'vacant'
  const badgeLabel =
    leaseProgress?.kind === 'current' ? 'Rented' : leaseProgress?.kind === 'upcoming' ? 'Upcoming' : 'Vacant'
  const metricCtx = { year, displayCurrency, fxRates, fm }
  const mainKeys: (ColKey | undefined)[] = [0, 1, 2].map(i => activeCardMetrics[i])
  const detailKeys: (ColKey | undefined)[] = [3, 4].map(i => activeCardMetrics[i])
  const valueToneCls = (tone: CardMetricFmt['tone']) =>
    tone === 'pos'
      ? ' portfolio-prop-card-metric-value--pos'
      : tone === 'neg'
        ? ' portfolio-prop-card-metric-value--neg'
        : tone === 'purple'
          ? ' portfolio-prop-card-metric-value--purple'
          : ''

  return (
    <button type="button" className="portfolio-prop-card" onClick={() => onOpen(p.id)}>
      <div className="portfolio-prop-card-media">
        {showImg ? (
          <img
            src={rawPhoto}
            alt=""
            className="portfolio-prop-card-img"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="portfolio-prop-card-no-cover">
            <IconBuildingPlaceholder />
            <span className="portfolio-prop-card-no-cover-text">No cover</span>
          </div>
        )}
        <span className={`badge portfolio-prop-card-badge ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <div className="portfolio-prop-card-body">
        <h3 className="portfolio-prop-card-title">{p.name}</h3>
        <p className="portfolio-prop-card-address">{p.address?.trim() ? p.address : '—'}</p>
        <div
          className={`portfolio-prop-card-contract${leaseProgress ? '' : ' portfolio-prop-card-contract--placeholder'}`}
          aria-label={gridCardLeasePrimaryLabel(leaseProgress)}
        >
          <div className="portfolio-prop-card-contract-meta">
            <span className="portfolio-prop-card-contract-label">
              {gridCardLeasePrimaryLabel(leaseProgress)}
            </span>
            {leaseProgress?.kind === 'current' ? (
              <span className="portfolio-prop-card-contract-pct">{Math.round(leaseProgress.pct * 100)}%</span>
            ) : null}
          </div>
          <div
            className="portfolio-prop-card-contract-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={leaseProgress?.kind === 'current' ? Math.round(leaseProgress.pct * 100) : 0}
            aria-valuetext={
              leaseProgress?.kind === 'current'
                ? `${gridCardLeasePrimaryLabel(leaseProgress)}, ${Math.round(leaseProgress.pct * 100)}% complete`
                : leaseProgress
                  ? gridCardLeasePrimaryLabel(leaseProgress)
                  : 'No active contract'
            }
          >
            <div
              className={`portfolio-prop-card-contract-fill${
                leaseProgress?.kind === 'current' ? '' : ' portfolio-prop-card-contract-fill--inactive'
              }`}
              style={{
                width: leaseProgress?.kind === 'current' ? `${leaseProgress.pct * 100}%` : '0%',
              }}
            />
          </div>
        </div>
        <div className="portfolio-prop-card-divider" />
        <div className="portfolio-prop-card-metrics" role="group" aria-label="Key figures">
          {mainKeys.map((colKey, idx) => {
            const fmt = colKey ? formatCardMetricValue(colKey, p, metricCtx) : { text: '—' as const }
            const label = colKey ? COL_LABELS[colKey] : '—'
            return (
              <div key={`m-${idx}`} style={{ display: 'contents' }}>
                {idx > 0 ? <div className="portfolio-prop-card-metric-sep" aria-hidden /> : null}
                <div className="portfolio-prop-card-metric">
                  <span className="portfolio-prop-card-metric-label">{label}</span>
                  <span className={`portfolio-prop-card-metric-value${valueToneCls(fmt.tone)}`}>{fmt.text}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="portfolio-prop-card-extra">
          {detailKeys.map((colKey, idx) => {
            const fmt = colKey ? formatCardMetricValue(colKey, p, metricCtx) : { text: '—' as const }
            const label = colKey ? COL_LABELS[colKey] : '—'
            const isPlaceholder = !colKey
            return (
              <div key={`d-${idx}`} className="portfolio-prop-card-extra-row">
                <span className={`portfolio-prop-card-extra-label${isPlaceholder ? ' portfolio-prop-card-extra-value--ph' : ''}`}>{label}</span>
                <span className={`portfolio-prop-card-extra-value${isPlaceholder ? ' portfolio-prop-card-extra-value--ph' : ''}${!isPlaceholder && fmt.tone === 'pos' ? ' portfolio-prop-card-metric-value--pos' : ''}${!isPlaceholder && fmt.tone === 'neg' ? ' portfolio-prop-card-metric-value--neg' : ''}${!isPlaceholder && fmt.tone === 'purple' ? ' portfolio-prop-card-metric-value--purple' : ''}`}>
                  {fmt.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </button>
  )
}

const STORAGE_KEY = 'kpi-visibility'
const DEFAULT_KPI_ON = new Set<KpiKey>(['gpi', 'egi', 'opex', 'noi', 'capex', 'net'])
function defaultKpiVisibility(): Record<KpiKey, boolean> {
  return Object.fromEntries(KPI_KEYS.map(k => [k, DEFAULT_KPI_ON.has(k)])) as Record<KpiKey, boolean>
}
function loadKpiVisibility(): Record<KpiKey, boolean> {
  const defaults = defaultKpiVisibility()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {}
  return defaults
}

const KPI_ORDER_KEY = 'kpi-order'
const KPI_PCT_BASE_KEY = 'kpi-pct-base'
function loadKpiPctBase(): 'egi' | 'gpi' {
  const v = localStorage.getItem(KPI_PCT_BASE_KEY)
  return v === 'gpi' ? 'gpi' : 'egi'
}
function loadKpiOrder(): KpiKey[] {
  try {
    const raw = localStorage.getItem(KPI_ORDER_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as KpiKey[]
      const known = new Set<string>(KPI_KEYS)
      const valid = arr.filter((k): k is KpiKey => known.has(k))
      const missing = ([...KPI_KEYS] as KpiKey[]).filter(k => !valid.includes(k))
      return [...valid, ...missing]
    }
  } catch {}
  return [...KPI_KEYS]
}

const IconEye = ({ visible }: { visible: boolean }) => (
  visible ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1.5 9C1.5 9 3.75 3.75 9 3.75C14.25 3.75 16.5 9 16.5 9C16.5 9 14.25 14.25 9 14.25C3.75 14.25 1.5 9 1.5 9Z" stroke="var(--accent-bg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z" stroke="var(--accent-bg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7.58 7.58a2.003 2.003 0 002.84 2.84M13.36 13.36C12.12 14.27 10.62 14.78 9 14.75c-5.25 0-7.5-5.25-7.5-5.25a13.16 13.16 0 013.64-4.11m2.91-1.16A5.7 5.7 0 019 4c5.25 0 7.5 5.25 7.5 5.25a13.24 13.24 0 01-1.47 2.15M1.5 1.5l15 15" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
)

const TODO_PANEL_VIS_KEY = 'portfolio-todo-panel-vis'
const TODO_PANELS = [
  { key: 'feed',        label: 'Feed',                 mandatory: true  },
  { key: 'payments',    label: 'Payments',              mandatory: false },
  { key: 'overdue',     label: 'Overdue Payments',      mandatory: false },
  { key: 'maintenance', label: 'Maintenance \u0026 Works', mandatory: false },
] as const
type TodoPanelKey = typeof TODO_PANELS[number]['key']
function loadTodoPanelVis(): Record<TodoPanelKey, boolean> {
  const defaults: Record<TodoPanelKey, boolean> = { feed: true, payments: true, overdue: true, maintenance: true }
  try {
    const raw = localStorage.getItem(TODO_PANEL_VIS_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw), feed: true, overdue: JSON.parse(raw).overdue ?? true }
  } catch {}
  return defaults
}

const FILTER_STORAGE_KEY = 'portfolio-filters'
type PortfolioFilterSelection = string[] | null

function loadSavedFilters() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, unknown>
  } catch {}
  return {} as Record<string, unknown>
}

function migrateActiveFilters(raw: unknown): Record<string, PortfolioFilterSelection> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, PortfolioFilterSelection> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) out[k] = null
    else if (Array.isArray(v)) {
      const strings = v.filter((x): x is string => typeof x === 'string')
      out[k] = strings.length ? strings : []
    } else if (typeof v === 'string') {
      out[k] = [v]
    }
  }
  return out
}

function formatFilterPillSummary(values: string[]): string {
  if (values.length === 0) return ''
  if (values.length <= 2) return values.join(', ')
  return `${values[0]} +${values.length - 1} more`
}

function CurrencyPicker({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) { setSearch(''); inputRef.current?.focus() }
  }, [open])

  const filtered = CURRENCY_LIST.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    const cfg = CURRENCIES[c]
    return c.toLowerCase().includes(q) || cfg.label.toLowerCase().includes(q)
  })

  const recentCodes: CurrencyCode[] = ['USD', 'COP', 'PEN']
  const recent = recentCodes.filter(c => !search || filtered.includes(c))
  const rest = filtered.filter(c => !recentCodes.includes(c))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '5px 28px 5px 10px', fontSize: 13, fontWeight: 500,
          background: '#f7f9fc', border: '1px solid #e8ecf2', borderRadius: 10,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          position: 'relative', whiteSpace: 'nowrap',
        }}
      >
        <img src={flagUrl(value, 40)} alt="" width={20} height={14} style={{ borderRadius: 2, objectFit: 'cover' }} />
        <span>{value}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ position: 'absolute', right: 9, top: '50%', transform: `translateY(-50%)${open ? ' rotate(180deg)' : ''}`, transition: 'transform 0.15s ease' }}>
          <path d="M1 1l4 4 4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 6,
          background: '#fff', border: '1px solid #e8ecf2', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, width: 220,
          animation: 'selectSlideIn 0.15s ease-out', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 10px 6px' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', fontSize: 13,
                background: '#f7f9fc', border: '1px solid #e8ecf2', borderRadius: 8,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {recent.length > 0 && (
              <>
                <div style={{ padding: '6px 14px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recent
                </div>
                {recent.map(code => {
                  const cfg = CURRENCIES[code]
                  return (
                    <button
                      key={code}
                      type="button"
                      className="ghost"
                      onClick={() => { onChange(code); setOpen(false) }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 14px',
                        display: 'flex', alignItems: 'center', gap: 10, borderRadius: 0,
                        background: value === code ? '#f0f5ff' : undefined,
                      }}
                    >
                      <img src={flagUrl(code, 40)} alt="" width={22} height={16} style={{ borderRadius: 3, objectFit: 'cover' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', minWidth: 32 }}>{code}</span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{cfg.label}</span>
                    </button>
                  )
                })}
              </>
            )}
            {rest.length > 0 && (
              <>
                {recent.length > 0 && <div style={{ height: 1, background: '#e8ecf2', margin: '4px 0' }} />}
                {rest.map(code => {
                  const cfg = CURRENCIES[code]
                  return (
                    <button
                      key={code}
                      type="button"
                      className="ghost"
                      onClick={() => { onChange(code); setOpen(false) }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 14px',
                        display: 'flex', alignItems: 'center', gap: 10, borderRadius: 0,
                        background: value === code ? '#f0f5ff' : undefined,
                      }}
                    >
                      <img src={flagUrl(code, 40)} alt="" width={22} height={16} style={{ borderRadius: 3, objectFit: 'cover' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', minWidth: 32 }}>{code}</span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{cfg.label}</span>
                    </button>
                  )
                })}
              </>
            )}
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FxRateEditor({ rates, onSave, onClose }: { rates: FxRates; onSave: (r: FxRates) => void; onClose: () => void }) {
  const [draft, setDraft] = useState({ ...rates })
  const editableCurrencies = CURRENCY_LIST.filter(c => c !== 'USD')
  return (
    <div style={{
      position: 'absolute', right: 0, top: '100%', marginTop: 6,
      background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 280,
      padding: 16, animation: 'selectSlideIn 0.15s ease-out',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
        FX Rates (to USD)
      </div>
      {editableCurrencies.map(code => (
        <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, width: 60, display: 'inline-flex', alignItems: 'center', gap: 4 }}><img src={flagUrl(code)} alt="" width={16} height={12} style={{ borderRadius: 2, objectFit: 'cover' }} />{code}</span>
          <input
            type="text"
            value={draft[code]}
            onChange={(e) => setDraft(d => ({ ...d, [code]: parseFloat(e.target.value) || 0 }))}
            style={{ flex: 1, padding: '6px 10px', fontSize: 13, background: '#f7f9fc', border: '1px solid #e8ecf2', borderRadius: 8 }}
          />
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
        Updated: {draft.updatedAt}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onClose}>Cancel</button>
        <button className="primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString().slice(0, 10) })}>Save</button>
      </div>
    </div>
  )
}

function SharedWithMeSection() {
  const { user } = useAuth() as unknown as { user: any }
  const [shares, setShares] = useState<Share[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    return subscribeViewerShares(user.uid, setShares)
  }, [user])

  if (shares.length === 0) return null

  return (
    <div className="shared-with-me-section">
      <div className="sharing-section-label">SHARED WITH ME</div>
      <div className="shared-with-me-cards">
        {shares.map((s) => (
          <button
            key={s.id}
            className="shared-with-me-card"
            onClick={() => navigate(`/shared/${s.id}`)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span className="shared-with-me-name">{s.ownerPortfolioName}</span>
              <span className="shared-view-badge">view only</span>
            </div>
            <div className="shared-with-me-meta">
              {s.scope === 'portfolio'
                ? 'Full portfolio access'
                : s.scope === 'properties'
                  ? `${s.propertyIds.length} propert${s.propertyIds.length === 1 ? 'y' : 'ies'}`
                  : s.filters.length > 0
                    ? s.filters.map((f) => `${f.field} = ${f.values.join(', ')}`).join(' · ')
                    : 'Filtered view'}
            </div>
            <div style={{ color: '#3b82f6', fontSize: 12, fontWeight: 600, marginTop: 8 }}>Open →</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function PortfolioPage({ properties, onSelectProperty, onAddProperty }: Props) {
  const readOnly = useReadOnly()
  const _saved = useMemo(loadSavedFilters, [])
  const [selectedYear, setSelectedYear] = useState(() => (typeof _saved.selectedYear === 'number' ? _saved.selectedYear : new Date().getFullYear()))
  const yearWindow = getYearWindow(selectedYear)
  const withYear = (p: Property): Property => ({ ...p, year: selectedYear })
  const { setAddPropertyOpen: _setAddPropertyOpen, removeProperty, updateProperty } = useAppState()
  const openAddProperty = onAddProperty ?? (() => _setAddPropertyOpen(true))
  const { canUseAi } = useEntitlements()
  const [fxRates, setFxRates] = useState<FxRates>(loadFxRates)
  const [fxOpen, setFxOpen] = useState(false)
  const fxRef = useRef<HTMLDivElement>(null)
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>((_saved.displayCurrency as CurrencyCode) || 'USD')
  const fm = (n: number | null | undefined) => fmtCurrencyM(n, displayCurrency)
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null)
  const [copied, setCopied] = useState(false)
  const [kpiVis, setKpiVis] = useState(loadKpiVisibility)
  const [kpiOrder, setKpiOrder] = useState(loadKpiOrder)
  const [kpiPctBase, setKpiPctBase] = useState<'egi' | 'gpi'>(loadKpiPctBase)
  const [dragKpi, setDragKpi] = useState<KpiKey | null>(null)
  const [dragOverKpi, setDragOverKpi] = useState<KpiKey | null>(null)
  const [kpiMenuOpen, setKpiMenuOpen] = useState(false)
  const kpiMenuRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [showScrollBtns, setShowScrollBtns] = useState(false)
  const [searchQuery, setSearchQuery] = useState((typeof _saved.searchQuery === 'string' ? _saved.searchQuery : ''))
  const [activeFilters, setActiveFilters] = useState<Record<string, PortfolioFilterSelection>>(() =>
    migrateActiveFilters(_saved.activeFilters),
  )
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<string | null>(null)
  // null = closed, '__pick__' = picking column, column key = value picker open on that chip
  const filterBarRef = useRef<HTMLDivElement>(null)
  /** Index into PORTFOLIO_TOOL_ICONS — toolbar tool popup */
  const [openToolModal, setOpenToolModal] = useState<number | null>(null)
  const [toolModalMaximized, setToolModalMaximized] = useState(false)
  const [reportStep, setReportStep] = useState<null | 'ai' | 'sample'>(null)
  const [aiUpgradeOpen, setAiUpgradeOpen] = useState(false)
  const [colVis, setColVis] = useState(loadColVisibility)
  const [colOrder, setColOrder] = useState(loadColOrder)
  const [colMenuOpen, setColMenuOpen] = useState(false)
  /** List vs grid for properties section (icon reflects current mode) */
  const [propertiesLayoutView, setPropertiesLayoutView] = useState<'list' | 'grid' | 'todo'>(() => {
    const v = _saved.propertiesLayoutView
    return v === 'grid' || v === 'todo' ? v : 'list'
  })
  const [customPresets, setCustomPresets] = useState(loadCustomPresets)
  // activePreset: built-in id ('financial'|…) or custom slot index, or null if columns are a custom mix
  const [activePreset, setActivePreset] = useState<string | number | null>(() =>
    loadInitialActivePreset(loadCustomPresets(), loadColVisibility()),
  )
  const [renamingSlot, setRenamingSlot] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragCol, setDragCol] = useState<ColKey | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ColKey | null>(null)
  const [cardMetricVis, setCardMetricVis] = useState(loadCardMetricVisibility)
  const [cardMetricOrder, setCardMetricOrder] = useState(loadCardMetricOrder)
  const [dragCardMetric, setDragCardMetric] = useState<ColKey | null>(null)
  const [dragOverCardMetric, setDragOverCardMetric] = useState<ColKey | null>(null)
  const [cardMetricMax5Hint, setCardMetricMax5Hint] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const [todoPanelVis, setTodoPanelVis] = useState(loadTodoPanelVis)
  const [todoFeedAlertConfig, setTodoFeedAlertConfig] = useState(loadAlertRuleConfig)

  useEffect(() => {
    if (propertiesLayoutView === 'todo') setTodoFeedAlertConfig(loadAlertRuleConfig())
  }, [propertiesLayoutView])

  function handleToggleRentReceived(propertyId: number, calYear: number, calMonth: number, current: boolean) {
    updateProperty(propertyId, (p) => {
      const ym = p.months[calYear] ?? {}
      const existing = ym[calMonth] ?? { status: 'rented' as const, incomeOverride: null, expenses: {} }
      return {
        ...p,
        months: { ...p.months, [calYear]: { ...ym, [calMonth]: { ...existing, rentReceived: !current } } },
      }
    })
  }

  function handleCapexStatus(propertyId: number, capexId: number, next: CapexStatus) {
    updateProperty(propertyId, p => ({
      ...p,
      capex: p.capex.map(c => c.id === capexId ? { ...c, status: next } : c),
    }))
  }

  function toggleTodoPanel(key: TodoPanelKey) {
    setTodoPanelVis(prev => {
      const next = { ...prev, [key]: !prev[key], feed: true }
      localStorage.setItem(TODO_PANEL_VIS_KEY, JSON.stringify(next))
      return next
    })
  }

  const activeCardMetricKeys = useMemo(
    () => cardMetricOrder.filter(k => cardMetricVis[k]).slice(0, CARD_METRIC_MAX_ON),
    [cardMetricOrder, cardMetricVis],
  )

  // Sort state
  type SortKey = 'name' | ColKey
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<SortKey | null>((_saved.sortKey as SortKey) || null)
  const [sortDir, setSortDir] = useState<SortDir>((_saved.sortDir as SortDir) || 'asc')
  // Persist filter state to localStorage
  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      searchQuery, activeFilters, sortKey, sortDir, selectedYear, displayCurrency, propertiesLayoutView,
    }))
  }, [searchQuery, activeFilters, sortKey, sortDir, selectedYear, displayCurrency, propertiesLayoutView])

  useEffect(() => {
    saveColActivePreset(activePreset)
  }, [activePreset])

  const closeToolModal = useCallback(() => {
    setOpenToolModal(null)
    setToolModalMaximized(false)
  }, [])

  useEffect(() => {
    if (openToolModal == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeToolModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openToolModal, closeToolModal])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }
  const SortTh = ({ col, children, className, style }: { col: SortKey; children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <th className={`wf-sortable ${className ?? ''}`} style={{ cursor: 'pointer', userSelect: 'none', ...style }} onClick={() => handleSort(col)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <span className="wf-sort-arrows">
          <span className={`wf-arr-up${sortKey === col && sortDir === 'asc' ? ' active' : ''}`}>▲</span>
          <span className={`wf-arr-dn${sortKey === col && sortDir === 'desc' ? ' active' : ''}`}>▼</span>
        </span>
      </span>
    </th>
  )

  const FILTER_COLUMNS = useMemo(() => {
    const statusValues = ['Rented', 'Vacant']
    const owners = Array.from(new Set(properties.map(p => p.owner).filter(Boolean))).sort()
    const countries = Array.from(new Set(properties.map(p => p.country).filter(Boolean))).sort()
    const cities = Array.from(new Set(properties.map(p => p.city).filter(Boolean))).sort()
    const neighbourhoods = Array.from(new Set(properties.map(p => p.neighbourhood).filter(Boolean))).sort()
    const nonLeaseValues = ['Vacant', 'Leased', 'Occupied']
    const cols: { key: string; label: string; values: string[] }[] = [
      { key: 'status', label: 'Status', values: statusValues },
      { key: 'nonLeaseOcc', label: 'Occupancy', values: nonLeaseValues },
    ]
    if (owners.length > 1) cols.push({ key: 'owner', label: 'Owner', values: owners })
    if (countries.length > 1) cols.push({ key: 'country', label: 'Country', values: countries })
    if (cities.length > 1) cols.push({ key: 'city', label: 'City', values: cities })
    if (neighbourhoods.length > 1) cols.push({ key: 'neighbourhood', label: 'Neighbourhood', values: neighbourhoods })
    return cols
  }, [properties])

  const showSamplePortfolioTip = useMemo(() => isUnmodifiedDefaultSeedPortfolio(properties), [properties])

  const filteredProperties = useMemo(() => {
    let result = properties
    for (const [key, selection] of Object.entries(activeFilters)) {
      if (!selection || selection.length === 0) continue
      if (key === 'status') {
        result = result.filter(p =>
          selection.some(v => {
            if (v === 'Rented') return activeContract(p) !== null
            if (v === 'Vacant') return activeContract(p) === null
            return false
          }),
        )
      } else if (key === 'nonLeaseOcc') {
        result = result.filter(p =>
          selection.some(
            v => (v === 'Vacant' || v === 'Leased' || v === 'Occupied') && occupancyFilterBucket(p) === v,
          ),
        )
      } else {
        result = result.filter(p => selection.some(v => (p as any)[key] === v))
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.owner?.toLowerCase().includes(q) ||
        p.country?.toLowerCase().includes(q)
      )
    }
    return result
  }, [properties, activeFilters, searchQuery])

  const sortedProperties = useMemo(() => {
    if (!sortKey) return filteredProperties
    const sorted = [...filteredProperties]
    sorted.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      if (sortKey === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase() }
      else if (sortKey === 'owner') { va = (a.owner ?? '').toLowerCase(); vb = (b.owner ?? '').toLowerCase() }
      else if (sortKey === 'country') { va = (a.country ?? '').toLowerCase(); vb = (b.country ?? '').toLowerCase() }
      else if (sortKey === 'status') { va = activeContract(a) ? 1 : 0; vb = activeContract(b) ? 1 : 0 }
      else if (sortKey === 'nonLeaseOcc') {
        const occOrder = (p: Property) => {
          const b = occupancyFilterBucket(p)
          return b === 'Vacant' ? 0 : b === 'Leased' ? 1 : 2
        }
        va = occOrder(a)
        vb = occOrder(b)
        if (va === vb) { va = nonLeaseOccupancyLabel(a).toLowerCase(); vb = nonLeaseOccupancyLabel(b).toLowerCase() }
      }
      else if (sortKey === 'endDate') {
        const acA = activeContract(a), acB = activeContract(b)
        va = acA ? new Date(acA.endDate).getTime() : Infinity
        vb = acB ? new Date(acB.endDate).getTime() : Infinity
      }
      else if (sortKey === 'taxStatus') {
        const pendA = (a.taxes?.items ?? []).filter(t => t.status === 'pending')
        const pendB = (b.taxes?.items ?? []).filter(t => t.status === 'pending')
        va = pendA.length > 0 ? 0 : 1
        vb = pendB.length > 0 ? 0 : 1
      }
      else if (sortKey === 'propertyType') { va = (a.factSheet?.propertyType ?? '').toLowerCase(); vb = (b.factSheet?.propertyType ?? '').toLowerCase() }
      else if (sortKey === 'bedrooms') { va = a.bedrooms ?? 0; vb = b.bedrooms ?? 0 }
      else if (sortKey === 'area') { va = a.area ?? 0; vb = b.area ?? 0 }
      else if (sortKey === 'bathrooms') { va = a.bathrooms ?? 0; vb = b.bathrooms ?? 0 }
      else if (sortKey === 'parking') { va = a.parking ?? 0; vb = b.parking ?? 0 }
      else if (sortKey === 'floor') { va = a.factSheet?.floor ?? 0; vb = b.factSheet?.floor ?? 0 }
      else if (sortKey === 'estrato') { va = a.factSheet?.estrato ?? 0; vb = b.factSheet?.estrato ?? 0 }
      else if (sortKey === 'yearBuilt') { va = a.factSheet?.yearBuilt ?? 0; vb = b.factSheet?.yearBuilt ?? 0 }
      else if (sortKey === 'lastRenovation') { va = a.factSheet?.lastRenovation ?? 0; vb = b.factSheet?.lastRenovation ?? 0 }
      else if (sortKey === 'estValue') {
        const ea = estimatedPropertyValueAtYear(withYear(a), selectedYear)
        const eb = estimatedPropertyValueAtYear(withYear(b), selectedYear)
        va = ea.value != null ? convert(ea.value, a.currency, displayCurrency, fxRates) : -Infinity
        vb = eb.value != null ? convert(eb.value, b.currency, displayCurrency, fxRates) : -Infinity
      }
      else if (sortKey === 'valueYoY') {
        va = propertyValueYoYPct(withYear(a), selectedYear) ?? -Infinity
        vb = propertyValueYoYPct(withYear(b), selectedYear) ?? -Infinity
      }
      else if (sortKey === 'ownedSince') {
        const da = a.factSheet?.purchaseDate, db = b.factSheet?.purchaseDate
        va = da ? new Date(da).getTime() : -Infinity
        vb = db ? new Date(db).getTime() : -Infinity
      }
      else if (sortKey === 'debt') {
        const ma = a.factSheet?.mortgage, mb = b.factSheet?.mortgage
        va = ma?.hasMortgage && ma.outstandingBalance != null ? convert(ma.outstandingBalance, a.currency, displayCurrency, fxRates) : 0
        vb = mb?.hasMortgage && mb.outstandingBalance != null ? convert(mb.outstandingBalance, b.currency, displayCurrency, fxRates) : 0
      }
      else if (sortKey === 'mtgYearsLeft') {
        va = mortgageYearsRemaining(a.factSheet?.mortgage?.endDate) ?? -Infinity
        vb = mortgageYearsRemaining(b.factSheet?.mortgage?.endDate) ?? -Infinity
      }
      else {
        const aa = convertAnnual(calcAnnual(withYear(a)), a.currency, displayCurrency, fxRates)
        const ab = convertAnnual(calcAnnual(withYear(b)), b.currency, displayCurrency, fxRates)
        const gpiA = convert(projectedGpiAnnual(withYear(a)), a.currency, displayCurrency, fxRates)
        const gpiB = convert(projectedGpiAnnual(withYear(b)), b.currency, displayCurrency, fxRates)
        if (sortKey === 'gpi') { va = gpiA; vb = gpiB }
        else if (sortKey === 'egi') { va = aa.egi; vb = ab.egi }
        else if (sortKey === 'egiPerM2') {
          const arA = a.area ?? 0, arB = b.area ?? 0
          va = arA > 0 ? aa.egi / arA : -Infinity
          vb = arB > 0 ? ab.egi / arB : -Infinity
        }
        else if (sortKey === 'opex') { va = aa.totalOpex; vb = ab.totalOpex }
        else if (sortKey === 'noi') { va = aa.noi; vb = ab.noi }
        else if (sortKey === 'noiPerM2') {
          const arA = a.area ?? 0, arB = b.area ?? 0
          va = arA > 0 && Number.isFinite(aa.noi) ? aa.noi / arA : -Infinity
          vb = arB > 0 && Number.isFinite(ab.noi) ? ab.noi / arB : -Infinity
        }
        else if (sortKey === 'valuePerM2') {
          const ea = estimatedPropertyValueAtYear(withYear(a), selectedYear)
          const eb = estimatedPropertyValueAtYear(withYear(b), selectedYear)
          const arA = a.area ?? 0, arB = b.area ?? 0
          va = arA > 0 && ea.value != null && ea.value > 0 ? convert(ea.value, a.currency, displayCurrency, fxRates) / arA : -Infinity
          vb = arB > 0 && eb.value != null && eb.value > 0 ? convert(eb.value, b.currency, displayCurrency, fxRates) / arB : -Infinity
        }
        else if (sortKey === 'capRate') {
          va = propertyCapRatePct(withYear(a), selectedYear, displayCurrency, fxRates, aa) ?? -Infinity
          vb = propertyCapRatePct(withYear(b), selectedYear, displayCurrency, fxRates, ab) ?? -Infinity
        }
        else if (sortKey === 'capex') { va = aa.totalCapex ?? 0; vb = ab.totalCapex ?? 0 }
        else if (sortKey === 'taxes') { va = aa.taxes ?? 0; vb = ab.taxes ?? 0 }
        else if (sortKey === 'netCf') { va = aa.netCf; vb = ab.netCf }
        else if (sortKey === 'vacancyMoRate') {
          va = vacancyLossMonthCount(withYear(a)) / 12
          vb = vacancyLossMonthCount(withYear(b)) / 12
        }
        else if (sortKey === 'margin') { va = gpiA ? (aa.netCf / gpiA) : 0; vb = gpiB ? (ab.netCf / gpiB) : 0 }
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProperties, sortKey, sortDir, displayCurrency, fxRates, selectedYear])

  const todoFeedBuckets = useMemo(() => {
    const config = todoFeedAlertConfig
    const contractStarting: { property: Property; contract: Contract; monthsUntilStart: number }[] = []
    const contractEnding: { property: Property; match: EvaluatedAlertMatch }[] = []
    const taxSeason: { property: Property; match: EvaluatedAlertMatch }[] = []
    const vacantProps: { property: Property; match: EvaluatedAlertMatch }[] = []
    const now = new Date()
    for (const p of sortedProperties) {
      const metrics = alertMetricsForProperty(p)
      for (const m of evaluatePropertyAlerts(config, metrics)) {
        const rule = config.rules.find(r => r.id === m.userRuleId)
        const kind = rule?.trigger.kind
        if (kind === 'vacant') vacantProps.push({ property: p, match: m })
        else if (kind === 'monthsLeft') contractEnding.push({ property: p, match: m })
        else if (kind === 'taxDaysLeft') taxSeason.push({ property: p, match: m })
      }
      const next = nextNegotiatedLeaseNotYetStarted(p.contracts, now)
      if (next) {
        const monthsUntilStart = monthsUntilCalendarMonth(next.startDate)
        if (monthsUntilStart >= 0 && monthsUntilStart <= FEED_CONTRACT_START_WINDOW_MO) {
          contractStarting.push({ property: p, contract: next, monthsUntilStart })
        }
      }
    }
    contractStarting.sort(
      (a, b) => new Date(a.contract.startDate).getTime() - new Date(b.contract.startDate).getTime(),
    )
    return {
      contractStarting,
      contractEnding: sortTodoFeedAlertMatches(contractEnding),
      taxSeason: sortTodoFeedAlertMatches(taxSeason),
      vacantProps: sortTodoFeedAlertMatches(vacantProps),
    }
  }, [sortedProperties, todoFeedAlertConfig])

  // Payments panel — always uses real calendar month, not selectedYear
  const thisMonthPayments = useMemo(() => {
    const now = new Date()
    const calYear = now.getFullYear()
    const calMonth = now.getMonth() // 0-based
    return sortedProperties
      .filter(p => contractForMonth(p.contracts, calYear, calMonth) != null)
      .map(p => {
        const contract = contractForMonth(p.contracts, calYear, calMonth)!
        const monthData = (p.months[calYear] ?? {})[calMonth]
        const rent = monthData?.incomeOverride ?? contract.monthlyRent
        const received = monthData?.rentReceived === true
        return { property: p, rent, received, calYear, calMonth }
      })
  }, [sortedProperties])

  // Overdue payments — past months with active contract but rent not marked received
  const overduePayments = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-based
    // Scan back up to 24 months
    const LOOKBACK = 24
    const results: { property: typeof sortedProperties[0]; overdueMonths: { calYear: number; calMonth: number; rent: number }[]; totalRent: number }[] = []
    for (const p of sortedProperties) {
      const overdueMonths: { calYear: number; calMonth: number; rent: number }[] = []
      for (let i = 1; i <= LOOKBACK; i++) {
        let y = currentYear
        let m = currentMonth - i
        while (m < 0) { m += 12; y -= 1 }
        const contract = contractForMonth(p.contracts, y, m)
        if (!contract) continue
        const monthData = (p.months[y] ?? {})[m]
        if (monthData?.rentReceived === true) continue
        const rent = monthData?.incomeOverride ?? contract.monthlyRent
        overdueMonths.push({ calYear: y, calMonth: m, rent })
      }
      if (overdueMonths.length > 0) {
        results.push({
          property: p,
          overdueMonths,
          totalRent: overdueMonths.reduce((s, x) => s + x.rent, 0),
        })
      }
    }
    return results
  }, [sortedProperties])

  // Maintenance panel — current-year CAPEX items from all filtered properties
  const maintenanceItems = useMemo(() => {
    const calYear = new Date().getFullYear()
    const out: Array<CapexItem & { propertyId: number; propertyName: string }> = []
    for (const p of filteredProperties) {
      for (const c of (p.capex ?? [])) {
        if (new Date(c.date).getFullYear() === calYear) {
          out.push({ ...c, propertyId: p.id, propertyName: p.name })
        }
      }
    }
    return out
  }, [filteredProperties])

  const mTodo      = maintenanceItems.filter(c => !c.status || c.status === 'To do')
  const mOngoing   = maintenanceItems.filter(c => c.status === 'Ongoing')
  const mCompleted = maintenanceItems.filter(c => c.status === 'Completed')

  const totals = calcPortfolioTotalsIn(filteredProperties.map(withYear), displayCurrency, fxRates)
  const portfolioProjectedGpi = useMemo(
    () => calcPortfolioProjectedGpiIn(filteredProperties.map(withYear), displayCurrency, fxRates),
    [filteredProperties, displayCurrency, fxRates, selectedYear],
  )

  const portfolioAvgVacancyMoRatePct = useMemo(() => {
    const n = filteredProperties.length
    if (n === 0) return null
    const sumFracs = filteredProperties.reduce(
      (acc, p) => acc + vacancyLossMonthCount(withYear(p)) / 12,
      0,
    )
    return (sumFracs / n) * 100
  }, [filteredProperties, selectedYear])

  /** Per-m² footer: sums EGI, NOI, and est. value only for properties with area > 0 (display currency). */
  const portfolioPerM2Footer = useMemo(() => {
    let area = 0
    let egi = 0
    let noi = 0
    let value = 0
    for (const p of filteredProperties) {
      const ar = p.area
      if (ar == null || ar <= 0) continue
      area += ar
      const ann = convertAnnual(calcAnnual(withYear(p)), p.currency, displayCurrency, fxRates)
      egi += ann.egi
      noi += ann.noi
      const e = estimatedPropertyValueAtYear(withYear(p), selectedYear)
      if (e.value != null && e.value > 0) value += convert(e.value, p.currency, displayCurrency, fxRates)
    }
    if (area <= 0) return { egiPerM2: null as number | null, noiPerM2: null as number | null, valuePerM2: null as number | null }
    return { egiPerM2: egi / area, noiPerM2: noi / area, valuePerM2: value / area }
  }, [filteredProperties, selectedYear, displayCurrency, fxRates])

  const valueEquityTotals = useMemo(() => {
    let estValue = 0
    let debt = 0
    for (const p of filteredProperties) {
      const e = estimatedPropertyValueAtYear(withYear(p), selectedYear)
      if (e.value != null && e.value > 0) estValue += convert(e.value, p.currency, displayCurrency, fxRates)
      const m = p.factSheet?.mortgage
      if (m?.hasMortgage && m.outstandingBalance != null && m.outstandingBalance > 0) {
        debt += convert(m.outstandingBalance, p.currency, displayCurrency, fxRates)
      }
    }
    return { estValue, debt }
  }, [filteredProperties, selectedYear, displayCurrency, fxRates])

  const assetKpis = useMemo(
    () => calcPortfolioAssetKpis(filteredProperties, selectedYear, displayCurrency, fxRates),
    [filteredProperties, selectedYear, displayCurrency, fxRates],
  )

  const annualsMap = useMemo(() => {
    const m = new Map<number, ReturnType<typeof calcAnnual>>()
    for (const p of properties) m.set(p.id, calcAnnual(withYear(p)))
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, selectedYear])

  const activeContractMap = useMemo(() => {
    const m = new Map<number, { monthlyRent: number } | null>()
    for (const p of properties) {
      const ac = activeContract(p)
      m.set(p.id, ac ? { monthlyRent: ac.monthlyRent } : null)
    }
    return m
  }, [properties])

  const ratioRow = useMemo(() => {
    const base = kpiPctBase === 'gpi' ? portfolioProjectedGpi : totals.egi
    if (!base || !Number.isFinite(base) || base <= 0) {
      return {
        egiPct: null as number | null,
        opexPct: null as number | null,
        noiPct: null as number | null,
        taxesPct: null as number | null,
        netPct: null as number | null,
      }
    }
    return {
      egiPct: (totals.egi / base) * 100,
      opexPct: (totals.opex / base) * 100,
      noiPct: (totals.noi / base) * 100,
      taxesPct: (totals.taxes / base) * 100,
      netPct: (totals.net / base) * 100,
    }
  }, [kpiPctBase, portfolioProjectedGpi, totals.egi, totals.opex, totals.noi, totals.taxes, totals.net])

  const advancedKpis = useMemo(() => {
    // Cap Rate = NOI / Total Asset Value
    const capRate =
      assetKpis.totalValue > 0 && Number.isFinite(totals.noi)
        ? (totals.noi / assetKpis.totalValue) * 100
        : null

    // Equity Multiplier = Total Asset Value / Total Equity
    const totalEquity = valueEquityTotals.estValue - valueEquityTotals.debt
    const equityMultiplier =
      totalEquity > 0 && valueEquityTotals.estValue > 0
        ? valueEquityTotals.estValue / totalEquity
        : null

    // IRR Annualized — equity-weighted average across properties with purchase data
    let irrWeightedSum = 0
    let irrTotalWeight = 0
    for (const p of filteredProperties) {
      const fs = p.factSheet
      if (!fs?.purchaseDate || !fs.purchasePrice || fs.purchasePrice <= 0) continue
      const purchaseYear = new Date(fs.purchaseDate).getFullYear()
      if (Number.isNaN(purchaseYear)) continue
      const yearsHeld = selectedYear - purchaseYear
      if (yearsHeld <= 0) continue

      const mortgageOriginal = fs.mortgage?.hasMortgage ? (fs.mortgage.originalAmount ?? 0) : 0
      const downPayment =
        fs.mortgage?.downPayment != null && fs.mortgage.downPayment > 0
          ? fs.mortgage.downPayment
          : Math.max(0, fs.purchasePrice - mortgageOriginal)
      const equityInvested = downPayment > 0 ? downPayment : fs.purchasePrice

      const est = estimatedPropertyValueAtYear({ ...p, year: selectedYear }, selectedYear)
      if (est.value == null || est.value <= 0) continue
      const outstanding =
        fs.mortgage?.hasMortgage && fs.mortgage.outstandingBalance != null
          ? fs.mortgage.outstandingBalance
          : 0

      const annual = convertAnnual(calcAnnual({ ...p, year: selectedYear }), p.currency, displayCurrency, fxRates)
      const annualNetCf = annual.netCf
      const estValueDisp = convert(est.value, p.currency, displayCurrency, fxRates)
      const outstandingDisp = convert(outstanding, p.currency, displayCurrency, fxRates)
      const equityInvestedDisp = convert(equityInvested, p.currency, displayCurrency, fxRates)
      if (equityInvestedDisp <= 0) continue

      const cashFlows: number[] = [-equityInvestedDisp]
      for (let y = 1; y < yearsHeld; y++) cashFlows.push(annualNetCf)
      cashFlows.push(annualNetCf + (estValueDisp - outstandingDisp))

      const irr = calcIrr(cashFlows)
      if (irr != null && irr > -0.99 && irr < 5) {
        irrWeightedSum += irr * equityInvestedDisp
        irrTotalWeight += equityInvestedDisp
      }
    }
    const irrAnnualized = irrTotalWeight > 0 ? irrWeightedSum / irrTotalWeight : null

    return { capRate, equityMultiplier, irrAnnualized }
  }, [filteredProperties, selectedYear, totals.noi, assetKpis.totalValue, valueEquityTotals, displayCurrency, fxRates])

  useEffect(() => {
    if (propertiesLayoutView !== 'list') {
      setShowScrollBtns(false)
      return
    }
    const el = tableScrollRef.current
    if (!el) return
    const check = () => setShowScrollBtns(el.scrollWidth > el.clientWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [properties, propertiesLayoutView])

  useEffect(() => {
    if (!kpiMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (kpiMenuRef.current && !kpiMenuRef.current.contains(e.target as Node)) setKpiMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [kpiMenuOpen])

  useEffect(() => {
    if (!colMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [colMenuOpen])

  useEffect(() => {
    if (!fxOpen) return
    const handler = (e: MouseEvent) => {
      if (fxRef.current && !fxRef.current.contains(e.target as Node)) setFxOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fxOpen])

  useEffect(() => {
    if (!filterDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) setFilterDropdownOpen(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterDropdownOpen])

  function applyColSet(cols: ColKey[]) {
    const next = Object.fromEntries(COL_KEYS.map(k => [k, cols.includes(k)])) as Record<ColKey, boolean>
    setColVis(next)
    localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next))
  }

  function toggleCol(key: ColKey) {
    setColVis(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setActivePreset(null)
  }

  function toggleCardMetric(key: ColKey) {
    setCardMetricVis(prev => {
      const turningOn = !prev[key]
      if (turningOn) {
        const nOn = COL_KEYS.filter(k => prev[k]).length
        if (nOn >= CARD_METRIC_MAX_ON) {
          queueMicrotask(() => {
            setCardMetricMax5Hint(true)
            window.setTimeout(() => setCardMetricMax5Hint(false), 2200)
          })
          return prev
        }
      }
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(CARD_METRIC_VIS_KEY, JSON.stringify(next))
      return next
    })
  }

  function saveCustomPreset(slot: number, name: string) {
    const visibleCols = colOrder.filter(k => colVis[k])
    const next = [...customPresets] as (CustomPreset | null)[]
    next[slot] = { name, cols: visibleCols }
    setCustomPresets(next)
    saveCustomPresets(next)
    setActivePreset(slot)
  }

  function deleteCustomPreset(slot: number) {
    const next = [...customPresets] as (CustomPreset | null)[]
    next[slot] = null
    setCustomPresets(next)
    saveCustomPresets(next)
    if (activePreset === slot) setActivePreset(null)
  }

  function toggleKpi(key: KpiKey) {
    setKpiVis(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const visibleKpis = kpiOrder.filter(k => kpiVis[k])

  function colExportDefs(dc: CurrencyCode) {
    const raw = (n: number | null | undefined) => n != null ? String(Math.round(n * 100) / 100) : ''
    const map: Record<ColKey, { label: string; value: (p: Property, a: ReturnType<typeof convertAnnual>, ac: Contract | null) => string }> = {
      owner: { label: 'Owner', value: (p) => p.owner || '' },
      country: { label: 'Country', value: (p) => p.country || '' },
      status: { label: 'Status', value: (_p, _a, ac) => ac ? 'Rented' : 'Vacant' },
      nonLeaseOcc: { label: 'Occupancy', value: (p) => nonLeaseOccupancyExportValue(p) },
      endDate: { label: 'Months Left', value: (_p, _a, ac) => {
        if (!ac) return ''
        const end = new Date(ac.endDate), now = new Date()
        return String((end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth())
      }},
      taxStatus: { label: 'Tax Status', value: (p) => { const pend = (p.taxes?.items ?? []).filter(t => t.status === 'pending'); return pend.length > 0 ? 'Pending' : 'Paid' }},
      propertyType: { label: 'Type', value: (p) => p.factSheet?.propertyType || '' },
      bedrooms: { label: 'Beds', value: (p) => p.bedrooms ? String(p.bedrooms) : '' },
      area: { label: 'Area (m²)', value: (p) => p.area ? String(p.area) : '' },
      bathrooms: { label: 'Baths', value: (p) => p.bathrooms ? String(p.bathrooms) : '' },
      parking: { label: 'Parking', value: (p) => p.parking ? String(p.parking) : '' },
      floor: { label: 'Floor', value: (p) => p.factSheet?.floor != null ? String(p.factSheet.floor) : '' },
      estrato: { label: 'Estrato', value: (p) => p.factSheet?.estrato != null ? String(p.factSheet.estrato) : '' },
      yearBuilt: { label: 'Year Built', value: (p) => p.factSheet?.yearBuilt != null ? String(p.factSheet.yearBuilt) : '' },
      lastRenovation: { label: 'Renovation', value: (p) => p.factSheet?.lastRenovation != null ? String(p.factSheet.lastRenovation) : '' },
      estValue: {
        label: `Est. value (${dc})`,
        value: (p) => {
          const e = estimatedPropertyValueAtYear(withYear(p), selectedYear)
          if (e.value == null) return ''
          return raw(convert(e.value, p.currency, dc, fxRates))
        },
      },
      valueYoY: {
        label: 'Value YoY %',
        value: (p) => {
          const y = propertyValueYoYPct(withYear(p), selectedYear)
          return y != null && Number.isFinite(y) ? String(Math.round(y * 100) / 100) : ''
        },
      },
      ownedSince: { label: 'Owned since', value: (p) => p.factSheet?.purchaseDate?.trim() ?? '' },
      debt: {
        label: `Debt (${dc})`,
        value: (p) => {
          const m = p.factSheet?.mortgage
          if (!m?.hasMortgage || m.outstandingBalance == null) return ''
          return raw(convert(m.outstandingBalance, p.currency, dc, fxRates))
        },
      },
      mtgYearsLeft: {
        label: 'Mortgage yrs left',
        value: (p) => {
          const y = mortgageYearsRemaining(p.factSheet?.mortgage?.endDate)
          return y != null ? String(y) : ''
        },
      },
      gpi: { label: `GPI (${dc})`, value: (p) => raw(convert(projectedGpiAnnual(withYear(p)), p.currency, dc, fxRates)) },
      egi: { label: `EGI (${dc})`, value: (_p, a) => raw(a.egi) },
      egiPerM2: {
        label: `$/m² (${dc})`,
        value: (p, a) => {
          const ar = p.area
          if (ar == null || ar <= 0) return ''
          return raw(a.egi / ar)
        },
      },
      vacancyMoRate: {
        label: 'Vacancy mo rate %',
        value: (p) => {
          const m = vacancyLossMonthCount(withYear(p))
          return m === 0 ? '0' : String(Math.round((m / 12) * 1000) / 10)
        },
      },
      opex: { label: `OPEX (${dc})`, value: (_p, a) => raw(-a.totalOpex) },
      noi: { label: `NOI (${dc})`, value: (_p, a) => raw(a.noi) },
      noiPerM2: {
        label: `NOI/m² (${dc})`,
        value: (p, a) => {
          const ar = p.area
          if (ar == null || ar <= 0 || !Number.isFinite(a.noi)) return ''
          return raw(a.noi / ar)
        },
      },
      valuePerM2: {
        label: `Value/m² (${dc})`,
        value: (p) => {
          const ar = p.area
          if (ar == null || ar <= 0) return ''
          const e = estimatedPropertyValueAtYear(withYear(p), selectedYear)
          if (e.value == null || e.value <= 0) return ''
          return raw(convert(e.value, p.currency, dc, fxRates) / ar)
        },
      },
      capRate: {
        label: 'Cap rate %',
        value: (p, a) => {
          const cap = propertyCapRatePct(withYear(p), selectedYear, dc, fxRates, a)
          return cap != null && Number.isFinite(cap) ? String(Math.round(cap * 100) / 100) : ''
        },
      },
      capex: { label: `CAPEX (${dc})`, value: (_p, a) => raw(a.totalCapex ? -a.totalCapex : 0) },
      yieldOnCapex: {
        label: 'Yield on CAPEX %',
        value: (_p, a) => {
          if (!a.totalCapex || !Number.isFinite(a.noi)) return ''
          return String(Math.round((a.noi / a.totalCapex) * 10000) / 100)
        },
      },
      payback: {
        label: 'Payback (yrs)',
        value: (_p, a) => {
          if (!a.totalCapex || !Number.isFinite(a.noi) || a.noi <= 0) return ''
          return String(Math.round((a.totalCapex / a.noi) * 10) / 10)
        },
      },
      taxes: { label: `Taxes (${dc})`, value: (_p, a) => raw(a.taxes ? -a.taxes : 0) },
      netCf: { label: `Net CF (${dc})`, value: (_p, a) => raw(a.netCf) },
      margin: {
        label: 'Margin',
        value: (p, a) => {
          const g = convert(projectedGpiAnnual(withYear(p)), p.currency, dc, fxRates)
          return g ? String(Math.round((a.netCf / g) * 100)) : ''
        },
      },
    }
    return map
  }

  function handleDownloadCsv() {
    const dc = displayCurrency
    const defs = colExportDefs(dc)
    const visCols = colOrder.filter(k => colVis[k])
    const headers = ['Property', ...visCols.map(k => defs[k].label)]
    const rows = filteredProperties.map((p) => {
      const a = convertAnnual(calcAnnual(withYear(p)), p.currency, dc, fxRates)
      const ac = activeContract(p)
      return [`"${p.name}"`, ...visCols.map(k => {
        const v = defs[k].value(p, a, ac)
        return v.includes(',') ? `"${v}"` : v
      })].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio-${selectedYear}-${dc}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleCopy() {
    const dc = displayCurrency
    const defs = colExportDefs(dc)
    const visCols = colOrder.filter(k => colVis[k])
    const headers = ['Property', ...visCols.map(k => defs[k].label)]
    const rows = filteredProperties.map((p) => {
      const a = convertAnnual(calcAnnual(withYear(p)), p.currency, dc, fxRates)
      const ac = activeContract(p)
      return [p.name, ...visCols.map(k => defs[k].value(p, a, ac))].join('\t')
    })
    navigator.clipboard.writeText([headers.join('\t'), ...rows].join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-col" style={{ flex: 1, minWidth: 0 }}>
      <div className="content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>Portfolio</div>
            <div className="hide-mobile" style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{properties.length} properties · Values in {displayCurrency}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CurrencyPicker value={displayCurrency} onChange={setDisplayCurrency} />
            <div ref={fxRef} className="hide-mobile" style={{ position: 'relative' }}>
              <button
                className="ghost"
                style={{ padding: '5px 8px', fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title="FX Rates"
                onClick={() => setFxOpen(v => !v)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13"/><path d="M8 1.5c1.86 2.08 2.92 4.78 2.92 6.5S9.86 12.42 8 14.5c-1.86-2.08-2.92-4.78-2.92-6.5S6.14 3.58 8 1.5z"/></svg>
              </button>
              {fxOpen && (
                <FxRateEditor
                  rates={fxRates}
                  onSave={(r) => { setFxRates(r); saveFxRates(r); setFxOpen(false) }}
                  onClose={() => setFxOpen(false)}
                />
              )}
            </div>
            {!readOnly && <button className="primary" onClick={() => openAddProperty()}><span className="hide-mobile">+ Add Property</span><span className="show-mobile">+ Add</span></button>}
            <div ref={kpiMenuRef} style={{ position: 'relative' }}>
              <button className="ghost" style={{ padding: '5px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="KPI settings" onClick={() => setKpiMenuOpen(v => !v)}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14.55 11.25C14.4502 11.4762 14.4204 11.7271 14.4645 11.9704C14.5086 12.2137 14.6246 12.4382 14.7975 12.615L14.8425 12.66C14.9819 12.7994 15.0924 12.9648 15.1678 13.1469C15.2433 13.329 15.2821 13.5242 15.2821 13.7213C15.2821 13.9183 15.2433 14.1135 15.1678 14.2956C15.0924 14.4777 14.9819 14.6431 14.8425 14.7825C14.7031 14.9219 14.5377 15.0324 14.3556 15.1078C14.1735 15.1833 13.9783 15.2221 13.7812 15.2221C13.5842 15.2221 13.389 15.1833 13.2069 15.1078C13.0248 15.0324 12.8594 14.9219 12.72 14.7825L12.675 14.7375C12.4982 14.5646 12.2737 14.4486 12.0304 14.4045C11.7871 14.3604 11.5362 14.3902 11.31 14.49C11.0882 14.5851 10.899 14.7429 10.7657 14.9442C10.6325 15.1454 10.561 15.3812 10.56 15.6225V15.75C10.56 16.1478 10.402 16.5294 10.1207 16.8107C9.83936 17.092 9.45782 17.25 9.06 17.25C8.66218 17.25 8.28064 17.092 7.99934 16.8107C7.71804 16.5294 7.56 16.1478 7.56 15.75V15.6825C7.55419 15.4343 7.47384 15.1935 7.32938 14.9915C7.18493 14.7896 6.98305 14.6357 6.75 14.55C6.52379 14.4502 6.27286 14.4204 6.02956 14.4645C5.78626 14.5086 5.56176 14.6246 5.385 14.7975L5.34 14.8425C5.05854 15.124 4.6768 15.2821 4.27875 15.2821C3.8807 15.2821 3.49896 15.124 3.2175 14.8425C2.93604 14.561 2.77792 14.1793 2.77792 13.7812C2.77792 13.3832 2.93604 13.0015 3.2175 12.72L3.2625 12.675C3.44798 12.4934 3.57168 12.2581 3.6161 12.0024C3.66052 11.7467 3.6234 11.4835 3.51 11.25C3.41493 11.0282 3.25707 10.839 3.05585 10.7057C2.85463 10.5725 2.61884 10.501 2.3775 10.5H2.25C1.85218 10.5 1.47064 10.342 1.18934 10.0607C0.908035 9.77936 0.75 9.39782 0.75 9C0.75 8.60218 0.908035 8.22064 1.18934 7.93934C1.47064 7.65804 1.85218 7.5 2.25 7.5H2.3175C2.55884 7.49904 2.79463 7.42753 2.99585 7.29427C3.19707 7.16101 3.35493 6.97183 3.45 6.75C3.54984 6.52379 3.57962 6.27286 3.5355 6.02956C3.49139 5.78626 3.3754 5.56176 3.2025 5.385L3.1575 5.34C3.01813 5.20063 2.90758 5.03518 2.83216 4.85309C2.75674 4.671 2.71792 4.47584 2.71792 4.27875C2.71792 4.08166 2.75674 3.8865 2.83216 3.70441C2.90758 3.52232 3.01813 3.35687 3.1575 3.2175C3.29687 3.07813 3.46232 2.96758 3.64441 2.89216C3.8265 2.81674 4.02166 2.77792 4.21875 2.77792C4.41584 2.77792 4.611 2.81674 4.79309 2.89216C4.97518 2.96758 5.14063 3.07813 5.28 3.2175L5.325 3.2625C5.50656 3.44798 5.74185 3.57168 5.99758 3.6161C6.25331 3.66052 6.51653 3.6234 6.75 3.51C6.97183 3.41493 7.16101 3.25707 7.29427 3.05585C7.42753 2.85463 7.49904 2.61884 7.5 2.3775V2.25C7.5 1.85218 7.65804 1.47064 7.93934 1.18934C8.22064 0.908035 8.60218 0.75 9 0.75C9.39782 0.75 9.77936 0.908035 10.0607 1.18934C10.342 1.47064 10.5 1.85218 10.5 2.25V2.3175C10.501 2.55884 10.5725 2.79463 10.7057 2.99585C10.839 3.19707 11.0282 3.35493 11.25 3.45C11.4762 3.54984 11.7271 3.57962 11.9704 3.5355C12.2137 3.49139 12.4382 3.3754 12.615 3.2025L12.66 3.1575C12.9415 2.87604 13.3232 2.71792 13.7213 2.71792C13.9183 2.71792 14.1135 2.75674 14.2956 2.83216C14.4777 2.90758 14.6431 3.01813 14.7825 3.1575C14.9219 3.29687 15.0324 3.46232 15.1078 3.64441C15.1833 3.8265 15.2221 4.02166 15.2221 4.21875C15.2221 4.41584 15.1833 4.611 15.1078 4.79309C15.0324 4.97518 14.9219 5.14063 14.7825 5.28L14.7375 5.325C14.5618 5.51345 14.4493 5.75204 14.4157 6.00749C14.3821 6.26294 14.429 6.52252 14.55 6.75C14.6451 6.97183 14.8029 7.16101 15.0042 7.29427C15.2054 7.42753 15.4412 7.49904 15.6825 7.5H15.75C16.1478 7.5 16.5294 7.65804 16.8107 7.93934C17.092 8.22064 17.25 8.60218 17.25 9C17.25 9.39782 17.092 9.77936 16.8107 10.0607C16.5294 10.342 16.1478 10.5 15.75 10.5H15.6825C15.4412 10.501 15.2054 10.5725 15.0042 10.7057C14.8029 10.839 14.6451 11.0282 14.55 11.25Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {kpiMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 6,
                  background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 220,
                  animation: 'selectSlideIn 0.15s ease-out',
                }}>
                  {kpiOrder.some(k => kpiVis[k]) && (
                    <>
                      <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Visible — drag to reorder
                      </div>
                      {kpiOrder.filter(k => kpiVis[k]).map(key => (
                        <div
                          key={key}
                          draggable
                          onDragStart={(e) => { setDragKpi(key); e.dataTransfer.effectAllowed = 'move' }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverKpi !== key) setDragOverKpi(key) }}
                          onDragLeave={() => setDragOverKpi(prev => prev === key ? null : prev)}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragKpi && dragKpi !== key) {
                              setKpiOrder(prev => {
                                const next = [...prev], from = next.indexOf(dragKpi), to = next.indexOf(key)
                                next.splice(from, 1); next.splice(to, 0, dragKpi)
                                localStorage.setItem(KPI_ORDER_KEY, JSON.stringify(next))
                                return next
                              })
                            }
                            setDragKpi(null); setDragOverKpi(null)
                          }}
                          onDragEnd={() => { setDragKpi(null); setDragOverKpi(null) }}
                          style={{
                            display: 'flex', alignItems: 'center', padding: '8px 14px', cursor: 'grab',
                            opacity: dragKpi === key ? 0.35 : 1,
                            borderTop: dragOverKpi === key && dragKpi !== key ? '2px solid var(--accent-bg)' : '2px solid transparent',
                            transition: 'border-color 0.1s, opacity 0.1s',
                          }}
                        >
                          <svg width="10" height="14" viewBox="0 0 10 14" fill="#c4c9d2" style={{ flexShrink: 0, marginRight: 8 }}>
                            <circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/>
                            <circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/>
                            <circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/>
                          </svg>
                          <span style={{ fontSize: 13, flex: 1 }}>{KPI_META[key].label}</span>
                          <button
                            className="ghost"
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleKpi(key) }}
                            style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                          >
                            <IconEye visible={true} />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {kpiOrder.some(k => !kpiVis[k]) && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Hidden
                      </div>
                      {kpiOrder.filter(k => !kpiVis[k]).map(key => (
                        <button
                          key={key}
                          className="ghost"
                          style={{ width: '100%', textAlign: 'left', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0, color: 'var(--text3)' }}
                          onClick={() => toggleKpi(key)}
                        >
                          <span style={{ fontSize: 13 }}>{KPI_META[key].label}</span>
                          <IconEye visible={false} />
                        </button>
                      ))}
                    </>
                  )}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  <div style={{ padding: '8px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>% base</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Metric for % pills</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: kpiPctBase === 'gpi' ? 'var(--accent-bg)' : 'var(--text3)', transition: 'color 0.2s' }}>GPI</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={kpiPctBase === 'egi'}
                        onClick={() => {
                          const next: 'egi' | 'gpi' = kpiPctBase === 'egi' ? 'gpi' : 'egi'
                          setKpiPctBase(next)
                          localStorage.setItem(KPI_PCT_BASE_KEY, next)
                        }}
                        style={{
                          width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', padding: 0,
                          background: kpiPctBase === 'egi' ? 'var(--accent-bg)' : '#d1d5db',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <span style={{
                          display: 'block', width: 12, height: 12, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 3,
                          left: kpiPctBase === 'egi' ? 17 : 3,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 600, color: kpiPctBase === 'egi' ? 'var(--accent-bg)' : 'var(--text3)', transition: 'color 0.2s' }}>EGI</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {visibleKpis.length > 0 && (
          <div className="kpi-row mb24">
            {visibleKpis.map(key => {
              const isIrr = key === 'irrAnnualized'
              const isCapRate = key === 'capRate'
              const isEquityMul = key === 'equityMultiplier'
              let valueCls =
                key === 'assetYoY'
                  ? (assetKpis.avgYoYpct == null ? '' : assetKpis.avgYoYpct < -0.05 ? 'neg' : 'pos')
                  : isIrr
                    ? (advancedKpis.irrAnnualized == null ? '' : advancedKpis.irrAnnualized < 0 ? 'neg' : 'pos')
                    : KPI_META[key].cls || ''
              const cashflowPct =
                key === 'gpi' || key === 'egi' || key === 'opex' || key === 'noi' || key === 'capex' || key === 'taxes' || key === 'net'
              let mainValue: string = '—'
              if (key === 'assetValue') {
                mainValue = assetKpis.valuedCount > 0 ? fm(assetKpis.totalValue) : '—'
              } else if (key === 'assetYoY') {
                if (assetKpis.avgYoYpct != null && Number.isFinite(assetKpis.avgYoYpct)) {
                  const p = assetKpis.avgYoYpct
                  const nearZero = Math.abs(p) < 0.05
                  const abs = nearZero ? '0' : Math.abs(p).toFixed(1)
                  mainValue = p > 0 || nearZero ? `+${abs}%` : `−${abs}%`
                }
              } else if (isIrr) {
                if (advancedKpis.irrAnnualized != null && Number.isFinite(advancedKpis.irrAnnualized)) {
                  const pct = advancedKpis.irrAnnualized * 100
                  mainValue = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`
                }
              } else if (isCapRate) {
                if (advancedKpis.capRate != null && Number.isFinite(advancedKpis.capRate)) {
                  mainValue = `${advancedKpis.capRate.toFixed(2)}%`
                }
              } else if (isEquityMul) {
                if (advancedKpis.equityMultiplier != null && Number.isFinite(advancedKpis.equityMultiplier)) {
                  mainValue = `${advancedKpis.equityMultiplier.toFixed(2)}x`
                }
              } else if (cashflowPct) {
                if (key === 'gpi') {
                  mainValue = fm(portfolioProjectedGpi)
                } else {
                  const tk = key as keyof typeof totals
                  mainValue = `${KPI_META[key].negPrefix && totals[tk] ? '−' : ''}${fm(totals[tk])}`
                }
              }
              return (
                <div className="kpi-card" key={key}>
                  <div className="kpi-label">{KPI_META[key].label} <KpiInfoIcon tip={KPI_META[key].tip} /></div>
                  <div className={`kpi-value ${valueCls}`}>{mainValue}</div>
                  {key === 'gpi' && kpiPctBase === 'gpi' && <KpiPctOfEgiDelta pct={portfolioProjectedGpi} kind="base100" base="GPI" />}
                  {key === 'egi' && kpiPctBase === 'egi' && <KpiPctOfEgiDelta pct={totals.egi} kind="base100" base="EGI" />}
                  {key === 'egi' && kpiPctBase === 'gpi' && <KpiPctOfEgiDelta pct={ratioRow.egiPct} kind="pct-up" base="GPI" />}
                  {key === 'opex' && <KpiPctOfEgiDelta pct={ratioRow.opexPct} kind="opex" base={kpiPctBase === 'gpi' ? 'GPI' : 'EGI'} />}
                  {key === 'noi' && <KpiPctOfEgiDelta pct={ratioRow.noiPct} kind="noi" base={kpiPctBase === 'gpi' ? 'GPI' : 'EGI'} />}
                  {key === 'taxes' && <KpiPctOfEgiDelta pct={ratioRow.taxesPct} kind="taxes" base={kpiPctBase === 'gpi' ? 'GPI' : 'EGI'} />}
                  {key === 'net' && <KpiPctOfEgiDelta pct={ratioRow.netPct} kind="net" base={kpiPctBase === 'gpi' ? 'GPI' : 'EGI'} />}
                  {key === 'assetYoY' && <KpiAvgAssetYoYPill pct={assetKpis.avgYoYpct} />}
                </div>
              )
            })}
          </div>
        )}
        {/* Toolbar — placeholder row for tool actions */}
        <div className="portfolio-toolbar mb12" aria-label="Toolbar">
          <span className="portfolio-toolbar-label">Tools</span>
          <div className="portfolio-toolbar-tools">
            {PORTFOLIO_TOOL_ICONS.map((src, i) => (
              <button
                key={src}
                type="button"
                className={`filter-bar-icon-btn${openToolModal === i ? ' active' : ''}`}
                title={PORTFOLIO_TOOL_LABELS[i]}
                aria-label={PORTFOLIO_TOOL_LABELS[i]}
                aria-haspopup="dialog"
                aria-expanded={openToolModal === i}
                onClick={() => {
                  setOpenToolModal(i)
                  setToolModalMaximized(i === 0 && reportStep != null)
                }}
              >
                <span
                  className="portfolio-toolbar-tool-icon"
                  style={{
                    WebkitMaskImage: `url("${src}")`,
                    maskImage: `url("${src}")`,
                  }}
                  aria-hidden
                />
                <span>{PORTFOLIO_TOOL_LABELS[i]}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Filter bar */}
        <div className="filter-bar mb24" ref={filterBarRef}>
          <div className="filter-bar-top">
            <button
              className={`filter-bar-icon-btn filter-bar-filter-btn${Object.values(activeFilters).some(v => v != null && v.length > 0) ? ' active' : ''}`}
              title="Filter"
              onClick={() => setFilterDropdownOpen(prev => prev ? null : '__pick__')}
            >
              <IconFilter />
            </button>
            <div className="filter-bar-search">
              <IconSearch />
              <input
                type="text"
                placeholder="Search property name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-bar-actions">
              <button className="filter-bar-icon-btn" title="Download CSV" onClick={handleDownloadCsv}>
                <IconDownload />
                <span>CSV</span>
              </button>
              <div className="view-toggle-group" role="group" aria-label="View layout">
                <button
                  type="button"
                  className={`view-toggle-btn${propertiesLayoutView === 'list' ? ' active' : ''}`}
                  title="List view"
                  aria-label="List view"
                  aria-pressed={propertiesLayoutView === 'list'}
                  onClick={() => setPropertiesLayoutView('list')}
                >
                  <span
                    className="filter-bar-tool-mask-icon"
                    style={{
                      WebkitMaskImage: `url("${FILTER_BAR_LIST_VIEW_ICON}")`,
                      maskImage: `url("${FILTER_BAR_LIST_VIEW_ICON}")`,
                    }}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn${propertiesLayoutView === 'grid' ? ' active' : ''}`}
                  title="Grid view"
                  aria-label="Grid view"
                  aria-pressed={propertiesLayoutView === 'grid'}
                  onClick={() => setPropertiesLayoutView('grid')}
                >
                  <span
                    className="filter-bar-tool-mask-icon"
                    style={{
                      WebkitMaskImage: `url("${FILTER_BAR_GRID_VIEW_ICON}")`,
                      maskImage: `url("${FILTER_BAR_GRID_VIEW_ICON}")`,
                    }}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn${propertiesLayoutView === 'todo' ? ' active' : ''}`}
                  title="Todo view"
                  aria-label="Todo view"
                  aria-pressed={propertiesLayoutView === 'todo'}
                  onClick={() => setPropertiesLayoutView('todo')}
                >
                  <span
                    className="filter-bar-tool-mask-icon"
                    style={{
                      WebkitMaskImage: `url("${FILTER_BAR_TODO_VIEW_ICON}")`,
                      maskImage: `url("${FILTER_BAR_TODO_VIEW_ICON}")`,
                    }}
                    aria-hidden
                  />
                </button>
              </div>
              <div ref={colMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`filter-bar-icon-btn${colMenuOpen ? ' active' : ''}`}
                  title={propertiesLayoutView === 'grid' ? 'Card display' : propertiesLayoutView === 'todo' ? 'Panel visibility' : 'Column visibility'}
                  aria-label={propertiesLayoutView === 'grid' ? 'Card display' : propertiesLayoutView === 'todo' ? 'Panel visibility' : 'Column visibility'}
                  onClick={() => setColMenuOpen(v => !v)}
                >
                  <IconSpreadsheet />
                </button>
                {colMenuOpen && (() => {
                  if (propertiesLayoutView === 'todo') {
                    return (
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: 6,
                      background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 220,
                      animation: 'selectSlideIn 0.15s ease-out',
                    }}>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                        Panel visibility
                      </div>
                      {TODO_PANELS.map(panel => (
                        <div key={panel.key} style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', gap: 10 }}>
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: panel.mandatory ? 600 : 400 }}>
                            {panel.label}
                          </span>
                          {panel.mandatory ? (
                            <span style={{ fontSize: 11, color: 'var(--text3)', paddingRight: 2 }}>Always on</span>
                          ) : (
                            <button
                              type="button"
                              className="ghost"
                              style={{ padding: 4, color: todoPanelVis[panel.key] ? 'var(--accent-bg)' : '#d1d5db', lineHeight: 0 }}
                              title={todoPanelVis[panel.key] ? 'Hide panel' : 'Show panel'}
                              onClick={() => toggleTodoPanel(panel.key)}
                            >
                              {todoPanelVis[panel.key] ? (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="8" cy="8" rx="6.5" ry="4.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 1.5l13 13"/><path d="M6.56 6.6A2 2 0 009.4 9.44M4.1 4.16A6.6 6.6 0 001.5 8s1.5 4.5 6.5 4.5a6.4 6.4 0 003.38-.96M7 3.55A6.6 6.6 0 0114.5 8s-.56 1.67-1.68 2.84"/></svg>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    )
                  }
                  if (propertiesLayoutView === 'grid') {
                    return (
                  <div
                    ref={(el) => {
                      if (el) {
                        const top = el.getBoundingClientRect().top
                        el.style.maxHeight = `${window.innerHeight - top - 12}px`
                      }
                    }}
                    style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 6,
                    background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 260,
                    display: 'flex', flexDirection: 'column',
                    animation: 'selectSlideIn 0.15s ease-out',
                  }}>
                    <div style={{ padding: '10px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>Card display — up to 5</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.35 }}>
                        First three metrics: main row. Next two: detail rows. List view columns stay separate.
                      </div>
                      {cardMetricMax5Hint ? (
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', marginTop: 8 }}>Max 5 on card — hide one to add another.</div>
                      ) : null}
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                    {cardMetricOrder.some(k => cardMetricVis[k]) && (
                      <>
                        <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Visible — drag to reorder
                        </div>
                        {cardMetricOrder.filter(k => cardMetricVis[k]).map(key => (
                          <div
                            key={key}
                            draggable
                            onDragStart={(e) => { setDragCardMetric(key); e.dataTransfer.effectAllowed = 'move' }}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverCardMetric !== key) setDragOverCardMetric(key) }}
                            onDragLeave={() => setDragOverCardMetric(prev => prev === key ? null : prev)}
                            onDrop={(e) => {
                              e.preventDefault()
                              if (dragCardMetric && dragCardMetric !== key) {
                                setCardMetricOrder(prev => {
                                  const next = [...prev], from = next.indexOf(dragCardMetric), to = next.indexOf(key)
                                  next.splice(from, 1); next.splice(to, 0, dragCardMetric)
                                  localStorage.setItem(CARD_METRIC_ORDER_KEY, JSON.stringify(next))
                                  return next
                                })
                              }
                              setDragCardMetric(null); setDragOverCardMetric(null)
                            }}
                            onDragEnd={() => { setDragCardMetric(null); setDragOverCardMetric(null) }}
                            style={{
                              display: 'flex', alignItems: 'center', padding: '8px 14px', cursor: 'grab',
                              opacity: dragCardMetric === key ? 0.35 : 1,
                              borderTop: dragOverCardMetric === key && dragCardMetric !== key ? '2px solid var(--accent-bg)' : '2px solid transparent',
                              transition: 'border-color 0.1s, opacity 0.1s',
                            }}
                          >
                            <svg width="10" height="14" viewBox="0 0 10 14" fill="#c4c9d2" style={{ flexShrink: 0, marginRight: 8 }}>
                              <circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/>
                              <circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/>
                              <circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/>
                            </svg>
                            <span style={{ fontSize: 13, flex: 1 }}>{COL_LABELS[key]}</span>
                            <button
                              type="button"
                              className="ghost"
                              onClick={(e) => { e.stopPropagation(); toggleCardMetric(key) }}
                              style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                              aria-label={`Hide ${COL_LABELS[key]} from card`}
                            >
                              <IconEye visible={true} />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                    {cardMetricOrder.some(k => !cardMetricVis[k]) && (
                      <>
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                        <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Hidden
                        </div>
                        {cardMetricOrder.filter(k => !cardMetricVis[k]).map(key => (
                          <button
                            key={key}
                            type="button"
                            className="ghost"
                            style={{ width: '100%', textAlign: 'left', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0, color: 'var(--text3)' }}
                            onClick={() => toggleCardMetric(key)}
                            aria-label={`Show ${COL_LABELS[key]} on card`}
                          >
                            <span style={{ fontSize: 13 }}>{COL_LABELS[key]}</span>
                            <IconEye visible={false} />
                          </button>
                        ))}
                      </>
                    )}
                    <div style={{ height: 6 }} />
                    </div>
                  </div>
                    )
                  }
                  const customSlotActive = typeof activePreset === 'number' ? customPresets[activePreset] : null
                  return (
                  <div
                    ref={(el) => {
                      if (el) {
                        const top = el.getBoundingClientRect().top
                        el.style.maxHeight = `${window.innerHeight - top - 12}px`
                      }
                    }}
                    style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 6,
                    background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 220,
                    display: 'flex', flexDirection: 'column',
                    animation: 'selectSlideIn 0.15s ease-out',
                  }}>
                    {/* Built-in preset tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                      {BUILT_IN_PRESETS.map(bp => (
                        <button
                          key={bp.id}
                          className="ghost"
                          onClick={() => { applyColSet(bp.cols); setActivePreset(bp.id); setRenamingSlot(null) }}
                          style={{
                            flex: 1, padding: '9px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.5px', borderRadius: 0, textAlign: 'center',
                            color: activePreset === bp.id ? 'var(--accent-bg)' : 'var(--text3)',
                            boxShadow: activePreset === bp.id ? 'inset 0 -2px 0 var(--accent-bg)' : 'none',
                          }}
                        >
                          {bp.label}
                        </button>
                      ))}
                    </div>
                    {/* Custom preset tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                      {Array.from({ length: CUSTOM_SLOT_COUNT }, (_, i) => {
                        const preset = customPresets[i]
                        const isActive = activePreset === i
                        return (
                          <button
                            key={i}
                            className="ghost"
                            onClick={() => {
                              if (preset) { applyColSet(preset.cols); setActivePreset(i); setRenamingSlot(null) }
                              else { setRenamingSlot(i); setRenameValue('') }
                            }}
                            style={{
                              flex: 1, padding: '9px 6px', fontSize: 11, fontWeight: 600,
                              borderRadius: 0, textAlign: 'center', position: 'relative',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: isActive ? 'var(--accent-bg)' : preset ? 'var(--text3)' : '#d1d5db',
                              boxShadow: isActive ? 'inset 0 -2px 0 var(--accent-bg)' : 'none',
                            }}
                            title={preset ? preset.name : 'Save current columns as preset'}
                          >
                            {preset ? (
                              <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11 }}>{preset.name}</span>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {/* Inline rename / save input */}
                    {renamingSlot !== null && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); if (renameValue.trim()) { saveCustomPreset(renamingSlot, renameValue.trim()); setRenamingSlot(null) } }}
                        style={{ display: 'flex', padding: '8px 10px', gap: 6, borderBottom: '1px solid var(--border)', flexShrink: 0 }}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') setRenamingSlot(null) }}
                          placeholder="Preset name…"
                          maxLength={16}
                          style={{
                            flex: 1, fontSize: 13, padding: '5px 10px', minWidth: 0,
                            background: '#f7f9fc', border: '1px solid var(--border)', borderRadius: 8,
                            outline: 'none',
                          }}
                          onFocus={e => (e.target.style.borderColor = 'var(--accent-bg)')}
                          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                        />
                        <button
                          type="submit"
                          disabled={!renameValue.trim()}
                          style={{
                            fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                            background: renameValue.trim() ? 'var(--accent-bg)' : '#e5e7eb', color: renameValue.trim() ? 'var(--accent-text)' : '#9ca3af',
                            border: 'none', cursor: renameValue.trim() ? 'pointer' : 'default',
                          }}
                        >Save</button>
                      </form>
                    )}
                    {/* Delete / update actions for active custom preset */}
                    {typeof activePreset === 'number' && customSlotActive && renamingSlot === null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                        <button
                          className="ghost"
                          onClick={() => { saveCustomPreset(activePreset, customSlotActive.name) }}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-bg)', padding: '2px 6px', borderRadius: 6 }}
                        >Update preset</button>
                        <button
                          className="ghost"
                          onClick={() => { setRenamingSlot(activePreset); setRenameValue(customSlotActive.name) }}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', padding: '2px 6px', borderRadius: 6 }}
                        >Rename</button>
                        <button
                          className="ghost"
                          onClick={() => deleteCustomPreset(activePreset)}
                          style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', padding: '2px 6px', borderRadius: 6 }}
                        >Delete</button>
                      </div>
                    )}
                    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                    {colOrder.some(k => colVis[k]) && (
                      <>
                        <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Visible — drag to reorder
                        </div>
                        {colOrder.filter(k => colVis[k]).map(key => (
                          <div
                            key={key}
                            draggable
                            onDragStart={(e) => { setDragCol(key); e.dataTransfer.effectAllowed = 'move' }}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverCol !== key) setDragOverCol(key) }}
                            onDragLeave={() => setDragOverCol(prev => prev === key ? null : prev)}
                            onDrop={(e) => {
                              e.preventDefault()
                              if (dragCol && dragCol !== key) {
                                setColOrder(prev => {
                                  const next = [...prev], from = next.indexOf(dragCol), to = next.indexOf(key)
                                  next.splice(from, 1); next.splice(to, 0, dragCol)
                                  localStorage.setItem(COL_ORDER_KEY, JSON.stringify(next))
                                  return next
                                })
                              }
                              setDragCol(null); setDragOverCol(null)
                            }}
                            onDragEnd={() => { setDragCol(null); setDragOverCol(null) }}
                            style={{
                              display: 'flex', alignItems: 'center', padding: '8px 14px', cursor: 'grab',
                              opacity: dragCol === key ? 0.35 : 1,
                              borderTop: dragOverCol === key && dragCol !== key ? '2px solid var(--accent-bg)' : '2px solid transparent',
                              transition: 'border-color 0.1s, opacity 0.1s',
                            }}
                          >
                            <svg width="10" height="14" viewBox="0 0 10 14" fill="#c4c9d2" style={{ flexShrink: 0, marginRight: 8 }}>
                              <circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/>
                              <circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/>
                              <circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/>
                            </svg>
                            <span style={{ fontSize: 13, flex: 1 }}>{COL_LABELS[key]}</span>
                            <button
                              className="ghost"
                              onClick={(e) => { e.stopPropagation(); toggleCol(key) }}
                              style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                            >
                              <IconEye visible={true} />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                    {colOrder.some(k => !colVis[k]) && (
                      <>
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                        <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Hidden
                        </div>
                        {colOrder.filter(k => !colVis[k]).map(key => (
                          <button
                            key={key}
                            className="ghost"
                            style={{ width: '100%', textAlign: 'left', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0, color: 'var(--text3)' }}
                            onClick={() => toggleCol(key)}
                          >
                            <span style={{ fontSize: 13 }}>{COL_LABELS[key]}</span>
                            <IconEye visible={false} />
                          </button>
                        ))}
                      </>
                    )}
                    <div style={{ height: 6 }} />
                    </div>
                  </div>
                  )
                })()}
              </div>
            </div>
          </div>
          {(Object.keys(activeFilters).length > 0 || filterDropdownOpen) && (
            <div className="filter-bar-pills">
              {/* Filter chips — both assigned and unassigned */}
              {Object.entries(activeFilters).map(([key, value]) => {
                const col = FILTER_COLUMNS.find(c => c.key === key)
                if (!col) return null
                const isOpen = filterDropdownOpen === key
                const selected = value ?? []
                const hasValue = selected.length > 0
                return (
                  <div key={key} style={{ position: 'relative', display: 'inline-flex' }}>
                    <button
                      className={`filter-pill${hasValue ? ' active' : ''}`}
                      style={{
                        paddingRight: 6, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none',
                        ...(!hasValue ? { borderStyle: 'dashed', color: 'var(--accent-bg)' } : {}),
                      }}
                      onClick={() => setFilterDropdownOpen(prev => prev === key ? null : key)}
                    >
                      {hasValue ? `${col.label}: ${formatFilterPillSummary(selected)}` : col.label}
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 5, transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                        <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      className={`filter-pill${hasValue ? ' active' : ''}`}
                      style={{
                        paddingLeft: 6, borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                        ...(hasValue ? { borderLeft: '1px solid rgba(255,255,255,0.3)' } : { borderStyle: 'dashed', borderLeft: '1px dashed var(--border)', color: 'var(--accent-bg)' }),
                      }}
                      onClick={() => { setActiveFilters(prev => { const next = { ...prev }; delete next[key]; return next }); if (isOpen) setFilterDropdownOpen(null) }}
                      title="Remove filter"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                    {isOpen && (
                      <div style={{
                        position: 'absolute', left: 0, top: '100%', marginTop: 6,
                        background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 170,
                        animation: 'selectSlideIn 0.15s ease-out', overflow: 'hidden',
                      }}>
                        <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          {col.label}
                        </div>
                        {col.values.map(val => {
                          const checked = selected.includes(val)
                          return (
                            <button
                              key={val}
                              type="button"
                              className="ghost"
                              style={{
                                width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, borderRadius: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: checked ? '#f0f5ff' : undefined,
                                fontWeight: checked ? 600 : 400,
                              }}
                              onClick={() => {
                                setActiveFilters(prev => {
                                  const cur = prev[key]
                                  const arr = cur == null ? [] : [...cur]
                                  const i = arr.indexOf(val)
                                  if (i >= 0) arr.splice(i, 1)
                                  else arr.push(val)
                                  return { ...prev, [key]: arr }
                                })
                              }}
                            >
                              <span>{val}</span>
                              {checked && (
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4"/></svg>
                              )}
                            </button>
                          )
                        })}
                        <div style={{ height: 4 }} />
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Add filter button + column picker dropdown */}
              {!FILTER_COLUMNS.every(col => col.key in activeFilters) && (
                <div style={{ position: 'relative' }}>
                  <button
                    className="filter-pill"
                    style={{ color: 'var(--text3)', borderStyle: 'dashed' }}
                    onClick={() => setFilterDropdownOpen(prev => prev ? null : '__pick__')}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginRight: 4 }}>
                      <path d="M5 2V8M2 5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Add filter
                  </button>
                  {filterDropdownOpen === '__pick__' && (
                    <div style={{
                      position: 'absolute', left: 0, top: '100%', marginTop: 6,
                      background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 170,
                      animation: 'selectSlideIn 0.15s ease-out', overflow: 'hidden',
                    }}>
                      <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Filter by
                      </div>
                      {FILTER_COLUMNS.filter(col => !(col.key in activeFilters)).map(col => (
                        <button
                          key={col.key}
                          className="ghost"
                          style={{ width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, borderRadius: 0 }}
                          onClick={() => { setActiveFilters(prev => ({ ...prev, [col.key]: col.values.length ? [col.values[0]] : [] })); setFilterDropdownOpen(null) }}
                        >
                          {col.label}
                        </button>
                      ))}
                      <div style={{ height: 4 }} />
                    </div>
                  )}
                </div>
              )}
              {/* Clear all */}
              {Object.keys(activeFilters).length > 1 && (
                <button
                  className="filter-pill"
                  style={{ color: '#ef4444', borderColor: '#fecaca' }}
                  onClick={() => { setActiveFilters({}); setFilterDropdownOpen(null) }}
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {showSamplePortfolioTip && !readOnly && (
          <div className="portfolio-sample-banner mb12" role="region" aria-label="Sample portfolio">
            <div className="portfolio-sample-banner-main">
              <IconSamplePortfolioTip />
              <p className="portfolio-sample-banner-text">
                You are seeing a sample portfolio of 5 properties. Delete properties and replace them with your own. To add a
                new property, click{' '}
                <button type="button" className="portfolio-sample-banner-inline-action" onClick={openAddProperty}>
                  + Add Property
                </button>
                .
              </p>
            </div>
            <button type="button" className="portfolio-sample-banner-cta" onClick={openAddProperty}>
              + Add Property
            </button>
          </div>
        )}

        <div className="sec-hdr mb12">
          <span className="sec-title">Properties</span>
          <div className="flex align-center gap8">
            <div className="flex gap4 align-center">
              <button type="button" className="year-chevron" onClick={() => setSelectedYear((y) => y - 1)}>‹</button>
              {yearWindow.map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`year-btn${selectedYear === y ? ' active' : ''}`}
                  onClick={() => setSelectedYear(y)}
                >
                  {y}
                </button>
              ))}
              <button type="button" className="year-chevron" onClick={() => setSelectedYear((y) => y + 1)}>›</button>
            </div>
            {showScrollBtns && propertiesLayoutView === 'list' && (
              <>
                <button type="button" className="scroll-arrow-btn" onClick={() => tableScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}>←</button>
                <button type="button" className="scroll-arrow-btn" onClick={() => tableScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}>→</button>
              </>
            )}
          </div>
        </div>
        <div className="card mb24" style={{ overflow: 'hidden' }}>
          {propertiesLayoutView === 'list' ? (
          <div className="prop-table-scroll" ref={tableScrollRef}>
            <table className="wf-table">
              <thead>
                <tr>
                  <SortTh col="name">Property</SortTh>
                  {colOrder.filter(k => colVis[k]).map(key => (
                    <SortTh key={key} col={key} className={key === 'country' ? 'wf-align-left' : undefined}>{COL_LABELS[key]}</SortTh>
                  ))}
                  <th className="wf-table-actions-col" style={{ width: 52, textAlign: 'center', padding: '8px 12px 8px 0' }}>
                    <button
                      className="ghost"
                      style={{ padding: 0, border: 'none', background: 'transparent', margin: '0 auto', display: 'block' }}
                      title={copied ? 'Copied!' : 'Copy table'}
                      onClick={handleCopy}
                    >
                      {copied ? <IconCheck /> : <IconCopy />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {properties.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + colOrder.filter(k => colVis[k]).length + 1}
                      style={{ verticalAlign: 'middle', borderBottom: 'none' }}
                    >
                      <div className="empty-state" style={{ padding: '32px 24px' }}>
                        <div className="empty-title">Add your first property</div>
                        <p style={{ fontSize: 13, margin: '8px 0 16px', color: 'var(--text3)' }}>
                          Your portfolio is empty. Create a property to see it in this table.
                        </p>
                        {!readOnly && (
                          <button type="button" className="primary" onClick={() => openAddProperty()}>
                            <span className="hide-mobile">+ Add Property</span>
                            <span className="show-mobile">+ Add</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : sortedProperties.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + colOrder.filter(k => colVis[k]).length + 1}
                      style={{ verticalAlign: 'middle', borderBottom: 'none' }}
                    >
                      <div className="empty-state" style={{ padding: '32px 24px' }}>
                        <div className="empty-title">No properties match your search or filters.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                <>
                {sortedProperties.map((p) => {
                  const a = convertAnnual(calcAnnual(withYear(p)), p.currency, displayCurrency, fxRates)
                  const gpiRow = convert(projectedGpiAnnual(withYear(p)), p.currency, displayCurrency, fxRates)
                  const ac = activeContract(p)
                  const countryCode = COUNTRIES.find(c => c.name === p.country)?.code
                  const cellMap: Record<ColKey, React.ReactNode> = {
                    owner: <td key="owner" className="text3 wf-col-owner"><div className="wf-truncate" title={p.owner || ''}>{p.owner || '—'}</div></td>,
                    country: (
                      <td key="country" className="text3 wf-align-left wf-col-country">
                        {p.country ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={p.country}>
                            {countryCode ? <img src={countryFlagUrl(countryCode, 40)} alt="" width={20} height={14} style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} /> : null}
                            {countryCode || p.country}
                          </span>
                        ) : '—'}
                      </td>
                    ),
                    status: <td key="status" className="wf-col-status"><span className={`badge ${ac ? 'active-c' : 'vacant'}`}>{ac ? 'Rented' : 'Vacant'}</span></td>,
                    nonLeaseOcc: (() => {
                      const ac = activeContract(p)
                      const occ = p.occupant
                      const hasOcc = hasNonLeaseOccupant(p)
                      const label = nonLeaseOccupancyLabel(p)
                      const tip = ac
                        ? [ac.tenant, ac.endDate ? `ends ${ac.endDate}` : ''].filter(Boolean).join(' · ')
                        : hasOcc
                          ? [occ?.name, occ?.relation, occ?.notes].filter(Boolean).join(' · ')
                          : undefined
                      const badgeCls = ac ? 'active-c' : hasOcc ? 'override' : 'vacant'
                      return (
                        <td key="nonLeaseOcc" className="wf-col-status">
                          <span className={`badge ${badgeCls}`} title={tip}>{label}</span>
                        </td>
                      )
                    })(),
                    endDate: (() => {
                      if (!ac) return <td key="endDate" className="text3">—</td>
                      const end = new Date(ac.endDate), now = new Date()
                      const months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth()
                      return <td key="endDate" className={months <= 3 ? 'neg' : months <= 6 ? '' : 'text3'} style={{ whiteSpace: 'nowrap' }}>{months <= 0 ? 'Expired' : `${months}m`}</td>
                    })(),
                    taxStatus: (() => {
                      const items = p.taxes?.items ?? [], pending = items.filter(t => t.status === 'pending')
                      if (items.length === 0) return <td key="taxStatus" className="text3">—</td>
                      if (pending.length === 0) return <td key="taxStatus"><span className="badge active-c">Paid</span></td>
                      const nearest = pending.reduce((x, b) => x.dueDate < b.dueDate ? x : b)
                      const daysLeft = Math.ceil((new Date(nearest.dueDate).getTime() - Date.now()) / 864e5)
                      return <td key="taxStatus"><span className="badge vacant">Due {daysLeft <= 0 ? 'overdue' : `${daysLeft}d`}</span></td>
                    })(),
                    propertyType: <td key="propertyType" className="text3">{p.factSheet?.propertyType || '—'}</td>,
                    bedrooms: <td key="bedrooms" className="text3">{p.bedrooms || '—'}</td>,
                    area: <td key="area" className="text3">{p.area ? `${p.area} m²` : '—'}</td>,
                    bathrooms: <td key="bathrooms" className="text3">{p.bathrooms || '—'}</td>,
                    parking: <td key="parking" className="text3">{p.parking || '—'}</td>,
                    floor: <td key="floor" className="text3">{p.factSheet?.floor ?? '—'}</td>,
                    estrato: <td key="estrato" className="text3">{p.factSheet?.estrato ?? '—'}</td>,
                    yearBuilt: <td key="yearBuilt" className="text3">{p.factSheet?.yearBuilt ?? '—'}</td>,
                    lastRenovation: <td key="lastRenovation" className="text3">{p.factSheet?.lastRenovation ?? '—'}</td>,
                    estValue: (() => {
                      const e = estimatedPropertyValueAtYear(withYear(p), selectedYear)
                      const conv = e.value != null ? convert(e.value, p.currency, displayCurrency, fxRates) : null
                      return (
                        <td key="estValue" className={conv != null ? 'purple' : 'text3'}>
                          {conv != null ? fm(conv) : '—'}
                        </td>
                      )
                    })(),
                    valueYoY: (() => {
                      const y = propertyValueYoYPct(withYear(p), selectedYear)
                      if (y == null || !Number.isFinite(y)) return <td key="valueYoY" className="text3">—</td>
                      const near = Math.abs(y) < 0.05
                      const shown = near ? '0' : Math.abs(y).toFixed(1)
                      const positive = y > 0 || near
                      return (
                        <td key="valueYoY" className={positive ? 'pos' : 'neg'}>
                          {positive ? '+' : '−'}{shown}%
                        </td>
                      )
                    })(),
                    ownedSince: (
                      <td key="ownedSince" className="text3" style={{ whiteSpace: 'nowrap' }}>
                        {formatOwnedSinceCell(p.factSheet?.purchaseDate)}
                      </td>
                    ),
                    debt: (() => {
                      const m = p.factSheet?.mortgage
                      if (!m?.hasMortgage || m.outstandingBalance == null) {
                        return <td key="debt" className="text3">—</td>
                      }
                      const conv = convert(m.outstandingBalance, p.currency, displayCurrency, fxRates)
                      return <td key="debt" className="neg">−{fm(conv)}</td>
                    })(),
                    mtgYearsLeft: (() => {
                      const y = mortgageYearsRemaining(p.factSheet?.mortgage?.endDate)
                      if (y == null) return <td key="mtgYearsLeft" className="text3">—</td>
                      return <td key="mtgYearsLeft">{y === 0 ? '0' : y}</td>
                    })(),
                    gpi: <td key="gpi">{fm(gpiRow)}</td>,
                    egi: <td key="egi" className="pos">{fm(a.egi)}</td>,
                    egiPerM2: (() => {
                      const ar = p.area
                      if (ar == null || ar <= 0) return <td key="egiPerM2" className="text3">—</td>
                      return (
                        <td key="egiPerM2" className="pos" title="Effective gross income (actual rent collected) for the selected year ÷ area">
                          {fm(a.egi / ar)}
                        </td>
                      )
                    })(),
                    vacancyMoRate: (() => {
                      const m = vacancyLossMonthCount(withYear(p))
                      const pct = (m / 12) * 100
                      return (
                        <td
                          key="vacancyMoRate"
                          className={pct > 0 ? 'text3' : undefined}
                          title={`${m} of 12 months with rent shortfall (gaps, vacant, or partial)`}
                        >
                          {`${pct.toFixed(1)}%`}
                        </td>
                      )
                    })(),
                    opex: <td key="opex" className="neg">−{fm(a.totalOpex)}</td>,
                    noi: <td key="noi" className={a.noi >= 0 ? 'pos' : 'neg'}>{fm(a.noi)}</td>,
                    noiPerM2: (() => {
                      const ar = p.area
                      if (ar == null || ar <= 0 || !Number.isFinite(a.noi)) return <td key="noiPerM2" className="text3">—</td>
                      const v = a.noi / ar
                      return (
                        <td key="noiPerM2" className={v >= 0 ? 'pos' : 'neg'} title="Net operating income for the selected year ÷ area">
                          {fm(v)}
                        </td>
                      )
                    })(),
                    valuePerM2: (() => {
                      const ar = p.area
                      if (ar == null || ar <= 0) return <td key="valuePerM2" className="text3">—</td>
                      const e = estimatedPropertyValueAtYear(withYear(p), selectedYear)
                      if (e.value == null || e.value <= 0) return <td key="valuePerM2" className="text3">—</td>
                      const v = convert(e.value, p.currency, displayCurrency, fxRates) / ar
                      return (
                        <td key="valuePerM2" className="purple" title="Estimated value for the selected year ÷ area">
                          {fm(v)}
                        </td>
                      )
                    })(),
                    capRate: (() => {
                      const cap = propertyCapRatePct(withYear(p), selectedYear, displayCurrency, fxRates, a)
                      if (cap == null || !Number.isFinite(cap)) {
                        return <td key="capRate" className="text3">—</td>
                      }
                      return (
                        <td
                          key="capRate"
                          className={cap < 0 ? 'neg' : 'purple'}
                          title="NOI ÷ estimated value for the selected year (display currency)"
                        >
                          {cap.toFixed(2)}%
                        </td>
                      )
                    })(),
                    capex: <td key="capex" className={a.totalCapex ? 'neg' : 'text3'}>{a.totalCapex ? `−${fm(a.totalCapex)}` : '—'}</td>,
                    yieldOnCapex: (() => {
                      if (!a.totalCapex || !Number.isFinite(a.noi)) return <td key="yieldOnCapex" className="text3">—</td>
                      const pct = (a.noi / a.totalCapex) * 100
                      return (
                        <td key="yieldOnCapex" className={pct >= 0 ? 'purple' : 'neg'} title="NOI ÷ CAPEX — return on capital expenditure">
                          {pct.toFixed(1)}%
                        </td>
                      )
                    })(),
                    payback: (() => {
                      if (!a.totalCapex || !Number.isFinite(a.noi) || a.noi <= 0) return <td key="payback" className="text3">—</td>
                      const yrs = a.totalCapex / a.noi
                      return (
                        <td key="payback" title="CAPEX ÷ NOI — years to recover capital expenditure from net income">
                          {yrs.toFixed(1)}
                        </td>
                      )
                    })(),
                    taxes: <td key="taxes" className={a.taxes ? 'neg' : 'text3'}>{a.taxes ? `−${fm(a.taxes)}` : '—'}</td>,
                    netCf: <td key="netCf" className={a.netCf >= 0 ? 'pos fw5' : 'neg fw5'}>{a.netCf >= 0 ? '+' : ''}{fm(a.netCf)}</td>,
                    margin: <td key="margin">{gpiRow ? `${Math.round((a.netCf / gpiRow) * 100)}%` : '—'}</td>,
                  }
                  return (
                    <tr key={p.id} onClick={() => onSelectProperty(p.id)} style={{ cursor: 'pointer' }}>
                      <td className="wf-col-name">
                        <div className="fw5 wf-truncate" title={p.name}>{p.name}</div>
                        <div className="fs11 text3 wf-truncate" title={p.address}>{p.address}</div>
                      </td>
                      {colOrder.filter(k => colVis[k]).map(key => cellMap[key])}
                      <td className="wf-table-actions-col" onClick={(e) => e.stopPropagation()} style={{ width: 52, padding: '8px 12px 8px 0', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {!readOnly && (
                            <RowMenu
                              onEdit={() => onSelectProperty(p.id)}
                              onDelete={() => setDeleteTarget(p)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {(() => {
                  const totalMap: Partial<Record<ColKey, React.ReactNode>> = {
                    estValue: <td key="estValue" className="purple">{valueEquityTotals.estValue > 0 ? fm(valueEquityTotals.estValue) : '—'}</td>,
                    valueYoY: <td key="valueYoY" />,
                    ownedSince: <td key="ownedSince" />,
                    debt: (
                      <td key="debt" className={valueEquityTotals.debt > 0 ? 'neg' : 'text3'}>
                        {valueEquityTotals.debt > 0 ? `−${fm(valueEquityTotals.debt)}` : '—'}
                      </td>
                    ),
                    mtgYearsLeft: <td key="mtgYearsLeft" />,
                    gpi: <td key="gpi">{fm(portfolioProjectedGpi)}</td>,
                    egi: <td key="egi">{fm(totals.egi)}</td>,
                    egiPerM2: (
                      <td key="egiPerM2" title="Sum of EGI ÷ sum of area (properties with area only)">
                        {portfolioPerM2Footer.egiPerM2 != null ? fm(portfolioPerM2Footer.egiPerM2) : '—'}
                      </td>
                    ),
                    vacancyMoRate: (
                      <td
                        key="vacancyMoRate"
                        title="Simple average of each property’s vacancy-month share for the selected year"
                      >
                        {portfolioAvgVacancyMoRatePct != null ? `${portfolioAvgVacancyMoRatePct.toFixed(1)}%` : '—'}
                      </td>
                    ),
                    opex: <td key="opex" className="neg">−{fm(totals.opex)}</td>,
                    noi: <td key="noi">{fm(totals.noi)}</td>,
                    noiPerM2: (
                      <td key="noiPerM2" title="Sum of NOI ÷ sum of area (properties with area only)">
                        {portfolioPerM2Footer.noiPerM2 != null ? fm(portfolioPerM2Footer.noiPerM2) : '—'}
                      </td>
                    ),
                    valuePerM2: (
                      <td key="valuePerM2" className="purple" title="Sum of estimated values ÷ sum of area (properties with area only)">
                        {portfolioPerM2Footer.valuePerM2 != null ? fm(portfolioPerM2Footer.valuePerM2) : '—'}
                      </td>
                    ),
                    capRate: (() => {
                      if (advancedKpis.capRate == null || !Number.isFinite(advancedKpis.capRate)) {
                        return <td key="capRate" className="text3">—</td>
                      }
                      const c = advancedKpis.capRate
                      return (
                        <td key="capRate" className={c < 0 ? 'neg' : 'purple'} title="Total NOI ÷ total estimated value">
                          {c.toFixed(2)}%
                        </td>
                      )
                    })(),
                    capex: <td key="capex">{totals.capex ? `−${fm(totals.capex)}` : '—'}</td>,
                    yieldOnCapex: (() => {
                      if (!totals.capex || !Number.isFinite(totals.noi)) return <td key="yieldOnCapex" className="text3">—</td>
                      const pct = (totals.noi / totals.capex) * 100
                      return (
                        <td key="yieldOnCapex" className={pct >= 0 ? 'purple' : 'neg'} title="Total NOI ÷ total CAPEX">
                          {pct.toFixed(1)}%
                        </td>
                      )
                    })(),
                    payback: (() => {
                      if (!totals.capex || !Number.isFinite(totals.noi) || totals.noi <= 0) return <td key="payback" className="text3">—</td>
                      const yrs = totals.capex / totals.noi
                      return (
                        <td key="payback" title="Total CAPEX ÷ total NOI">
                          {yrs.toFixed(1)}
                        </td>
                      )
                    })(),
                    taxes: <td key="taxes">{totals.taxes ? `−${fm(totals.taxes)}` : '—'}</td>,
                    netCf: <td key="netCf">{totals.net >= 0 ? '+' : ''}{fm(totals.net)}</td>,
                    margin: <td key="margin">{portfolioProjectedGpi ? `${Math.round((totals.net / portfolioProjectedGpi) * 100)}%` : '—'}</td>,
                  }
                  return (
                    <tr className="total-row">
                      <td>Total</td>
                      {colOrder.filter(k => colVis[k]).map(key => totalMap[key] || <td key={key} />)}
                      <td className="wf-table-actions-col" style={{ width: 52, padding: '8px 0' }} />
                    </tr>
                  )
                })()}
                </>
                )}
              </tbody>
            </table>
          </div>
          ) : propertiesLayoutView === 'todo' ? (() => {
            const visiblePanelCount = TODO_PANELS.filter(p => todoPanelVis[p.key]).length
            const feedRuleAlertCount =
              todoFeedBuckets.contractEnding.length +
              todoFeedBuckets.taxSeason.length +
              todoFeedBuckets.vacantProps.length
            return (
          <div className="todo-view-layout" style={{ gridTemplateColumns: `repeat(${visiblePanelCount}, 1fr)` }}>
            <div className="todo-feed-col">
              <div className="todo-feed-header">
                <span className="todo-feed-title">Feed</span>
                <span className="todo-feed-count">{sortedProperties.length} {sortedProperties.length === 1 ? 'property' : 'properties'}</span>
              </div>
              <div className="todo-payments-scorecards">
                <div className="todo-scorecard todo-scorecard--pending">
                  <span className="todo-scorecard-label">Alerts</span>
                  <span className="todo-scorecard-value">{feedRuleAlertCount}</span>
                </div>
                <div className="todo-scorecard todo-scorecard--received">
                  <span className="todo-scorecard-label">Starting</span>
                  <span className="todo-scorecard-value">{todoFeedBuckets.contractStarting.length}</span>
                </div>
              </div>
              <div className="todo-feed-list">
                {sortedProperties.length === 0 ? (
                  <div className="todo-feed-empty">
                    {properties.length === 0 ? (
                      <>
                        <div className="empty-title" style={{ marginBottom: 8 }}>Add your first property</div>
                        {!readOnly && (
                          <button type="button" className="primary" onClick={() => openAddProperty()}>
                            <span className="hide-mobile">+ Add Property</span>
                            <span className="show-mobile">+ Add</span>
                          </button>
                        )}
                      </>
                    ) : (
                      'No properties match your search or filters.'
                    )}
                  </div>
                ) : (
                  <>
                    <div className="todo-section-label">Contract starting · {todoFeedBuckets.contractStarting.length}</div>
                    {todoFeedBuckets.contractStarting.length === 0 ? (
                      <div className="todo-feed-empty" style={{ padding: '10px 0 14px' }}>
                        No negotiated lease starting in the next {FEED_CONTRACT_START_WINDOW_MO} months.
                      </div>
                    ) : (
                      todoFeedBuckets.contractStarting.map(({ property: p, contract: c, monthsUntilStart }) => (
                        <div
                          key={`feed-start-${p.id}-${c.id}`}
                          className="lb-alert-item lb-alert-info"
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectProperty(p.id)}
                          onKeyDown={e => e.key === 'Enter' && onSelectProperty(p.id)}
                        >
                          <div className="lb-alert-severity-bar" />
                          <div className="lb-alert-content">
                            <div className="lb-alert-name">{p.name}</div>
                            <div className="lb-alert-desc">{formatLeaseStartFeedDesc(c, monthsUntilStart)}</div>
                          </div>
                          <span className="lb-alert-badge lb-alert-badge-info">Starting</span>
                        </div>
                      ))
                    )}
                    <div className="todo-section-divider" />
                    <div className="todo-section-label">Contract ending · {todoFeedBuckets.contractEnding.length}</div>
                    {todoFeedBuckets.contractEnding.length === 0 ? (
                      <div className="todo-feed-empty" style={{ padding: '10px 0 14px' }}>No contract expiry alerts.</div>
                    ) : (
                      todoFeedBuckets.contractEnding.map(({ property: p, match: m }) => (
                        <div
                          key={`feed-end-${p.id}-${m.userRuleId}`}
                          className={`lb-alert-item lb-alert-${m.severity}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectProperty(p.id)}
                          onKeyDown={e => e.key === 'Enter' && onSelectProperty(p.id)}
                        >
                          <div className="lb-alert-severity-bar" />
                          <div className="lb-alert-content">
                            <div className="lb-alert-name">{p.name}</div>
                            <div className="lb-alert-desc">{m.describe}</div>
                          </div>
                          <span className={`lb-alert-badge lb-alert-badge-${m.severity}`}>{m.label}</span>
                        </div>
                      ))
                    )}
                    <div className="todo-section-divider" />
                    <div className="todo-section-label">Tax season · {todoFeedBuckets.taxSeason.length}</div>
                    {todoFeedBuckets.taxSeason.length === 0 ? (
                      <div className="todo-feed-empty" style={{ padding: '10px 0 14px' }}>No property tax alerts.</div>
                    ) : (
                      todoFeedBuckets.taxSeason.map(({ property: p, match: m }) => (
                        <div
                          key={`feed-tax-${p.id}-${m.userRuleId}`}
                          className={`lb-alert-item lb-alert-${m.severity}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectProperty(p.id)}
                          onKeyDown={e => e.key === 'Enter' && onSelectProperty(p.id)}
                        >
                          <div className="lb-alert-severity-bar" />
                          <div className="lb-alert-content">
                            <div className="lb-alert-name">{p.name}</div>
                            <div className="lb-alert-desc">{m.describe}</div>
                          </div>
                          <span className={`lb-alert-badge lb-alert-badge-${m.severity}`}>{m.label}</span>
                        </div>
                      ))
                    )}
                    <div className="todo-section-divider" />
                    <div className="todo-section-label">Vacant properties · {todoFeedBuckets.vacantProps.length}</div>
                    {todoFeedBuckets.vacantProps.length === 0 ? (
                      <div className="todo-feed-empty" style={{ padding: '10px 0 14px' }}>No vacant property alerts.</div>
                    ) : (
                      todoFeedBuckets.vacantProps.map(({ property: p, match: m }) => (
                        <div
                          key={`feed-vac-${p.id}-${m.userRuleId}`}
                          className={`lb-alert-item lb-alert-${m.severity}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectProperty(p.id)}
                          onKeyDown={e => e.key === 'Enter' && onSelectProperty(p.id)}
                        >
                          <div className="lb-alert-severity-bar" />
                          <div className="lb-alert-content">
                            <div className="lb-alert-name">{p.name}</div>
                            <div className="lb-alert-desc">{m.describe}</div>
                          </div>
                          <span className={`lb-alert-badge lb-alert-badge-${m.severity}`}>{m.label}</span>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
            {todoPanelVis.payments && (() => {
              const pendingPayments  = thisMonthPayments.filter(x => !x.received)
              const receivedPayments = thisMonthPayments.filter(x => x.received)
              const totalReceived = receivedPayments.reduce((sum, x) => sum + convert(x.rent, x.property.currency, displayCurrency, fxRates), 0)
              const totalPending  = pendingPayments.reduce((sum, x) => sum + convert(x.rent, x.property.currency, displayCurrency, fxRates), 0)
              return (
              <div className="todo-panel-col">
                <div className="todo-feed-header">
                  <span className="todo-feed-title">Payments</span>
                  <span className="todo-feed-count">{thisMonthPayments.length} {thisMonthPayments.length === 1 ? 'payment' : 'payments'} · {new Date().toLocaleString('default', { month: 'long' })}</span>
                </div>
                <div className="todo-payments-scorecards">
                  <div className="todo-scorecard todo-scorecard--received">
                    <span className="todo-scorecard-label">Received</span>
                    <span className="todo-scorecard-value">
                      <span className="todo-amount-code">{displayCurrency}</span>
                      {fm(totalReceived)}
                    </span>
                  </div>
                  <div className="todo-scorecard todo-scorecard--pending">
                    <span className="todo-scorecard-label">Pending</span>
                    <span className="todo-scorecard-value">
                      <span className="todo-amount-code">{displayCurrency}</span>
                      {fm(totalPending)}
                    </span>
                  </div>
                </div>
                <div className="todo-feed-list">
                  {thisMonthPayments.length === 0 ? (
                    <div className="todo-feed-empty">No rent payments due this month.</div>
                  ) : (
                    <>
                      <div className="todo-section-label">
                        Pending · {pendingPayments.length}
                      </div>
                      {pendingPayments.length === 0 ? (
                        <div className="todo-feed-empty">All payments received.</div>
                      ) : pendingPayments.map(({ property: p, rent, received, calYear, calMonth }) => (
                        <PaymentTodoCard
                          key={p.id}
                          propertyName={p.name}
                          rent={rent}
                          currency={p.currency}
                          rentInDisplay={p.currency !== displayCurrency ? fm(convert(rent, p.currency, displayCurrency, fxRates)) : null}
                          displayCurrency={displayCurrency}
                          received={received}
                          onToggle={() => handleToggleRentReceived(p.id, calYear, calMonth, received)}
                          onOpen={() => onSelectProperty(p.id)}
                        />
                      ))}
                      <div className="todo-section-divider" />
                      <div className="todo-section-label">
                        Received · {receivedPayments.length}
                      </div>
                      {receivedPayments.length === 0 ? (
                        <div className="todo-feed-empty">None yet.</div>
                      ) : receivedPayments.map(({ property: p, rent, received, calYear, calMonth }) => (
                        <PaymentTodoCard
                          key={p.id}
                          propertyName={p.name}
                          rent={rent}
                          currency={p.currency}
                          rentInDisplay={p.currency !== displayCurrency ? fm(convert(rent, p.currency, displayCurrency, fxRates)) : null}
                          displayCurrency={displayCurrency}
                          received={received}
                          onToggle={() => handleToggleRentReceived(p.id, calYear, calMonth, received)}
                          onOpen={() => onSelectProperty(p.id)}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
              )
            })()}
            {todoPanelVis.overdue && (() => {
              const totalOverdue = overduePayments.reduce((s, x) => s + convert(x.totalRent, x.property.currency, displayCurrency, fxRates), 0)
              const totalMonths = overduePayments.reduce((s, x) => s + x.overdueMonths.length, 0)
              return (
              <div className="todo-panel-col">
                <div className="todo-feed-header">
                  <span className="todo-feed-title">Overdue</span>
                  <span className="todo-feed-count">{overduePayments.length} {overduePayments.length === 1 ? 'property' : 'properties'} · {totalMonths} {totalMonths === 1 ? 'month' : 'months'}</span>
                </div>
                <div className="todo-payments-scorecards">
                  <div className="todo-scorecard todo-scorecard--overdue">
                    <span className="todo-scorecard-label">Overdue</span>
                    <span className="todo-scorecard-value">
                      <span className="todo-amount-code">{displayCurrency}</span>
                      {fm(totalOverdue)}
                    </span>
                  </div>
                  <div className="todo-scorecard">
                    <span className="todo-scorecard-label">Months</span>
                    <span className="todo-scorecard-value">{totalMonths}</span>
                  </div>
                </div>
                <div className="todo-feed-list">
                  {overduePayments.length === 0 ? (
                    <div className="todo-feed-empty">No overdue payments.</div>
                  ) : overduePayments.map(({ property: p, overdueMonths, totalRent }) => (
                    <PaymentTodoCard
                      key={p.id}
                      propertyName={p.name}
                      rent={totalRent}
                      currency={p.currency}
                      rentInDisplay={p.currency !== displayCurrency ? fm(convert(totalRent, p.currency, displayCurrency, fxRates)) : null}
                      displayCurrency={displayCurrency}
                      received={false}
                      overdueCount={overdueMonths.length}
                      onToggle={undefined}
                      onOpen={() => onSelectProperty(p.id)}
                    />
                  ))}
                </div>
              </div>
              )
            })()}
            {todoPanelVis.maintenance && (() => {
              const totalOngoingAmt = mOngoing.reduce((s, c) => s + c.amount, 0)
              return (
              <div className="todo-panel-col">
                <div className="todo-feed-header">
                  <span className="todo-feed-title">Maintenance & Works</span>
                  <span className="todo-feed-count">{maintenanceItems.length} {maintenanceItems.length === 1 ? 'item' : 'items'} · {new Date().getFullYear()}</span>
                </div>
                <div className="todo-payments-scorecards">
                  <div className="todo-scorecard todo-scorecard--pending">
                    <span className="todo-scorecard-label">Ongoing</span>
                    <span className="todo-scorecard-value">{mOngoing.length}</span>
                  </div>
                  <div className="todo-scorecard todo-scorecard--received">
                    <span className="todo-scorecard-label">Completed</span>
                    <span className="todo-scorecard-value">{mCompleted.length}</span>
                  </div>
                </div>
                <div className="todo-feed-list">
                  <div className="todo-section-label">To Do · {mTodo.length}</div>
                  {mTodo.length === 0 ? (
                    <div className="todo-feed-empty">No tasks.</div>
                  ) : mTodo.map(c => (
                    <CapexTodoCard
                      key={`${c.propertyId}-${c.id}`}
                      item={c}
                      onStatusChange={next => handleCapexStatus(c.propertyId, c.id, next)}
                      onOpen={() => onSelectProperty(c.propertyId)}
                    />
                  ))}
                  <div className="todo-section-divider" />
                  <div className="todo-section-label">Ongoing · {mOngoing.length}{totalOngoingAmt > 0 ? ` · ${totalOngoingAmt.toLocaleString()}` : ''}</div>
                  {mOngoing.length === 0 ? (
                    <div className="todo-feed-empty">No ongoing works.</div>
                  ) : mOngoing.map(c => (
                    <CapexTodoCard
                      key={`${c.propertyId}-${c.id}`}
                      item={c}
                      onStatusChange={next => handleCapexStatus(c.propertyId, c.id, next)}
                      onOpen={() => onSelectProperty(c.propertyId)}
                    />
                  ))}
                  <div className="todo-section-divider" />
                  <div className="todo-section-label">Completed · {mCompleted.length}</div>
                  {mCompleted.length === 0 ? (
                    <div className="todo-feed-empty">None yet.</div>
                  ) : mCompleted.map(c => (
                    <CapexTodoCard
                      key={`${c.propertyId}-${c.id}`}
                      item={c}
                      onStatusChange={next => handleCapexStatus(c.propertyId, c.id, next)}
                      onOpen={() => onSelectProperty(c.propertyId)}
                    />
                  ))}
                </div>
              </div>
              )
            })()}
          </div>
          )})() : (
          <div className="portfolio-props-grid" role="list" aria-label="Properties">
            {sortedProperties.length === 0 ? (
              <div className="portfolio-props-grid-empty">
                {properties.length === 0 ? (
                  <>
                    <div className="empty-title" style={{ marginBottom: 8 }}>Add your first property</div>
                    {!readOnly && (
                      <button type="button" className="primary" onClick={() => openAddProperty()}>
                        <span className="hide-mobile">+ Add Property</span>
                        <span className="show-mobile">+ Add</span>
                      </button>
                    )}
                  </>
                ) : (
                  'No properties match your search or filters.'
                )}
              </div>
            ) : (
              sortedProperties.map((p) => (
                <div key={p.id} className="portfolio-prop-grid-cell" role="listitem">
                  <PortfolioPropertyGridCard
                    property={p}
                    year={selectedYear}
                    displayCurrency={displayCurrency}
                    fxRates={fxRates}
                    formatMoney={fm}
                    activeCardMetrics={activeCardMetricKeys}
                    onOpen={onSelectProperty}
                  />
                </div>
              ))
            )}
          </div>
          )}
        </div>

        <PropertyLeaderboardMap
          properties={filteredProperties.map(withYear)}
          annuals={annualsMap}
          onSelectProperty={onSelectProperty}
          activeContractMap={activeContractMap}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
        />
        <AssetValueAppreciationCard
          properties={filteredProperties}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
        />
        <SharedWithMeSection />
      </div>
      {deleteTarget && (
        <ConfirmDialog
          title="Delete property"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => { removeProperty(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {openToolModal != null && createPortal(
        <div className="modal-overlay" onClick={closeToolModal}>
          <div
            className={`modal${toolModalMaximized ? ' portfolio-tool-modal-max' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-tool-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="portfolio-tool-modal-title-row">
                  <div className="portfolio-tool-modal-title-icon-wrap">
                    <span
                      className="portfolio-tool-modal-title-icon"
                      style={{
                        WebkitMaskImage: `url(${PORTFOLIO_TOOL_ICONS[openToolModal]})`,
                        maskImage: `url(${PORTFOLIO_TOOL_ICONS[openToolModal]})`,
                      }}
                      aria-hidden
                    />
                  </div>
                  <div className="portfolio-tool-modal-title-text">
                    <div className="modal-title" id="portfolio-tool-modal-title">
                      {PORTFOLIO_TOOL_LABELS[openToolModal]}
                    </div>
                    <div className="modal-sub">{openToolModal === 0 ? 'Portfolio Performance Report' : 'Placeholder'}</div>
                  </div>
                </div>
              </div>
              <div className="portfolio-tool-modal-header-actions">
                <button
                  type="button"
                  className="filter-bar-icon-btn"
                  title={toolModalMaximized ? 'Restore' : 'Maximize'}
                  aria-label={toolModalMaximized ? 'Restore window' : 'Maximize window'}
                  onClick={(e) => {
                    e.stopPropagation()
                    setToolModalMaximized((v) => !v)
                  }}
                >
                  {toolModalMaximized ? <IconWindowRestore /> : <IconWindowMaximize />}
                </button>
                <button
                  type="button"
                  className="ghost"
                  style={{ padding: '4px 10px', fontSize: 22, lineHeight: 1, color: 'var(--text3)' }}
                  onClick={closeToolModal}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ minHeight: 100, paddingTop: openToolModal === 0 ? 0 : undefined }}>
              {openToolModal === 0 ? (
                <AIAnalysisToolContent
                  allProperties={properties}
                  initialFilters={activeFilters}
                  year={selectedYear}
                  displayCurrency={displayCurrency}
                  fxRates={fxRates}
                  step={reportStep}
                  onStep={setReportStep}
                  onBack={() => { setReportStep(null); setToolModalMaximized(false) }}
                  onMaximize={() => setToolModalMaximized(true)}
                  onPaywall={() => { if (!canUseAi) { setAiUpgradeOpen(true); return true } return false }}
                />
              ) : openToolModal === 1 ? (
                <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>
                  New tool in progress
                </p>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>
                  Tool content placeholder — connect UI here (see Temp/FundingRatioCalculator.jsx for a full goals table + breakdown).
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {aiUpgradeOpen && (
        <UpgradeModal reason="ai-limit" onClose={() => setAiUpgradeOpen(false)} />
      )}
    </div>
  )
}
