import { useState, useMemo, useCallback, useRef, useEffect, type Ref } from 'react'
import Map, { type ViewStateChangeEvent, type MapRef } from 'react-map-gl/maplibre'
import { DeckGLOverlay } from './DeckGLOverlay'
import { ScatterplotLayer } from 'deck.gl'
import type { Property } from '../lib/types'
import { activeContract, type AnnualResult } from '../lib/finance'
import 'maplibre-gl/dist/maplibre-gl.css'

type MetricKey = 'area' | 'rent' | 'monthlyIncome' | 'noi' | 'netCf'

interface MetricOption {
  key: MetricKey
  label: string
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'area', label: 'Area m²' },
  { key: 'rent', label: 'Rent' },
  { key: 'monthlyIncome', label: 'Monthly Income' },
  { key: 'noi', label: 'NOI' },
  { key: 'netCf', label: 'Net CF' },
]

const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

interface PropertyWithMetrics {
  id: number
  name: string
  city: string
  address: string
  latitude: number
  longitude: number
  area: number
  rent: number
  monthlyIncome: number
  noi: number
  netCf: number
  annual: AnnualResult
  monthsLeft: number | null
  vacant: boolean
  taxDaysLeft: number | null  // days until nearest pending tax due date
  taxPending: boolean
}

/* ── Alert rules ── */
type AlertSeverity = 'critical' | 'warning' | 'info'

interface AlertRule {
  key: string
  label: string
  severity: AlertSeverity
  check: (p: PropertyWithMetrics) => boolean
  describe: (p: PropertyWithMetrics) => string
  color: [number, number, number] // RGB for pulse ring
}

const ALERT_RULES: AlertRule[] = [
  {
    key: 'vacant',
    label: 'Vacant',
    severity: 'critical',
    check: (p) => p.vacant,
    describe: () => 'No active contract — property is vacant',
    color: [185, 28, 28],
  },
  {
    key: 'contractExpiring1',
    label: 'Expiring < 1 mo',
    severity: 'critical',
    check: (p) => p.monthsLeft != null && p.monthsLeft <= 1,
    describe: (p) => `Contract expires in ${Math.max(0, p.monthsLeft!)} month${p.monthsLeft === 1 ? '' : 's'}`,
    color: [185, 28, 28],
  },
  {
    key: 'contractExpiring3',
    label: 'Expiring < 3 mo',
    severity: 'warning',
    check: (p) => p.monthsLeft != null && p.monthsLeft > 1 && p.monthsLeft <= 3,
    describe: (p) => `Contract expires in ${p.monthsLeft} months`,
    color: [217, 119, 6],
  },
  {
    key: 'contractExpiring6',
    label: 'Expiring < 6 mo',
    severity: 'info',
    check: (p) => p.monthsLeft != null && p.monthsLeft > 3 && p.monthsLeft <= 6,
    describe: (p) => `Contract expires in ${p.monthsLeft} months`,
    color: [59, 130, 246],
  },
  {
    key: 'taxOverdue',
    label: 'Tax overdue',
    severity: 'critical',
    check: (p) => p.taxPending && p.taxDaysLeft != null && p.taxDaysLeft <= 10,
    describe: (p) => p.taxDaysLeft! <= 0 ? 'Tax payment is overdue' : `Tax due in ${p.taxDaysLeft} days`,
    color: [185, 28, 28],
  },
  {
    key: 'taxDue30',
    label: 'Tax due < 30d',
    severity: 'warning',
    check: (p) => p.taxPending && p.taxDaysLeft != null && p.taxDaysLeft > 10 && p.taxDaysLeft <= 30,
    describe: (p) => `Tax due in ${p.taxDaysLeft} days`,
    color: [217, 119, 6],
  },
  {
    key: 'taxDue90',
    label: 'Tax due < 90d',
    severity: 'info',
    check: (p) => p.taxPending && p.taxDaysLeft != null && p.taxDaysLeft > 30 && p.taxDaysLeft <= 90,
    describe: (p) => `Tax due in ${p.taxDaysLeft} days`,
    color: [59, 130, 246],
  },
]

