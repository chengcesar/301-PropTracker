import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Contract, Property } from '../lib/types'
import { activeContract, calcAnnual, calcPortfolioTotalsIn, convertAnnual } from '../lib/finance'
import { fmtCurrencyM } from '../lib/format'
import { type CurrencyCode, type FxRates, CURRENCIES, CURRENCY_LIST, loadFxRates, saveFxRates, flagUrl } from '../lib/currency'
import { useAppState } from '../context/useAppState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { YEAR_OPTIONS } from '../lib/constants'
import { KpiInfoIcon } from '../components/KpiInfoIcon'
import { COUNTRIES, countryFlagUrl } from '../lib/countries'
import { PropertyLeaderboardMap } from '../components/PropertyLeaderboardMap'

type Props = {
  properties: Property[]
  onSelectProperty: (id: number) => void
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
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#3B82F6" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"><path d="M2.666 5.083h10.667"/><path d="M5.334 8.75h5.333"/><path d="M7.334 12.417h1.333"/></svg>
)
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
)
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4B5563" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.75v8"/><path d="M5.5 8.417L8 10.75l2.5-2.333"/><path d="M2.833 10.75v2.667a1.333 1.333 0 001.334 1.333h7.666a1.333 1.333 0 001.334-1.333V10.75"/></svg>
)
const IconSpreadsheet = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M.52 0A.525.525 0 000 .525v13.347c0 .29.235.525.52.525h14.96a.525.525 0 00.52-.525V.525A.525.525 0 0015.48 0H.52zm.53 1.05h4.55v2.287H1.05V1.05zm5.6 0h8.3v2.287h-8.3V1.05zM1.05 4.387h4.55V6.675H1.05V4.387zm5.6 0h8.3V6.675h-8.3V4.387zM1.05 7.724h4.55v2.286H1.05V7.724zm5.6 0h8.3v2.286h-8.3V7.724zM1.05 11.062h4.55v2.286H1.05v-2.286zm5.6 0h8.3v2.286h-8.3v-2.286z" fill="#4B5563"/></svg>
)

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

function KpiPctOfEgiDelta({ pct, kind }: { pct: number | null; kind: 'egi100' | 'opex' | 'noi' | 'taxes' | 'net' }) {
  if (kind === 'egi100') {
    if (pct === null || !Number.isFinite(pct) || pct <= 0) return null
    return (
      <div className="kpi-delta-pill kpi-delta-pill--up" title="Total EGI ÷ total EGI = 100% (baseline for % of EGI)">
        <IconDeltaUp />
        <span>100%</span>
      </div>
    )
  }

  if (pct === null || !Number.isFinite(pct)) return null

  if (kind === 'net') {
    const nearZero = Math.abs(pct) < 0.05
    const shown = nearZero ? '0' : Math.abs(pct).toFixed(1)
    const positive = pct > 0 || nearZero
    return positive ? (
      <div className="kpi-delta-pill kpi-delta-pill--up" title="Net cashflow as % of total EGI">
        <IconDeltaUp />
        <span>{shown}%</span>
      </div>
    ) : (
      <div className="kpi-delta-pill kpi-delta-pill--down" title="Net cashflow as % of total EGI">
        <IconDeltaDown />
        <span>−{shown}%</span>
      </div>
    )
  }

  const shown = Math.abs(pct) < 0.05 ? '0' : pct.toFixed(1)

  if (kind === 'noi') {
    return (
      <div className="kpi-delta-pill kpi-delta-pill--up" title="NOI as % of total EGI">
        <IconDeltaUp />
        <span>{shown}%</span>
      </div>
    )
  }

  const expenseTitle = kind === 'opex' ? 'OPEX (−) as % of total EGI' : 'Taxes (−) as % of total EGI'
  return (
    <div className="kpi-delta-pill kpi-delta-pill--down" title={expenseTitle}>
      <IconDeltaDown />
      <span>−{shown}%</span>
    </div>
  )
}

const KPI_KEYS = ['gpi', 'egi', 'opex', 'noi', 'capex', 'taxes', 'net'] as const
type KpiKey = typeof KPI_KEYS[number]
const KPI_META: Record<KpiKey, { label: string; cls?: string; negPrefix?: boolean; tip: string }> = {
  gpi: { label: 'Total GPI', tip: 'Gross Potential Income — total rent if fully occupied' },
  egi: { label: 'Total EGI', cls: 'green', tip: 'Effective Gross Income — actual rent collected' },
  opex: { label: 'Total OPEX', cls: 'red', negPrefix: true, tip: 'Operating expenses — admin, maintenance, insurance, etc.' },
  noi: { label: 'Total NOI', cls: 'purple', tip: 'Net Operating Income — income minus operating expenses' },
  capex: { label: 'Total CAPEX', cls: 'red', negPrefix: true, tip: 'Capital Expenditures — major repairs & improvements' },
  taxes: { label: 'Total Taxes', cls: 'red', negPrefix: true, tip: 'Annual property and income taxes' },
  net: { label: 'Net cashflow', cls: 'green', tip: 'Final cashflow after all income and expenses' },
}

