import { useState, useMemo, useCallback, useRef, useEffect, type Ref } from 'react'
import Map, { type ViewStateChangeEvent, type MapRef } from 'react-map-gl/maplibre'
import { DeckGLOverlay } from './DeckGLOverlay'
import { ScatterplotLayer } from 'deck.gl'
import type { Property } from '../lib/types'
import type { AnnualResult } from '../lib/finance'
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
          // Scroll row into view
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

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState as typeof viewState)
  }, [])

  const metricLabel = METRIC_OPTIONS.find(m => m.key === selectedMetric)!.label

  if (data.length === 0) return null

  return (
    <div className="lb-map-container">
      {/* Left: Leaderboard */}
      <div className="lb-panel">
        <div className="lb-header">
          <span className="lb-count">{data.length} properties</span>
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
        </div>
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
                  <div className="lb-row-name">{prop.name}</div>
                  <div className="lb-row-city">{prop.city}</div>
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
          <DeckGLOverlay layers={[scatterLayer]} />
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