function monthsUntil(dateStr: string): number {
  const end = new Date(dateStr)
  const now = new Date()
  return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
}

function formatMetricValue(key: MetricKey, value: number): string {
  if (key === 'area') return `${value.toLocaleString()} m²`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toLocaleString()}`
}

interface Props {
  properties: Property[]
  annuals: Map<number, AnnualResult>
  onSelectProperty: (id: number) => void
  activeContractMap: Map<number, { monthlyRent: number } | null>
}

export function PropertyLeaderboardMap({ properties, annuals, onSelectProperty, activeContractMap }: Props) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('area')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [alertOn, setAlertOn] = useState(false)
  const [panelTab, setPanelTab] = useState<'list' | 'alerts'>('list')
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
  const [viewState, setViewState] = useState({
    longitude: -74.08,
    latitude: 4.65,
    zoom: 10,
    bearing: 0,
    pitch: 0,
  })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const leaderboardRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapRef>(null)
  const didFitRef = useRef(false)

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  // Build metric data for properties that have coordinates
  const data: PropertyWithMetrics[] = useMemo(() => {
    return properties
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => {
        const annual = annuals.get(p.id)!
        const contract = activeContractMap.get(p.id)
        const ac = activeContract(p)
        return {
          id: p.id,
          name: p.name,
          city: p.city,
          address: p.address,
          latitude: p.latitude!,
          longitude: p.longitude!,
          area: p.area || 0,
          rent: contract?.monthlyRent ?? 0,
          monthlyIncome: (annual?.egi ?? 0) / 12,
          noi: annual?.noi ?? 0,
          netCf: annual?.netCf ?? 0,
          annual: annual ?? { gpi: 0, vacancy: 0, egi: 0, totalOpex: 0, noi: 0, totalCapex: 0, taxes: 0, netCf: 0 },
          monthsLeft: ac?.endDate ? monthsUntil(ac.endDate) : null,
          vacant: !ac,
          ...(() => {
            const pending = (p.taxes?.items ?? []).filter(t => t.status === 'pending')
            if (pending.length === 0) return { taxPending: false, taxDaysLeft: null }
            const nearest = pending.reduce((a, b) => a.dueDate < b.dueDate ? a : b)
            const days = Math.ceil((new Date(nearest.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return { taxPending: true, taxDaysLeft: days }
          })(),
        }
      })
  }, [properties, annuals, activeContractMap])

  // Min-max normalization
  const normalizedMap = useMemo(() => {
    const map = new window.Map<number, number>()
    if (data.length === 0) return map
    const values = data.map(d => d[selectedMetric])
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    for (const d of data) {
      const pct = range === 0 ? 50 : Math.round(((d[selectedMetric] - min) / range) * 100)
      map.set(d.id, pct)
    }
    return map
  }, [data, selectedMetric])

  // Sort by percentage descending
  const sorted = useMemo(() => {
    return [...data].sort((a, b) => (normalizedMap.get(b.id) ?? 0) - (normalizedMap.get(a.id) ?? 0))
  }, [data, normalizedMap])

  // Fit map bounds to all property points on initial load
  const fitBounds = useCallback(() => {
    const map = mapRef.current
    if (!map || data.length === 0) return
    if (data.length === 1) {
      setViewState(prev => ({ ...prev, longitude: data[0].longitude, latitude: data[0].latitude, zoom: 13 }))
      return
    }
    const lngs = data.map(d => d.longitude)
    const lats = data.map(d => d.latitude)
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, duration: 0 },
    )
  }, [data])

  const onMapLoad = useCallback(() => {
    if (!didFitRef.current) {
      didFitRef.current = true
      fitBounds()
    }
  }, [fitBounds])

  // Re-fit bounds when filtered data changes
  const dataKey = useMemo(() => data.map(d => d.id).join(','), [data])
  useEffect(() => {
    if (didFitRef.current) fitBounds()
  }, [dataKey, fitBounds])

  const flyTo = useCallback((lng: number, lat: number) => {
    setViewState(prev => ({
      ...prev,
      longitude: lng,
      latitude: lat,
      zoom: 15,
      transitionDuration: 800,
    }))
  }, [])

  const handleRowClick = useCallback((prop: PropertyWithMetrics) => {
    setSelectedId(prop.id)
    flyTo(prop.longitude, prop.latitude)
  }, [flyTo])

  const handleMapClick = useCallback(() => {
    setSelectedId(null)
  }, [])

  const resetNorth = useCallback(() => {
    setViewState(prev => ({ ...prev, bearing: 0, pitch: 0 }))
  }, [])

  const selectedProp = selectedId != null ? data.find(d => d.id === selectedId) : null

  const scatterLayer = useMemo(() => {
    return new ScatterplotLayer({
      id: 'properties',
      data,
      getPosition: (d: PropertyWithMetrics) => [d.longitude, d.latitude],
      getRadius: (d: PropertyWithMetrics) => {
        const pct = normalizedMap.get(d.id) ?? 50
        return 5 + (pct / 100) * 395
      },
      getFillColor: (d: PropertyWithMetrics) =>
        d.id === selectedId ? [41, 204, 151, 153] : [55, 81, 255, 153],
      getLineColor: (d: PropertyWithMetrics) =>
        d.id === selectedId ? [41, 204, 151, 255] : [55, 81, 255, 255],
      stroked: true,
      lineWidthMinPixels: 2,
      radiusMinPixels: 6,
      radiusMaxPixels: 30,
      pickable: true,
      onClick: ({ object }: { object?: PropertyWithMetrics }) => {
        if (object) {
          setSelectedId(object.id)
          flyTo(object.longitude, object.latitude)
          const row = document.getElementById(`lb-row-${object.id}`)
          row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      },
      updateTriggers: {
        getFillColor: [selectedId],
        getLineColor: [selectedId],
        getRadius: [selectedMetric],
      },
    })
  }, [data, normalizedMap, selectedId, selectedMetric])

  // Alert: filter properties that trigger any rule
  const alertData = useMemo(() => {
    const criticalRules = ALERT_RULES.filter(r => r.severity === 'critical')
    return data.filter(p => criticalRules.some(r => r.check(p)))
  }, [data])

  const alertIds = useMemo(() => new Set(alertData.map(d => d.id)), [alertData])

  // Build structured alert notifications grouped by severity
  const alertNotifications = useMemo(() => {
    const items: { prop: PropertyWithMetrics; rule: AlertRule }[] = []
    const contractRules = ALERT_RULES.filter(r => r.key.startsWith('contract') || r.key === 'vacant')
    const taxRules = ALERT_RULES.filter(r => r.key.startsWith('tax'))
    for (const p of data) {
      // first matching contract/vacancy rule
      for (const r of contractRules) { if (r.check(p)) { items.push({ prop: p, rule: r }); break } }
      // first matching tax rule
      for (const r of taxRules) { if (r.check(p)) { items.push({ prop: p, rule: r }); break } }
    }
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
    return items.sort((a, b) => order[a.rule.severity] - order[b.rule.severity])
  }, [data])

  // Animation tick for pulse ring
  const [pulseTime, setPulseTime] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!alertOn || alertData.length === 0) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    let start: number | null = null
    const tick = (ts: number) => {
      if (start === null) start = ts
      setPulseTime(ts - start)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [alertOn, alertData.length])

  // Pulsating ring layer
  const pulseLayer = useMemo(() => {
    if (!alertOn || alertData.length === 0) return null
    const cycle = (pulseTime % 2000) / 2000 // 0→1 over 2s
    const ruleColor = ALERT_RULES[0].color
    return new ScatterplotLayer({
      id: 'alert-pulse',
      data: alertData,
      getPosition: (d: PropertyWithMetrics) => [d.longitude, d.latitude],
      getRadius: () => 200 + cycle * 800,
      getFillColor: () => [...ruleColor, Math.round((1 - cycle) * 80)] as [number, number, number, number],
      getLineColor: () => [...ruleColor, Math.round((1 - cycle) * 180)] as [number, number, number, number],
      stroked: true,
      lineWidthMinPixels: 2,
      radiusMinPixels: 8 + cycle * 20,
      radiusMaxPixels: 40,
      pickable: false,
      updateTriggers: {
        getRadius: [pulseTime],
        getFillColor: [pulseTime],
        getLineColor: [pulseTime],
      },
    })
  }, [alertOn, alertData, pulseTime])

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState as typeof viewState)
  }, [])

  const metricLabel = METRIC_OPTIONS.find(m => m.key === selectedMetric)!.label

  if (data.length === 0) return null

  return (
    <div className="lb-map-container">
      {/* Left: Leaderboard */}
      <div className="lb-panel">
        <div className="lb-tabs">
          <button className={`lb-tab${panelTab === 'list' ? ' active' : ''}`} onClick={() => setPanelTab('list')}>List</button>
          <button className={`lb-tab${panelTab === 'alerts' ? ' active' : ''}`} onClick={() => { setPanelTab('alerts'); setAlertOn(true) }}>
            Alerts({alertNotifications.length})
          </button>
        </div>
        {panelTab === 'list' && (
          <div className="lb-header">
            <span className="lb-count">{data.length} properties</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  className="lb-dropdown-btn"
                  onClick={() => setDropdownOpen(v => !v)}
                >
                  {metricLabel}
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: dropdownOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }}>
                    <path d="M1 1l4 4 4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {dropdownOpen && (
                  <div className="lb-dropdown-menu">
                    {METRIC_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        className={`lb-dropdown-item${selectedMetric === opt.key ? ' active' : ''}`}
                        onClick={() => { setSelectedMetric(opt.key); setDropdownOpen(false) }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className={`lb-map-control-btn${alertOn ? ' active' : ''}`}
                onClick={() => setAlertOn(prev => !prev)}
                title={alertOn ? 'Disable alerts' : 'Enable alerts'}
              >
                <img src={alertOn ? '/Alert - On.svg' : '/Alert - Off.svg'} alt="Alert toggle" width="16" height="16" />
              </button>
            </div>
          </div>
        )}

        {panelTab === 'list' && (
          <div className="lb-list" ref={leaderboardRef}>
            {sorted.map(prop => {
              const pct = normalizedMap.get(prop.id) ?? 0
              const isActive = prop.id === selectedId
              return (
                <div
                  key={prop.id}
                  id={`lb-row-${prop.id}`}
                  className={`lb-row${isActive ? ' active' : ''}`}
                  onClick={() => handleRowClick(prop)}
                >
                  <div className="lb-row-left">
                    <span className={`lb-row-dot${alertOn && alertIds.has(prop.id) ? ' alert' : ''}`} />
                    <div>
                      <div className="lb-row-name">{prop.name}</div>
                      <div className="lb-row-city">{prop.city}</div>
                    </div>
                  </div>
                  <div className="lb-row-right">
                    <span className="lb-row-value">{formatMetricValue(selectedMetric, prop[selectedMetric])}</span>
                    <div className="lb-bar-container">
                      <div className="lb-bar-track">
                        <div className="lb-bar" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="lb-bar-pct">{pct}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {panelTab === 'alerts' && (
          <>
            <div className="lb-header">
              <div className="lb-severity-filters">
                {(['all', 'critical', 'warning', 'info'] as const).map(s => (
                  <button
                    key={s}
                    className={`lb-severity-btn lb-severity-btn-${s}${severityFilter === s ? ' active' : ''}`}
                    onClick={() => setSeverityFilter(s)}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <button
                className={`lb-map-control-btn${alertOn ? ' active' : ''}`}
                onClick={() => setAlertOn(prev => !prev)}
                title={alertOn ? 'Disable alerts' : 'Enable alerts'}
              >
                <img src={alertOn ? '/Alert - On.svg' : '/Alert - Off.svg'} alt="Alert toggle" width="16" height="16" />
              </button>
            </div>
            <div className="lb-list">
              {alertNotifications.filter(a => (severityFilter === 'all' || a.rule.severity === severityFilter) && (selectedId == null || a.prop.id === selectedId)).length === 0 ? (
                <div className="lb-alerts-empty">No active alerts</div>
              ) : (
                alertNotifications
                  .filter(a => (severityFilter === 'all' || a.rule.severity === severityFilter) && (selectedId == null || a.prop.id === selectedId))
                  .map(({ prop, rule }) => (
                    <div
                      key={`${prop.id}-${rule.key}`}
                      className={`lb-alert-item lb-alert-${rule.severity}`}
                      onClick={() => handleRowClick(prop)}
                    >
                      <div className="lb-alert-severity-bar" />
                      <div className="lb-alert-content">
                        <div className="lb-alert-name">{prop.name}</div>
                        <div className="lb-alert-desc">{rule.describe(prop)}</div>
                      </div>
                      <span className={`lb-alert-badge lb-alert-badge-${rule.severity}`}>{rule.label}</span>
                    </div>
                  ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: Map */}
      <div className="lb-map-panel">
        <Map
          ref={mapRef as Ref<MapRef>}
          {...viewState}
          onMove={handleMove}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          mapStyle={CARTO_STYLE}
          style={{ width: '100%', height: '100%' }}
          cursor={selectedProp ? 'default' : 'grab'}
          attributionControl={true}
        >
          <DeckGLOverlay layers={pulseLayer ? [pulseLayer, scatterLayer] : [scatterLayer]} />
        </Map>

        {/* Map controls */}
        <div className="lb-map-controls">
          <button className="lb-map-control-btn" onClick={fitBounds} title="Zoom to all properties">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6V3a1 1 0 011-1h3M10 2h3a1 1 0 011 1v3M14 10v3a1 1 0 01-1 1h-3M6 14H3a1 1 0 01-1-1v-3" />
            </svg>
          </button>
          <button className="lb-map-control-btn" onClick={resetNorth} title="Reset north">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4v4" />
              <circle cx="8" cy="4" r="1" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>

        {/* Popup */}
        {selectedProp && (
          <div className="lb-popup">
            <div className="lb-popup-header">
              <div>
                <div className="lb-popup-name">{selectedProp.name}</div>
                <div className="lb-popup-address">{selectedProp.address}</div>
              </div>
              <button className="lb-popup-close" onClick={() => setSelectedId(null)}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            </div>
            <div className="lb-popup-metrics">
              <div className="lb-popup-row">
                <span className="lb-popup-label">Area</span>
                <span className="lb-popup-val">{selectedProp.area.toLocaleString()} m²</span>
              </div>
              <div className="lb-popup-row">
                <span className="lb-popup-label">Rent</span>
                <span className="lb-popup-val">{formatMetricValue('rent', selectedProp.rent)}</span>
              </div>
              <div className="lb-popup-row">
                <span className="lb-popup-label">Monthly Income</span>
                <span className="lb-popup-val">{formatMetricValue('monthlyIncome', selectedProp.monthlyIncome)}</span>
              </div>
              <div className="lb-popup-row">
                <span className="lb-popup-label">GPI</span>
                <span className="lb-popup-val">{formatMetricValue('rent', selectedProp.annual.gpi)}</span>
              </div>
              <div className="lb-popup-row">
                <span className="lb-popup-label">EGI</span>
                <span className="lb-popup-val">{formatMetricValue('rent', selectedProp.annual.egi)}</span>
              </div>
              <div className="lb-popup-row">
                <span className="lb-popup-label">OPEX</span>
                <span className="lb-popup-val">{formatMetricValue('rent', selectedProp.annual.totalOpex)}</span>
              </div>
              <div className="lb-popup-row">
                <span className="lb-popup-label">NOI</span>
                <span className="lb-popup-val">{formatMetricValue('noi', selectedProp.annual.noi)}</span>
              </div>
              <div className="lb-popup-row">
                <span className="lb-popup-label">Net CF</span>
                <span className="lb-popup-val">{formatMetricValue('netCf', selectedProp.annual.netCf)}</span>
              </div>
            </div>
            <button className="lb-popup-detail-btn" onClick={() => onSelectProperty(selectedProp.id)}>
              View details
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