const COL_KEYS = [
  'owner', 'country', 'status', 'endDate', 'taxStatus',
  'propertyType', 'bedrooms', 'area', 'bathrooms', 'parking', 'floor', 'estrato', 'yearBuilt', 'lastRenovation',
  'gpi', 'egi', 'opex', 'noi', 'capex', 'taxes', 'netCf', 'margin',
] as const
type ColKey = typeof COL_KEYS[number]
const COL_LABELS: Record<ColKey, string> = {
  owner: 'Owner', country: 'Country', status: 'Status', endDate: 'Months Left', taxStatus: 'Tax Status',
  propertyType: 'Type', bedrooms: 'Beds', area: 'Area', bathrooms: 'Baths', parking: 'Parking',
  floor: 'Floor', estrato: 'Estrato', yearBuilt: 'Year Built', lastRenovation: 'Renovation',
  gpi: 'GPI', egi: 'EGI', opex: 'OPEX', noi: 'NOI',
  capex: 'CAPEX', taxes: 'Taxes', netCf: 'Net CF', margin: 'Margin',
}
const DETAIL_COLS: ColKey[] = ['propertyType', 'bedrooms', 'area', 'bathrooms', 'parking', 'floor', 'estrato', 'yearBuilt', 'lastRenovation']
type ColGroup = 'financial' | 'characteristics' | 'all' | 'custom0' | 'custom1' | 'custom2'
const COL_GROUPS: Record<'financial' | 'characteristics', ColKey[]> = {
  financial: ['gpi', 'egi', 'opex', 'noi', 'capex', 'taxes', 'netCf', 'margin'],
  characteristics: ['owner', 'country', 'status', 'endDate', 'taxStatus', ...DETAIL_COLS],
}
const CUSTOM_SLOTS = ['custom0', 'custom1', 'custom2'] as const
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
const COL_STORAGE_KEY = 'col-visibility'
function loadColVisibility(): Record<ColKey, boolean> {
  const defaults = Object.fromEntries(COL_KEYS.map(k => [k, !DETAIL_COLS.includes(k)])) as Record<ColKey, boolean>
  try {
    const raw = localStorage.getItem(COL_STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {}
  return defaults
}

const STORAGE_KEY = 'kpi-visibility'
function loadKpiVisibility(): Record<KpiKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return Object.fromEntries(KPI_KEYS.map(k => [k, true])) as Record<KpiKey, boolean>
}

const IconEye = ({ visible }: { visible: boolean }) => (
  visible ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1.5 9C1.5 9 3.75 3.75 9 3.75C14.25 3.75 16.5 9 16.5 9C16.5 9 14.25 14.25 9 14.25C3.75 14.25 1.5 9 1.5 9Z" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7.58 7.58a2.003 2.003 0 002.84 2.84M13.36 13.36C12.12 14.27 10.62 14.78 9 14.75c-5.25 0-7.5-5.25-7.5-5.25a13.16 13.16 0 013.64-4.11m2.91-1.16A5.7 5.7 0 019 4c5.25 0 7.5 5.25 7.5 5.25a13.24 13.24 0 01-1.47 2.15M1.5 1.5l15 15" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )
)

const FILTER_STORAGE_KEY = 'portfolio-filters'
function loadSavedFilters() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, unknown>
  } catch {}
  return {} as Record<string, unknown>
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

  const selected = CURRENCIES[value]
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

export function PortfolioPage({ properties, onSelectProperty }: Props) {
  const _saved = useMemo(loadSavedFilters, [])
  const [selectedYear, setSelectedYear] = useState(() => (typeof _saved.selectedYear === 'number' ? _saved.selectedYear : new Date().getFullYear()))
  const withYear = (p: Property): Property => ({ ...p, year: selectedYear })
  const { setAddPropertyOpen, removeProperty } = useAppState()
  const [fxRates, setFxRates] = useState<FxRates>(loadFxRates)
  const [fxOpen, setFxOpen] = useState(false)
  const fxRef = useRef<HTMLDivElement>(null)
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>((_saved.displayCurrency as CurrencyCode) || 'USD')
  const fm = (n: number | null | undefined) => fmtCurrencyM(n, displayCurrency)
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null)
  const [copied, setCopied] = useState(false)
  const [kpiVis, setKpiVis] = useState(loadKpiVisibility)
  const [kpiMenuOpen, setKpiMenuOpen] = useState(false)
  const kpiMenuRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [showScrollBtns, setShowScrollBtns] = useState(false)
  const [searchQuery, setSearchQuery] = useState((typeof _saved.searchQuery === 'string' ? _saved.searchQuery : ''))
  const [activeFilters, setActiveFilters] = useState<Record<string, string | null>>((_saved.activeFilters && typeof _saved.activeFilters === 'object') ? _saved.activeFilters as Record<string, string | null> : {})
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<string | null>(null)
  // null = closed, '__pick__' = picking column, column key = value picker open on that chip
  const filterBarRef = useRef<HTMLDivElement>(null)
  const [colVis, setColVis] = useState(loadColVisibility)
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [colGroupTab, setColGroupTab] = useState<ColGroup>('financial')
  const [customPresets, setCustomPresets] = useState(loadCustomPresets)
  const [renamingSlot, setRenamingSlot] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const colMenuRef = useRef<HTMLDivElement>(null)

  // Sort state
  type SortKey = 'name' | ColKey
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<SortKey | null>((_saved.sortKey as SortKey) || null)
  const [sortDir, setSortDir] = useState<SortDir>((_saved.sortDir as SortDir) || 'asc')
  // Persist filter state to localStorage
  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      searchQuery, activeFilters, sortKey, sortDir, selectedYear, displayCurrency,
    }))
  }, [searchQuery, activeFilters, sortKey, sortDir, selectedYear, displayCurrency])

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
    const cols: { key: string; label: string; values: string[] }[] = [
      { key: 'status', label: 'Status', values: statusValues },
    ]
    if (owners.length > 1) cols.push({ key: 'owner', label: 'Owner', values: owners })
    if (countries.length > 1) cols.push({ key: 'country', label: 'Country', values: countries })
    if (cities.length > 1) cols.push({ key: 'city', label: 'City', values: cities })
    if (neighbourhoods.length > 1) cols.push({ key: 'neighbourhood', label: 'Neighbourhood', values: neighbourhoods })
    return cols
  }, [properties])

  const filteredProperties = useMemo(() => {
    let result = properties
    for (const [key, value] of Object.entries(activeFilters)) {
      if (!value) continue
      if (key === 'status') {
        if (value === 'Rented') result = result.filter(p => activeContract(p) !== null)
        else if (value === 'Vacant') result = result.filter(p => activeContract(p) === null)
      } else {
        result = result.filter(p => (p as any)[key] === value)
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
      else {
        const aa = convertAnnual(calcAnnual(withYear(a)), a.currency, displayCurrency, fxRates)
        const ab = convertAnnual(calcAnnual(withYear(b)), b.currency, displayCurrency, fxRates)
        if (sortKey === 'gpi') { va = aa.gpi; vb = ab.gpi }
        else if (sortKey === 'egi') { va = aa.egi; vb = ab.egi }
        else if (sortKey === 'opex') { va = aa.totalOpex; vb = ab.totalOpex }
        else if (sortKey === 'noi') { va = aa.noi; vb = ab.noi }
        else if (sortKey === 'capex') { va = aa.totalCapex ?? 0; vb = ab.totalCapex ?? 0 }
        else if (sortKey === 'taxes') { va = aa.taxes ?? 0; vb = ab.taxes ?? 0 }
        else if (sortKey === 'netCf') { va = aa.netCf; vb = ab.netCf }
        else if (sortKey === 'margin') { va = aa.gpi ? (aa.netCf / aa.gpi) : 0; vb = ab.gpi ? (ab.netCf / ab.gpi) : 0 }
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProperties, sortKey, sortDir, displayCurrency, fxRates, selectedYear])

  const totals = calcPortfolioTotalsIn(filteredProperties.map(withYear), displayCurrency, fxRates)

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

  const egiRatioRow = useMemo(() => {
    const e = totals.egi
    if (!e || !Number.isFinite(e)) {
      return {
        opexPct: null as number | null,
        noiPct: null as number | null,
        taxesPct: null as number | null,
        netPct: null as number | null,
      }
    }
    return {
      opexPct: (totals.opex / e) * 100,
      noiPct: (totals.noi / e) * 100,
      taxesPct: (totals.taxes / e) * 100,
      netPct: (totals.net / e) * 100,
    }
  }, [totals.egi, totals.opex, totals.noi, totals.taxes, totals.net])

  useEffect(() => {
    const el = tableScrollRef.current
    if (!el) return
    const check = () => setShowScrollBtns(el.scrollWidth > el.clientWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [properties])

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

  function toggleCol(key: ColKey) {
    setColVis(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function saveCustomPreset(slot: number, name: string) {
    const visibleCols = COL_KEYS.filter(k => colVis[k]) as ColKey[]
    const next = [...customPresets] as (CustomPreset | null)[]
    next[slot] = { name, cols: visibleCols }
    setCustomPresets(next)
    saveCustomPresets(next)
    setColGroupTab(CUSTOM_SLOTS[slot])
  }

  function applyCustomPreset(slot: number) {
    const preset = customPresets[slot]
    if (!preset) return
    const next = Object.fromEntries(COL_KEYS.map(k => [k, preset.cols.includes(k)])) as Record<ColKey, boolean>
    setColVis(next)
    localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next))
  }

  function deleteCustomPreset(slot: number) {
    const next = [...customPresets] as (CustomPreset | null)[]
    next[slot] = null
    setCustomPresets(next)
    saveCustomPresets(next)
    if (colGroupTab === CUSTOM_SLOTS[slot]) setColGroupTab('financial')
  }

  function toggleKpi(key: KpiKey) {
    setKpiVis(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const visibleKpis = KPI_KEYS.filter(k => kpiVis[k])

  function handleDownloadCsv() {
    const dc = displayCurrency
    const headers = ['Property', 'Owner', 'Country', 'Status', 'Tax Status', 'Type', 'Beds', 'Area (m²)', 'Baths', 'Parking', 'Floor', 'Estrato', 'Year Built', 'Renovation', `GPI (${dc})`, `EGI (${dc})`, `OPEX (${dc})`, `NOI (${dc})`, `CAPEX (${dc})`, `Taxes (${dc})`, `Net CF (${dc})`, 'Margin']
    const rows = filteredProperties.map((p) => {
      const a = convertAnnual(calcAnnual(withYear(p)), p.currency, dc, fxRates)
      const ac = activeContract(p)
      const pending = (p.taxes?.items ?? []).filter(t => t.status === 'pending')
      return [
        `"${p.name}"`,
        `"${p.owner || ''}"`,
        `"${p.country || ''}"`,
        ac ? 'Rented' : 'Vacant',
        pending.length > 0 ? 'Pending' : 'Paid',
        `"${p.factSheet?.propertyType || ''}"`,
        p.bedrooms || '', p.area || '', p.bathrooms || '', p.parking || '',
        p.factSheet?.floor ?? '', p.factSheet?.estrato ?? '',
        p.factSheet?.yearBuilt ?? '', p.factSheet?.lastRenovation ?? '',
        a.gpi, a.egi, a.totalOpex, a.noi,
        a.totalCapex || '', a.taxes || '', a.netCf,
        a.gpi ? `${Math.round((a.netCf / a.gpi) * 100)}%` : '',
      ].join(',')
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
    const raw = (n: number | null | undefined) => n != null ? String(Math.round(n * 100) / 100) : ''
    const colDefs: { key: ColKey | 'name'; label: string; value: (p: Property, a: ReturnType<typeof convertAnnual>, ac: Contract | null) => string }[] = [
      { key: 'name', label: 'Property', value: (p) => p.name },
      { key: 'owner', label: 'Owner', value: (p) => p.owner || '' },
      { key: 'country', label: 'Country', value: (p) => p.country || '' },
      { key: 'status', label: 'Status', value: (_p, _a, ac) => ac ? 'Rented' : 'Vacant' },
      { key: 'endDate', label: 'Months Left', value: (_p, _a, ac) => {
        if (!ac) return ''
        const end = new Date(ac.endDate), now = new Date()
        const months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth()
        return String(months)
      }},
      { key: 'propertyType', label: 'Type', value: (p) => p.factSheet?.propertyType || '' },
      { key: 'bedrooms', label: 'Beds', value: (p) => p.bedrooms ? String(p.bedrooms) : '' },
      { key: 'area', label: 'Area (m²)', value: (p) => p.area ? String(p.area) : '' },
      { key: 'bathrooms', label: 'Baths', value: (p) => p.bathrooms ? String(p.bathrooms) : '' },
      { key: 'parking', label: 'Parking', value: (p) => p.parking ? String(p.parking) : '' },
      { key: 'floor', label: 'Floor', value: (p) => p.factSheet?.floor != null ? String(p.factSheet.floor) : '' },
      { key: 'estrato', label: 'Estrato', value: (p) => p.factSheet?.estrato != null ? String(p.factSheet.estrato) : '' },
      { key: 'yearBuilt', label: 'Year Built', value: (p) => p.factSheet?.yearBuilt != null ? String(p.factSheet.yearBuilt) : '' },
      { key: 'lastRenovation', label: 'Renovation', value: (p) => p.factSheet?.lastRenovation != null ? String(p.factSheet.lastRenovation) : '' },
      { key: 'gpi', label: `GPI (${dc})`, value: (_p, a) => raw(a.gpi) },
      { key: 'egi', label: `EGI (${dc})`, value: (_p, a) => raw(a.egi) },
      { key: 'opex', label: `OPEX (${dc})`, value: (_p, a) => raw(-a.totalOpex) },
      { key: 'noi', label: `NOI (${dc})`, value: (_p, a) => raw(a.noi) },
      { key: 'capex', label: `CAPEX (${dc})`, value: (_p, a) => raw(a.totalCapex ? -a.totalCapex : 0) },
      { key: 'taxes', label: `Taxes (${dc})`, value: (_p, a) => raw(a.taxes ? -a.taxes : 0) },
      { key: 'netCf', label: `Net CF (${dc})`, value: (_p, a) => raw(a.netCf) },
      { key: 'margin', label: 'Margin', value: (_p, a) => a.gpi ? String(Math.round((a.netCf / a.gpi) * 100)) : '' },
    ]
    const visible = colDefs.filter(c => c.key === 'name' || colVis[c.key as ColKey])
    const headers = visible.map(c => c.label)
    const rows = filteredProperties.map((p) => {
      const a = convertAnnual(calcAnnual(withYear(p)), p.currency, dc, fxRates)
      const ac = activeContract(p)
      return visible.map(c => c.value(p, a, ac)).join('\t')
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
            <button className="primary" onClick={() => setAddPropertyOpen(true)}><span className="hide-mobile">+ Add Property</span><span className="show-mobile">+ Add</span></button>
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
                  <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Visible in dashboard
                  </div>
                  {KPI_KEYS.filter(k => kpiVis[k]).map(key => (
                    <button
                      key={key}
                      className="ghost"
                      style={{ width: '100%', textAlign: 'left', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0 }}
                      onClick={() => toggleKpi(key)}
                    >
                      <span style={{ fontSize: 13 }}>{KPI_META[key].label}</span>
                      <IconEye visible={true} />
                    </button>
                  ))}
                  {KPI_KEYS.some(k => !kpiVis[k]) && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Hidden
                      </div>
                      {KPI_KEYS.filter(k => !kpiVis[k]).map(key => (
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
                  <div style={{ height: 6 }} />
                </div>
              )}
            </div>
          </div>
        </div>
        {visibleKpis.length > 0 && (
          <div className="kpi-row mb24">
            {visibleKpis.map(key => (
              <div className="kpi-card" key={key}>
                <div className="kpi-label">{KPI_META[key].label} <KpiInfoIcon tip={KPI_META[key].tip} /></div>
                <div className={`kpi-value ${KPI_META[key].cls || ''}`}>
                  {KPI_META[key].negPrefix && totals[key] ? '−' : ''}
                  {fm(totals[key])}
                </div>
                {key === 'egi' && <KpiPctOfEgiDelta pct={totals.egi} kind="egi100" />}
                {key === 'opex' && <KpiPctOfEgiDelta pct={egiRatioRow.opexPct} kind="opex" />}
                {key === 'noi' && <KpiPctOfEgiDelta pct={egiRatioRow.noiPct} kind="noi" />}
                {key === 'taxes' && <KpiPctOfEgiDelta pct={egiRatioRow.taxesPct} kind="taxes" />}
                {key === 'net' && <KpiPctOfEgiDelta pct={egiRatioRow.netPct} kind="net" />}
              </div>
            ))}
          </div>
        )}
        {/* Filter bar */}
        <div className="filter-bar mb24" ref={filterBarRef}>
          <div className="filter-bar-top">
            <button
              className={`filter-bar-icon-btn${Object.keys(activeFilters).length > 0 ? ' active' : ''}`}
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
              <div ref={colMenuRef} style={{ position: 'relative' }}>
                <button className={`filter-bar-icon-btn${colMenuOpen ? ' active' : ''}`} title="Column visibility" onClick={() => setColMenuOpen(v => !v)}>
                  <IconSpreadsheet />
                </button>
                {colMenuOpen && (() => {
                  const customIdx = CUSTOM_SLOTS.indexOf(colGroupTab as typeof CUSTOM_SLOTS[number])
                  const isCustomTab = customIdx !== -1
                  const activePreset = isCustomTab ? customPresets[customIdx] : null
                  const shownKeys: ColKey[] = colGroupTab === 'all'
                    ? [...COL_KEYS]
                    : isCustomTab
                      ? (activePreset ? activePreset.cols : [...COL_KEYS])
                      : COL_GROUPS[colGroupTab as 'financial' | 'characteristics']
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
                    {/* Built-in tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                      {(['financial', 'characteristics', 'all'] as const).map(tab => (
                        <button
                          key={tab}
                          className="ghost"
                          onClick={() => { setColGroupTab(tab); setRenamingSlot(null) }}
                          style={{
                            flex: 1, padding: '9px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.5px', borderRadius: 0, textAlign: 'center',
                            color: colGroupTab === tab ? '#3b82f6' : 'var(--text3)',
                            boxShadow: colGroupTab === tab ? 'inset 0 -2px 0 #3b82f6' : 'none',
                          }}
                        >
                          {tab === 'characteristics' ? 'Details' : tab === 'financial' ? 'Financial' : 'All'}
                        </button>
                      ))}
                    </div>
                    {/* Custom preset tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                      {CUSTOM_SLOTS.map((slot, i) => {
                        const preset = customPresets[i]
                        const isActive = colGroupTab === slot
                        return (
                          <button
                            key={slot}
                            className="ghost"
                            onClick={() => {
                              if (preset) { setColGroupTab(slot); applyCustomPreset(i); setRenamingSlot(null) }
                              else { setRenamingSlot(i); setRenameValue('') }
                            }}
                            style={{
                              flex: 1, padding: '9px 6px', fontSize: 11, fontWeight: 600,
                              borderRadius: 0, textAlign: 'center', position: 'relative',
                              color: isActive ? '#3b82f6' : preset ? 'var(--text3)' : '#d1d5db',
                              boxShadow: isActive ? 'inset 0 -2px 0 #3b82f6' : 'none',
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
                          onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                        />
                        <button
                          type="submit"
                          disabled={!renameValue.trim()}
                          style={{
                            fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                            background: renameValue.trim() ? '#3b82f6' : '#e5e7eb', color: renameValue.trim() ? '#fff' : '#9ca3af',
                            border: 'none', cursor: renameValue.trim() ? 'pointer' : 'default',
                          }}
                        >Save</button>
                      </form>
                    )}
                    {/* Delete / update actions for active custom preset */}
                    {isCustomTab && activePreset && renamingSlot === null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                        <button
                          className="ghost"
                          onClick={() => { saveCustomPreset(customIdx, activePreset.name) }}
                          style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', padding: '2px 6px', borderRadius: 6 }}
                        >Update preset</button>
                        <button
                          className="ghost"
                          onClick={() => { setRenamingSlot(customIdx); setRenameValue(activePreset.name) }}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', padding: '2px 6px', borderRadius: 6 }}
                        >Rename</button>
                        <button
                          className="ghost"
                          onClick={() => deleteCustomPreset(customIdx)}
                          style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', padding: '2px 6px', borderRadius: 6 }}
                        >Delete</button>
                      </div>
                    )}
                    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                    {shownKeys.filter(k => colVis[k]).length > 0 && (
                      <>
                        <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Visible
                        </div>
                        {shownKeys.filter(k => colVis[k]).map(key => (
                          <button
                            key={key}
                            className="ghost"
                            style={{ width: '100%', textAlign: 'left', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0 }}
                            onClick={() => toggleCol(key)}
                          >
                            <span style={{ fontSize: 13 }}>{COL_LABELS[key]}</span>
                            <IconEye visible={true} />
                          </button>
                        ))}
                      </>
                    )}
                    {shownKeys.some(k => !colVis[k]) && (
                      <>
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                        <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Hidden
                        </div>
                        {shownKeys.filter(k => !colVis[k]).map(key => (
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
                const hasValue = value !== null
                return (
                  <div key={key} style={{ position: 'relative', display: 'inline-flex' }}>
                    <button
                      className={`filter-pill${hasValue ? ' active' : ''}`}
                      style={{
                        paddingRight: 6, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none',
                        ...(!hasValue ? { borderStyle: 'dashed', color: '#3b82f6' } : {}),
                      }}
                      onClick={() => setFilterDropdownOpen(prev => prev === key ? null : key)}
                    >
                      {hasValue ? `${col.label}: ${value}` : col.label}
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 5, transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                        <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      className={`filter-pill${hasValue ? ' active' : ''}`}
                      style={{
                        paddingLeft: 6, borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                        ...(hasValue ? { borderLeft: '1px solid rgba(255,255,255,0.3)' } : { borderStyle: 'dashed', borderLeft: '1px dashed var(--border)', color: '#3b82f6' }),
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
                        {col.values.map(val => (
                          <button
                            key={val}
                            className="ghost"
                            style={{
                              width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, borderRadius: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              background: value === val ? '#f0f5ff' : undefined,
                              fontWeight: value === val ? 600 : 400,
                            }}
                            onClick={() => { setActiveFilters(prev => ({ ...prev, [key]: val })); setFilterDropdownOpen(null) }}
                          >
                            <span>{val}</span>
                            {value === val && (
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4"/></svg>
                            )}
                          </button>
                        ))}
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
                          onClick={() => { setActiveFilters(prev => ({ ...prev, [col.key]: col.values[0] })); setFilterDropdownOpen(null) }}
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

        <div className="sec-hdr mb12">
          <span className="sec-title">Properties</span>
          <div className="flex align-center gap8">
            <div className="flex gap4 align-center">
              {YEAR_OPTIONS.map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`year-btn${selectedYear === y ? ' active' : ''}`}
                  onClick={() => setSelectedYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
            {showScrollBtns && (
              <>
                <button type="button" className="scroll-arrow-btn" onClick={() => tableScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}>←</button>
                <button type="button" className="scroll-arrow-btn" onClick={() => tableScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}>→</button>
              </>
            )}
          </div>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="prop-table-scroll" ref={tableScrollRef}>
            <table className="wf-table">
              <thead>
                <tr>
                  <SortTh col="name">Property</SortTh>
                  {colVis.owner && <SortTh col="owner">Owner</SortTh>}
                  {colVis.country && <SortTh col="country" className="wf-align-left">Country</SortTh>}
                  {colVis.status && <SortTh col="status">Status</SortTh>}
                  {colVis.endDate && <SortTh col="endDate">Months Left</SortTh>}
                  {colVis.taxStatus && <SortTh col="taxStatus">Tax Status</SortTh>}
                  {colVis.propertyType && <SortTh col="propertyType">Type</SortTh>}
                  {colVis.bedrooms && <SortTh col="bedrooms">Beds</SortTh>}
                  {colVis.area && <SortTh col="area">Area</SortTh>}
                  {colVis.bathrooms && <SortTh col="bathrooms">Baths</SortTh>}
                  {colVis.parking && <SortTh col="parking">Parking</SortTh>}
                  {colVis.floor && <SortTh col="floor">Floor</SortTh>}
                  {colVis.estrato && <SortTh col="estrato">Estrato</SortTh>}
                  {colVis.yearBuilt && <SortTh col="yearBuilt">Year Built</SortTh>}
                  {colVis.lastRenovation && <SortTh col="lastRenovation">Renovation</SortTh>}
                  {colVis.gpi && <SortTh col="gpi">GPI</SortTh>}
                  {colVis.egi && <SortTh col="egi">EGI</SortTh>}
                  {colVis.opex && <SortTh col="opex">OPEX</SortTh>}
                  {colVis.noi && <SortTh col="noi">NOI</SortTh>}
                  {colVis.capex && <SortTh col="capex">CAPEX</SortTh>}
                  {colVis.taxes && <SortTh col="taxes">Taxes</SortTh>}
                  {colVis.netCf && <SortTh col="netCf">Net CF</SortTh>}
                  {colVis.margin && <SortTh col="margin">Margin</SortTh>}
                  <th style={{ width: 52, textAlign: 'center', padding: '8px 12px 8px 0' }}>
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
                {sortedProperties.map((p) => {
                  const a = convertAnnual(calcAnnual(withYear(p)), p.currency, displayCurrency, fxRates)
                  const ac = activeContract(p)
                  const countryCode = COUNTRIES.find(c => c.name === p.country)?.code
                  return (
                    <tr key={p.id} onClick={() => onSelectProperty(p.id)} style={{ cursor: 'pointer' }}>
                      <td className="wf-col-name">
                        <div className="fw5 wf-truncate" title={p.name}>{p.name}</div>
                        <div className="fs11 text3 wf-truncate" title={p.address}>{p.address}</div>
                      </td>
                      {colVis.owner && <td className="text3 wf-col-owner"><div className="wf-truncate" title={p.owner || ''}>{p.owner || '—'}</div></td>}
                      {colVis.country && (
                        <td className="text3 wf-align-left wf-col-country">
                          {p.country ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={p.country}>
                              {countryCode ? (
                                <img src={countryFlagUrl(countryCode, 40)} alt="" width={20} height={14} style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} />
                              ) : null}
                              {countryCode || p.country}
                            </span>
                          ) : '—'}
                        </td>
                      )}
                      {colVis.status && <td className="wf-col-status">
                        <span className={`badge ${ac ? 'active-c' : 'vacant'}`}>{ac ? 'Rented' : 'Vacant'}</span>
                      </td>}
                      {colVis.endDate && (() => {
                        if (!ac) return <td className="text3">—</td>
                        const end = new Date(ac.endDate)
                        const now = new Date()
                        const months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth()
                        return <td className={months <= 3 ? 'neg' : months <= 6 ? '' : 'text3'} style={{ whiteSpace: 'nowrap' }}>
                          {months <= 0 ? 'Expired' : `${months}m`}
                        </td>
                      })()}
                      {colVis.taxStatus && (() => {
                        const items = p.taxes?.items ?? []
                        const pending = items.filter(t => t.status === 'pending')
                        if (items.length === 0) return <td className="text3">—</td>
                        if (pending.length === 0) return <td><span className="badge active-c">Paid</span></td>
                        const nearest = pending.reduce((a, b) => a.dueDate < b.dueDate ? a : b)
                        const due = new Date(nearest.dueDate)
                        const now = new Date()
                        const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        return <td>
                          <span className="badge vacant">Due {daysLeft <= 0 ? 'overdue' : `${daysLeft}d`}</span>
                        </td>
                      })()}
                      {colVis.propertyType && <td className="text3">{p.factSheet?.propertyType || '—'}</td>}
                      {colVis.bedrooms && <td className="text3">{p.bedrooms || '—'}</td>}
                      {colVis.area && <td className="text3">{p.area ? `${p.area} m²` : '—'}</td>}
                      {colVis.bathrooms && <td className="text3">{p.bathrooms || '—'}</td>}
                      {colVis.parking && <td className="text3">{p.parking || '—'}</td>}
                      {colVis.floor && <td className="text3">{p.factSheet?.floor ?? '—'}</td>}
                      {colVis.estrato && <td className="text3">{p.factSheet?.estrato ?? '—'}</td>}
                      {colVis.yearBuilt && <td className="text3">{p.factSheet?.yearBuilt ?? '—'}</td>}
                      {colVis.lastRenovation && <td className="text3">{p.factSheet?.lastRenovation ?? '—'}</td>}
                      {colVis.gpi && <td>{fm(a.gpi)}</td>}
                      {colVis.egi && <td className="pos">{fm(a.egi)}</td>}
                      {colVis.opex && <td className="neg">−{fm(a.totalOpex)}</td>}
                      {colVis.noi && <td className={a.noi >= 0 ? 'pos' : 'neg'}>{fm(a.noi)}</td>}
                      {colVis.capex && <td className={a.totalCapex ? 'neg' : 'text3'}>{a.totalCapex ? `−${fm(a.totalCapex)}` : '—'}</td>}
                      {colVis.taxes && <td className={a.taxes ? 'neg' : 'text3'}>{a.taxes ? `−${fm(a.taxes)}` : '—'}</td>}
                      {colVis.netCf && <td className={a.netCf >= 0 ? 'pos fw5' : 'neg fw5'}>
                        {a.netCf >= 0 ? '+' : ''}
                        {fm(a.netCf)}
                      </td>}
                      {colVis.margin && <td>{a.gpi ? `${Math.round((a.netCf / a.gpi) * 100)}%` : '—'}</td>}
                      <td onClick={(e) => e.stopPropagation()} style={{ width: 52, padding: '8px 12px 8px 0', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <RowMenu
                            onEdit={() => onSelectProperty(p.id)}
                            onDelete={() => setDeleteTarget(p)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="total-row">
                  <td>Total</td>
                  {colVis.owner && <td />}
                  {colVis.country && <td className="wf-align-left" />}
                  {colVis.status && <td />}
                  {colVis.endDate && <td />}
                  {colVis.taxStatus && <td />}
                  {colVis.propertyType && <td />}
                  {colVis.bedrooms && <td />}
                  {colVis.area && <td />}
                  {colVis.bathrooms && <td />}
                  {colVis.parking && <td />}
                  {colVis.floor && <td />}
                  {colVis.estrato && <td />}
                  {colVis.yearBuilt && <td />}
                  {colVis.lastRenovation && <td />}
                  {colVis.gpi && <td>{fm(totals.gpi)}</td>}
                  {colVis.egi && <td>{fm(totals.egi)}</td>}
                  {colVis.opex && <td className="neg">−{fm(totals.opex)}</td>}
                  {colVis.noi && <td>{fm(totals.noi)}</td>}
                  {colVis.capex && <td>{totals.capex ? `−${fm(totals.capex)}` : '—'}</td>}
                  {colVis.taxes && <td>{totals.taxes ? `−${fm(totals.taxes)}` : '—'}</td>}
                  {colVis.netCf && <td>
                    {totals.net >= 0 ? '+' : ''}
                    {fm(totals.net)}
                  </td>}
                  {colVis.margin && <td>{totals.gpi ? `${Math.round((totals.net / totals.gpi) * 100)}%` : '—'}</td>}
                  <td style={{ width: 52, padding: '8px 0' }} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <PropertyLeaderboardMap
          properties={filteredProperties.map(withYear)}
          annuals={annualsMap}
          onSelectProperty={onSelectProperty}
          activeContractMap={activeContractMap}
        />
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
    </div>
  )
}
