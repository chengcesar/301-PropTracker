import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect, type Ref } from 'react'
import Map, { type ViewStateChangeEvent, type MapRef } from 'react-map-gl/maplibre'
import { DeckGLOverlay } from './DeckGLOverlay'
import { ScatterplotLayer, IconLayer, TextLayer, WebMercatorViewport } from 'deck.gl'
import Supercluster from 'supercluster'
import type { Property } from '../lib/types'
import { activeContract, convertAnnual, estimatedPropertyValueAtYear, projectedGpiAnnual, type AnnualResult } from '../lib/finance'
import { convert, type CurrencyCode, type FxRates } from '../lib/currency'
import { fmtCurrencyM } from '../lib/format'
import {
  evaluatePropertyAlerts,
  firstCriticalPulseColor,
  hasCriticalAlert,
  loadAlertRuleConfig,
  saveAlertRuleConfig,
  type AlertRuleConfigV1,
  type AlertSeverity,
  type EvaluatedAlertMatch,
} from '../lib/alertRuleConfig'
import { AlertRulesModal } from './modals/AlertRulesModal'
import { ACCENT_THEME_CHANGE_EVENT } from '../lib/accentTheme'
import { getThemeAccentHoverRgb, getThemeAccentRgb } from '../lib/cssAccent'
import 'maplibre-gl/dist/maplibre-gl.css'

type MetricKey =
  | 'area'
  | 'rent'
  | 'monthlyIncome'
  | 'noi'
  | 'netCf'
  | 'estValue'
  | 'egiPerM2'
  | 'noiPerM2'
  | 'margin'

interface MetricOption {
  key: MetricKey
  label: string
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'area', label: 'Area m²' },
  { key: 'estValue', label: 'Est. Value' },
  { key: 'rent', label: 'Rent' },
  { key: 'monthlyIncome', label: 'Monthly Income' },
  { key: 'noi', label: 'NOI' },
  { key: 'netCf', label: 'Net CF' },
  { key: 'egiPerM2', label: '$/m²' },
  { key: 'noiPerM2', label: 'NOI/m²' },
  { key: 'margin', label: 'Margin' },
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
  estValue: number
  /** EGI ÷ area (matches portfolio $/m²). */
  egiPerM2: number
  /** NOI ÷ area. */
  noiPerM2: number
  /** Net CF ÷ GPI × 100 (same as portfolio margin column). */
  margin: number
  annual: AnnualResult
  monthsLeft: number | null
  vacant: boolean
  taxDaysLeft: number | null  // days until nearest pending tax due date
  taxPending: boolean
  // Spatial / detail fields
  propertyType: string
  bedrooms: number
  bathrooms: number
  parking: number
  storageUnits: number
  concierge: boolean
  terrace: number
  balcony: number
  floors: number
  yearBuilt: number | null
  estrato: number | null
}

function alertMetrics(p: PropertyWithMetrics) {
  return {
    monthsLeft: p.monthsLeft,
    vacant: p.vacant,
    taxPending: p.taxPending,
    taxDaysLeft: p.taxDaysLeft,
  }
}

function monthsUntil(dateStr: string): number {
  const end = new Date(dateStr)
  const now = new Date()
  return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
}

function formatMetricValue(key: MetricKey, value: number, displayCurrency: CurrencyCode): string {
  if (key === 'area') return `${value.toLocaleString()} m²`
  if (key === 'margin') return `${Math.round(value)}%`
  return fmtCurrencyM(value, displayCurrency)
}

type MapClusterBBox = [number, number, number, number]

/** Single atlas frame: white silhouette on transparent — IconLayer tints via getColor (mask). */
function buildPropertyMarkerAtlasDataUrl(): string {
  if (typeof document === 'undefined') return ''
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.clearRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  ctx.beginPath()
  ctx.arc(cx, cy, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  return c.toDataURL()
}

interface ClusterCircle {
  position: [number, number]
  clusterId: number
  pointCount: number
}

/** Match `clusterLayer` pixel radius (single source for bubble + pulse sizing). */
function clusterBubbleRadiusPx(pointCount: number): number {
  return Math.min(46, 14 + Math.sqrt(pointCount) * 5)
}

interface AlertPulseDatum {
  position: [number, number]
  color: [number, number, number]
  basePx: number
}

interface Props {
  properties: Property[]
  annuals: Map<number, AnnualResult>
  onSelectProperty: (id: number) => void
  activeContractMap: Map<number, { monthlyRent: number } | null>
  displayCurrency: CurrencyCode
  fxRates: FxRates
}

export function PropertyLeaderboardMap({ properties, annuals, onSelectProperty, activeContractMap, displayCurrency, fxRates }: Props) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('area')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  /** Property ids grouped when user clicks a map cluster (supercluster); enables "2 of 3" popup navigation. */
  const [clusterMemberIds, setClusterMemberIds] = useState<number[] | null>(null)
  const [alertOn, setAlertOn] = useState(false)
  const [panelTab, setPanelTab] = useState<'list' | 'alerts'>('list')
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
  const [alertRuleConfig, setAlertRuleConfig] = useState<AlertRuleConfigV1>(() => loadAlertRuleConfig())
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [popupTab, setPopupTab] = useState<'financial' | 'details'>('financial')
  const [viewState, setViewState] = useState({
    longitude: -74.08,
    latitude: 4.65,
    zoom: 10,
    bearing: 0,
    pitch: 0,
  })
  /** Viewport for supercluster.getClusters — updated from the Map instance on move/load. */
  const [mapView, setMapView] = useState<{ bbox: MapClusterBBox; zoom: number }>({
    bbox: [-180, -85, 180, 85],
    zoom: 10,
  })
  const markerAtlas = useMemo(() => buildPropertyMarkerAtlasDataUrl(), [])
  /** Bumps when accent preset changes so Deck.gl layers re-read --accent-bg / --accent-hover. */
  const [accentRev, setAccentRev] = useState(0)
  useEffect(() => {
    const bump = () => setAccentRev((n) => n + 1)
    window.addEventListener(ACCENT_THEME_CHANGE_EVENT, bump)
    return () => window.removeEventListener(ACCENT_THEME_CHANGE_EVENT, bump)
  }, [])

  const deckAccent = useMemo(() => {
    const a = getThemeAccentRgb()
    const h = getThemeAccentHoverRgb()
    return {
      clusterFill: [a.r, a.g, a.b, 236] as [number, number, number, number],
      icon: [a.r, a.g, a.b, 255] as [number, number, number, number],
      iconSelected: [h.r, h.g, h.b, 255] as [number, number, number, number],
      pointFill: [a.r, a.g, a.b, 210] as [number, number, number, number],
      pointFillSelected: [h.r, h.g, h.b, 220] as [number, number, number, number],
      pointLineSelected: [h.r, h.g, h.b, 255] as [number, number, number, number],
    }
  }, [accentRev])

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
        const annualRaw = annuals.get(p.id)!
        const annualConv = convertAnnual(annualRaw, p.currency, displayCurrency, fxRates)
        const annual: AnnualResult = {
          ...annualConv,
          gpi: convert(projectedGpiAnnual(p), p.currency, displayCurrency, fxRates),
        }
        const contract = activeContractMap.get(p.id)
        const ac = activeContract(p)
        const rentNative = contract?.monthlyRent ?? 0
        const estNative = estimatedPropertyValueAtYear(p, new Date().getFullYear()).value ?? 0
        const areaM2 = p.area || 0
        const gpiAnnual = annual?.gpi ?? 0
        const egiAnnual = annual?.egi ?? 0
        const noiAnnual = annual?.noi ?? 0
        const netCfAnnual = annual?.netCf ?? 0
        return {
          id: p.id,
          name: p.name,
          city: p.city,
          address: p.address,
          latitude: p.latitude!,
          longitude: p.longitude!,
          area: areaM2,
          rent: convert(rentNative, p.currency, displayCurrency, fxRates),
          monthlyIncome: egiAnnual / 12,
          noi: noiAnnual,
          netCf: netCfAnnual,
          estValue: convert(estNative, p.currency, displayCurrency, fxRates),
          egiPerM2: areaM2 > 0 ? egiAnnual / areaM2 : 0,
          noiPerM2: areaM2 > 0 && Number.isFinite(noiAnnual) ? noiAnnual / areaM2 : 0,
          margin: gpiAnnual > 0 ? (netCfAnnual / gpiAnnual) * 100 : 0,
          annual: annual ?? { gpi: 0, vacancy: 0, egi: 0, totalOpex: 0, noi: 0, totalCapex: 0, taxes: 0, serviceOneTime: 0, maintenance: 0, netCf: 0 },
          monthsLeft: ac?.endDate ? monthsUntil(ac.endDate) : null,
          vacant: !ac,
          ...(() => {
            const pending = (p.taxes?.items ?? []).filter(t => t.status === 'pending')
            if (pending.length === 0) return { taxPending: false, taxDaysLeft: null }
            const nearest = pending.reduce((a, b) => a.dueDate < b.dueDate ? a : b)
            const days = Math.ceil((new Date(nearest.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return { taxPending: true, taxDaysLeft: days }
          })(),
          propertyType: p.factSheet?.propertyType ?? '',
          bedrooms: p.bedrooms ?? 0,
          bathrooms: p.bathrooms ?? 0,
          parking: p.parking ?? 0,
          storageUnits: p.storageUnits ?? 0,
          concierge: p.concierge ?? false,
          terrace: p.terrace ?? 0,
          balcony: p.balcony ?? 0,
          floors: p.floors ?? 0,
          yearBuilt: p.factSheet?.yearBuilt ?? p.year ?? null,
          estrato: p.factSheet?.estrato ?? null,
        }
      })
  }, [properties, annuals, activeContractMap, displayCurrency, fxRates])

  // Max-based normalization (top value = 100%)
  const normalizedMap = useMemo(() => {
    const map = new window.Map<number, number>()
    if (data.length === 0) return map
    const values = data.map(d => d[selectedMetric])
    const max = Math.max(...values)
    for (const d of data) {
      const pct = max === 0 ? 0 : Math.round((d[selectedMetric] / max) * 100)
      map.set(d.id, pct)
    }
    return map
  }, [data, selectedMetric])

  const propById = useMemo(
    () => new window.Map<number, PropertyWithMetrics>(data.map(d => [d.id, d])),
    [data],
  )

  const clusterIndex = useMemo(() => {
    const sc = new Supercluster({ radius: 52, maxZoom: 16, minPoints: 2 })
    sc.load(
      data.map(d => ({
        type: 'Feature' as const,
        properties: { propId: d.id },
        geometry: { type: 'Point' as const, coordinates: [d.longitude, d.latitude] as [number, number] },
      })),
    )
    return sc
  }, [data])

  const { clusterCircles, unclusteredPoints } = useMemo(() => {
    const z = Math.max(0, Math.floor(mapView.zoom))
    const raw = clusterIndex.getClusters(mapView.bbox, z) as Array<{
      type: 'Feature'
      properties: { cluster?: boolean; cluster_id?: number; point_count?: number; propId?: number }
      geometry: { type: 'Point'; coordinates: [number, number] }
    }>
    const clusterCircles: ClusterCircle[] = []
    const unclusteredPoints: PropertyWithMetrics[] = []
    for (const f of raw) {
      const p = f.properties
      const [lng, lat] = f.geometry.coordinates
      if (p.cluster && p.cluster_id != null && p.point_count != null) {
        clusterCircles.push({ position: [lng, lat], clusterId: p.cluster_id, pointCount: p.point_count })
      } else if (p.propId != null) {
        const row = propById.get(p.propId)
        if (row) unclusteredPoints.push(row)
      }
    }
    return { clusterCircles, unclusteredPoints }
  }, [clusterIndex, mapView.bbox, mapView.zoom, propById])

  // Sort by percentage descending
  const sorted = useMemo(() => {
    return [...data].sort((a, b) => (normalizedMap.get(b.id) ?? 0) - (normalizedMap.get(a.id) ?? 0))
  }, [data, normalizedMap])

  /** Keep React `viewState` + supercluster `mapView` aligned with the native MapLibre camera.
   *  Otherwise a controlled <Map> can snap back after `fitBounds`, and clusters/labels use the wrong bbox/zoom until the user moves. */
  const syncViewportFromNativeMap = useCallback(() => {
    const ml = mapRef.current?.getMap()
    if (!ml) return
    const b = ml.getBounds()
    setMapView({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: ml.getZoom() })
    const c = ml.getCenter()
    setViewState(prev => ({
      ...prev,
      longitude: c.lng,
      latitude: c.lat,
      zoom: ml.getZoom(),
      bearing: ml.getBearing(),
      pitch: ml.getPitch(),
    }))
  }, [])

  const scheduleSyncAfterCameraChange = useCallback((options?: { animationMs?: number }) => {
    const ml = mapRef.current?.getMap()
    if (!ml) return
    const run = () => syncViewportFromNativeMap()
    ml.once('moveend', run)
    requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
    const ms = options?.animationMs
    if (ms != null) {
      window.setTimeout(run, ms + 50)
      window.setTimeout(run, ms + 180)
    }
  }, [syncViewportFromNativeMap])

  /** Supercluster uses `mapView`; after programmatic `flyTo` it can lag React's `viewState`. Align bbox/zoom to the camera target immediately. */
  const applyClusterViewForCamera = useCallback((lng: number, lat: number, zoom: number) => {
    const ml = mapRef.current?.getMap()
    const el = ml?.getContainer()
    const width = Math.max(200, el?.clientWidth ?? 800)
    const height = Math.max(200, el?.clientHeight ?? 600)
    const vp = new WebMercatorViewport({ longitude: lng, latitude: lat, zoom, width, height })
    const [lngA, latA] = vp.unproject([0, 0])
    const [lngB, latB] = vp.unproject([width, height])
    setMapView({
      bbox: [Math.min(lngA, lngB), Math.min(latA, latB), Math.max(lngA, lngB), Math.max(latA, latB)],
      zoom,
    })
  }, [])

  // Fit map bounds to all property points on initial load
  const fitBounds = useCallback(
    (opts?: { transitionMs?: number }) => {
      const map = mapRef.current
      if (!map || data.length === 0) return
      const duration = opts?.transitionMs ?? 0
      if (data.length === 1) {
        setViewState(prev => ({
          ...prev,
          longitude: data[0].longitude,
          latitude: data[0].latitude,
          zoom: 13,
          transitionDuration: duration,
        }))
        scheduleSyncAfterCameraChange(duration > 0 ? { animationMs: duration } : undefined)
        return
      }
      const lngs = data.map(d => d.longitude)
      const lats = data.map(d => d.latitude)
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60, duration },
      )
      scheduleSyncAfterCameraChange(duration > 0 ? { animationMs: duration } : undefined)
    },
    [data, scheduleSyncAfterCameraChange],
  )

  /** Leave property focus: clear popup state and show the full portfolio extent. */
  const exitMapSelection = useCallback(() => {
    setClusterMemberIds(null)
    setSelectedId(null)
    fitBounds({ transitionMs: 520 })
  }, [fitBounds])

  const onMapLoad = useCallback(() => {
    if (!didFitRef.current) {
      didFitRef.current = true
      fitBounds()
      return
    }
    syncViewportFromNativeMap()
  }, [fitBounds, syncViewportFromNativeMap])

  /** Sorted — pill filter order must not block refit when the visible id set changes. */
  const dataFitKey = useMemo(
    () => [...data].map(d => d.id).sort((a, b) => a - b).join(','),
    [data],
  )

  /**
   * When portfolio filters change, vis.gl react-map-libre runs `setProps` in a layout effect and may
   * `jumpTo` the last React viewState. Refit after that frame so bounds match the filtered points.
   */
  useLayoutEffect(() => {
    if (data.length === 0) return
    let cancelled = false
    const tryFit = () => {
      if (cancelled || !mapRef.current) return
      const native = mapRef.current.getMap?.()
      if (!native?.loaded?.()) return
      fitBounds({ transitionMs: 420 })
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(tryFit)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [dataFitKey, data.length, fitBounds])

  useEffect(() => {
    if (selectedId == null) return
    if (!data.some(d => d.id === selectedId)) {
      setSelectedId(null)
      setClusterMemberIds(null)
    }
  }, [data, selectedId])

  const flyTo = useCallback(
    (lng: number, lat: number) => {
      const z = 15
      applyClusterViewForCamera(lng, lat, z)
      setViewState(prev => ({
        ...prev,
        longitude: lng,
        latitude: lat,
        zoom: z,
        transitionDuration: 800,
      }))
      scheduleSyncAfterCameraChange({ animationMs: 800 })
    },
    [applyClusterViewForCamera, scheduleSyncAfterCameraChange],
  )

  const handleRowClick = useCallback((prop: PropertyWithMetrics) => {
    setClusterMemberIds(null)
    setSelectedId(prop.id)
    flyTo(prop.longitude, prop.latitude)
  }, [flyTo])

  const handleMapClick = useCallback(() => {
    if (selectedId == null && clusterMemberIds == null) return
    exitMapSelection()
  }, [exitMapSelection, selectedId, clusterMemberIds])

  const resetNorth = useCallback(() => {
    setViewState(prev => ({ ...prev, bearing: 0, pitch: 0 }))
  }, [])

  const selectedProp = selectedId != null ? data.find(d => d.id === selectedId) : null

  const animateClusterExpand = useCallback(
    (center: [number, number], clusterId: number) => {
      const z = clusterIndex.getClusterExpansionZoom(clusterId)
      const [lng, lat] = center
      applyClusterViewForCamera(lng, lat, z)
      mapRef.current?.getMap()?.easeTo({ center, zoom: z, duration: 380 })
      scheduleSyncAfterCameraChange({ animationMs: 380 })
    },
    [applyClusterViewForCamera, clusterIndex, scheduleSyncAfterCameraChange],
  )

  const handleClusterMarkerClick = useCallback(
    (d: ClusterCircle) => {
      let ids: number[] = []
      try {
        const leaves = clusterIndex.getLeaves(d.clusterId, 512, 0) as Array<{ properties?: { propId?: number } }>
        ids = [
          ...new Set(
            leaves.map(f => f.properties?.propId).filter((x): x is number => typeof x === 'number'),
          ),
        ]
      } catch {
        animateClusterExpand(d.position, d.clusterId)
        return
      }
      if (ids.length === 0) {
        animateClusterExpand(d.position, d.clusterId)
        return
      }
      const rows = ids
        .map(id => propById.get(id))
        .filter((x): x is PropertyWithMetrics => x != null)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      if (rows.length === 0) {
        animateClusterExpand(d.position, d.clusterId)
        return
      }
      setClusterMemberIds(rows.map(r => r.id))
      setSelectedId(rows[0].id)
      animateClusterExpand(d.position, d.clusterId)
      document.getElementById(`lb-row-${rows[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    [animateClusterExpand, clusterIndex, propById],
  )

  const clusterNav = useMemo(() => {
    if (clusterMemberIds == null || clusterMemberIds.length <= 1 || selectedId == null) return null
    const idx = clusterMemberIds.indexOf(selectedId)
    if (idx < 0) return null
    return { index: idx, total: clusterMemberIds.length }
  }, [clusterMemberIds, selectedId])

  const goClusterPrev = useCallback(() => {
    if (!clusterMemberIds || selectedId == null) return
    const idx = clusterMemberIds.indexOf(selectedId)
    if (idx <= 0) return
    const id = clusterMemberIds[idx - 1]
    setSelectedId(id)
    document.getElementById(`lb-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [clusterMemberIds, selectedId])

  const goClusterNext = useCallback(() => {
    if (!clusterMemberIds || selectedId == null) return
    const idx = clusterMemberIds.indexOf(selectedId)
    if (idx < 0 || idx >= clusterMemberIds.length - 1) return
    const id = clusterMemberIds[idx + 1]
    setSelectedId(id)
    document.getElementById(`lb-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [clusterMemberIds, selectedId])

  /* Deck `onClick` runs on pointer events only; ref is not read during React render. */
  /* eslint-disable react-hooks/refs */
  const clusterLayer = new ScatterplotLayer({
    id: 'clusters',
    data: clusterCircles,
    radiusUnits: 'pixels',
    getPosition: (d: ClusterCircle) => d.position,
    getRadius: (d: ClusterCircle) => clusterBubbleRadiusPx(d.pointCount),
    getFillColor: deckAccent.clusterFill,
    getLineColor: [255, 255, 255, 245],
    stroked: true,
    lineWidthMinPixels: 1.5,
    pickable: false,
  })

  const clusterLabelLayer = new TextLayer<ClusterCircle>({
    id: 'cluster-counts',
    data: clusterCircles,
    pickable: false,
    getPosition: (d: ClusterCircle) => d.position,
    getText: (d: ClusterCircle) => String(d.pointCount),
    getSize: (d: ClusterCircle) => Math.min(22, 12 + Math.sqrt(d.pointCount) * 1.35),
    sizeUnits: 'pixels',
    getColor: [255, 255, 255, 255],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
    fontWeight: 700,
    outlineWidth: 3,
    outlineColor: [26, 29, 35, 160],
  })

  /** Larger invisible disks on top of clusters so clicks are easy; picks before lower layers. */
  const clusterHitLayer = new ScatterplotLayer({
    id: 'cluster-hit',
    data: clusterCircles,
    radiusUnits: 'pixels',
    getPosition: (d: ClusterCircle) => d.position,
    getRadius: (d: ClusterCircle) => Math.max(36, Math.min(72, 22 + Math.sqrt(d.pointCount) * 7)),
    getFillColor: [255, 255, 255, 12],
    stroked: false,
    pickable: true,
    onClick: ({ object }) => {
      const d = object as ClusterCircle | undefined
      if (!d) return true
      handleClusterMarkerClick(d)
      return true
    },
  })

  const pointRadiusPx = useCallback(
    (d: PropertyWithMetrics) => {
      const pct = normalizedMap.get(d.id) ?? 50
      return 20 + (pct / 100) * 16
    },
    [normalizedMap],
  )
  const onPointClick = ({ object }: { object?: PropertyWithMetrics }) => {
    const p = object
    if (p) {
      setClusterMemberIds(null)
      setSelectedId(p.id)
      flyTo(p.longitude, p.latitude)
      document.getElementById(`lb-row-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    return true
  }
  const propertyIconLayer = markerAtlas
    ? new IconLayer({
        id: 'properties-icons',
        data: unclusteredPoints,
        pickable: true,
        iconAtlas: markerAtlas,
        iconMapping: {
          marker: { x: 0, y: 0, width: 64, height: 64, mask: true },
        },
        getIcon: () => 'marker',
        sizeUnits: 'pixels',
        getPosition: (d: PropertyWithMetrics) => [d.longitude, d.latitude],
        getSize: pointRadiusPx,
        getColor: (d: PropertyWithMetrics) =>
          d.id === selectedId ? deckAccent.iconSelected : deckAccent.icon,
        sizeMinPixels: 20,
        sizeMaxPixels: 40,
        onClick: onPointClick,
        updateTriggers: {
          getColor: [selectedId, accentRev],
          getSize: [selectedMetric],
        },
      })
    : new ScatterplotLayer({
        id: 'properties-icons',
        data: unclusteredPoints,
        pickable: true,
        radiusUnits: 'pixels',
        getPosition: (d: PropertyWithMetrics) => [d.longitude, d.latitude],
        getRadius: pointRadiusPx,
        radiusMinPixels: 20,
        radiusMaxPixels: 40,
        getFillColor: (d: PropertyWithMetrics) =>
          d.id === selectedId ? deckAccent.pointFillSelected : deckAccent.pointFill,
        getLineColor: (d: PropertyWithMetrics) =>
          d.id === selectedId ? deckAccent.pointLineSelected : [255, 255, 255, 200],
        stroked: true,
        lineWidthMinPixels: 1.5,
        onClick: onPointClick,
        updateTriggers: {
          getFillColor: [selectedId, accentRev],
          getLineColor: [selectedId, accentRev],
          getRadius: [selectedMetric],
        },
      })
  /* eslint-enable react-hooks/refs */

  // Alert: filter properties that trigger any critical rule
  const alertData = useMemo(() => {
    return data.filter(p => hasCriticalAlert(alertRuleConfig, alertMetrics(p)))
  }, [data, alertRuleConfig])

  const alertIds = useMemo(() => new Set(alertData.map(d => d.id)), [alertData])

  /** One ring per map cluster that contains critical alerts (cluster-sized), or per unclustered alert (marker-sized, scales when selected). */
  const alertPulseData = useMemo((): AlertPulseDatum[] => {
    if (!alertOn || alertData.length === 0) return []
    const alertIdSet = new Set(alertData.map(d => d.id))
    const covered = new Set<number>()
    const items: AlertPulseDatum[] = []

    for (const c of clusterCircles) {
      const propsInCluster: PropertyWithMetrics[] = []
      try {
        const leaves = clusterIndex.getLeaves(c.clusterId, 256, 0) as Array<{ properties?: { propId?: number } }>
        for (const f of leaves) {
          const id = f.properties?.propId
          if (id != null && alertIdSet.has(id)) {
            const row = propById.get(id)
            if (row) propsInCluster.push(row)
          }
        }
      } catch {
        continue
      }
      if (propsInCluster.length === 0) continue
      for (const p of propsInCluster) covered.add(p.id)
      const bubbleR = clusterBubbleRadiusPx(c.pointCount)
      const color = firstCriticalPulseColor(alertRuleConfig, alertMetrics(propsInCluster[0]))
      items.push({
        position: c.position,
        color,
        basePx: bubbleR * 1.05,
      })
    }

    for (const p of alertData) {
      if (covered.has(p.id)) continue
      const selectedBoost = selectedId === p.id ? 1.42 : 1
      items.push({
        position: [p.longitude, p.latitude],
        color: firstCriticalPulseColor(alertRuleConfig, alertMetrics(p)),
        basePx: pointRadiusPx(p) * selectedBoost,
      })
    }
    return items
  }, [
    alertOn,
    alertData,
    alertRuleConfig,
    clusterCircles,
    clusterIndex,
    propById,
    selectedId,
    pointRadiusPx,
  ])

  // Build alert notifications: one row per (property, matching rule)
  const alertNotifications = useMemo(() => {
    const items: { prop: PropertyWithMetrics; match: EvaluatedAlertMatch }[] = []
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
    for (const p of data) {
      for (const m of evaluatePropertyAlerts(alertRuleConfig, alertMetrics(p))) {
        items.push({ prop: p, match: m })
      }
    }
    return items.sort((a, b) => order[a.match.severity] - order[b.match.severity])
  }, [data, alertRuleConfig])

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

  // Pulsating ring layer (pixel radii tied to cluster bubble or property marker; draw above clusters)
  const pulseLayer = useMemo(() => {
    if (!alertOn || alertPulseData.length === 0) return null
    const cycle = (pulseTime % 2000) / 2000 // 0→1 over 2s
    return new ScatterplotLayer<AlertPulseDatum>({
      id: 'alert-pulse',
      data: alertPulseData,
      radiusUnits: 'pixels',
      getPosition: d => d.position,
      getRadius: d => d.basePx * (0.72 + cycle * 2.15),
      getFillColor: d => [...d.color, Math.round((1 - cycle) * 78)] as [number, number, number, number],
      getLineColor: d => [...d.color, Math.round((1 - cycle) * 175)] as [number, number, number, number],
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: false,
      updateTriggers: {
        getRadius: [pulseTime],
        getFillColor: [pulseTime],
        getLineColor: [pulseTime],
      },
    })
  }, [alertOn, alertPulseData, pulseTime])

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState as typeof viewState)
    const map = evt.target as { getBounds: () => { getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number }; getZoom: () => number }
    const b = map.getBounds()
    setMapView({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() })
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
                    <span className="lb-row-value">{formatMetricValue(selectedMetric, prop[selectedMetric], displayCurrency)}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="lb-map-control-btn"
                  onClick={() => setRulesModalOpen(true)}
                  title="Alert rules"
                >
                  <svg width="16" height="19" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M16.013 20H15.987C14.13 20.006 12.57 21.28 12.126 23H1C0.448 23 0 23.448 0 24C0 24.552 0.448 25 1 25H12.126C12.571 26.724 14.138 28 16 28H16.013C17.87 27.994 19.43 26.72 19.874 25H23H23.006C23.555 24.997 24 24.55 24 24C24 23.448 23.552 23 23 23H19.874C19.43 21.28 17.87 20.006 16.013 20ZM16 22H16.013C17.111 22.007 18 22.9 18 24C18 25.1 17.111 25.993 16.013 26H16C14.896 26 14 25.104 14 24C14 22.896 14.896 22 16 22ZM4.126 13H1C0.448 13 0 13.448 0 14C0 14.552 0.448 15 1 15H4.126C4.571 16.724 6.138 18 8 18C9.862 18 11.429 16.724 11.874 15H23C23.552 15 24 14.552 24 14C24 13.448 23.552 13 23 13H11.874C11.429 11.276 9.862 10 8 10C6.138 10 4.571 11.276 4.126 13ZM8 12C9.104 12 10 12.896 10 14C10 15.104 9.104 16 8 16C6.896 16 6 15.104 6 14C6 12.896 6.896 12 8 12ZM16.013 0H15.987C14.13 0.006 12.57 1.28 12.126 3H1C0.448 3 0 3.448 0 4C0 4.552 0.448 5 1 5H12.126C12.571 6.724 14.138 8 16 8H16.013C17.87 7.994 19.43 6.72 19.874 5H23H23.006C23.555 4.997 24 4.55 24 4C24 3.448 23.552 3 23 3H19.874C19.43 1.28 17.87 0.006 16.013 0ZM16 2H16.013C17.111 2.007 18 2.9 18 4C18 5.1 17.111 5.993 16.013 6H16C14.896 6 14 5.104 14 4C14 2.896 14.896 2 16 2Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
                <button
                  className={`lb-map-control-btn${alertOn ? ' active' : ''}`}
                  onClick={() => setAlertOn(prev => !prev)}
                  title={alertOn ? 'Disable alerts' : 'Enable alerts'}
                >
                  <img src={alertOn ? '/Alert - On.svg' : '/Alert - Off.svg'} alt="Alert toggle" width="16" height="16" />
                </button>
              </div>
            </div>
            <div className="lb-list">
              {alertNotifications.filter(a => (severityFilter === 'all' || a.match.severity === severityFilter) && (selectedId == null || a.prop.id === selectedId)).length === 0 ? (
                <div className="lb-alerts-empty">No active alerts</div>
              ) : (
                alertNotifications
                  .filter(a => (severityFilter === 'all' || a.match.severity === severityFilter) && (selectedId == null || a.prop.id === selectedId))
                  .map(({ prop, match }) => (
                    <div
                      key={`${prop.id}-${match.userRuleId}`}
                      className={`lb-alert-item lb-alert-${match.severity}`}
                      onClick={() => handleRowClick(prop)}
                    >
                      <div className="lb-alert-severity-bar" />
                      <div className="lb-alert-content">
                        <div className="lb-alert-name">{prop.name}</div>
                        <div className="lb-alert-desc">{match.describe}</div>
                      </div>
                      <span className={`lb-alert-badge lb-alert-badge-${match.severity}`}>{match.label}</span>
                    </div>
                  ))
              )}
            </div>
          </>
        )}
        {rulesModalOpen && (
          <AlertRulesModal
            config={alertRuleConfig}
            onSave={(c) => {
              setAlertRuleConfig(c)
              saveAlertRuleConfig(c)
            }}
            onClose={() => setRulesModalOpen(false)}
          />
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

        >
          <DeckGLOverlay
            layers={
              pulseLayer
                ? [clusterLayer, clusterLabelLayer, pulseLayer, clusterHitLayer, propertyIconLayer]
                : [clusterLayer, clusterLabelLayer, clusterHitLayer, propertyIconLayer]
            }
          />
        </Map>

        {/* Map controls */}
        <div className="lb-map-controls">
          <button className="lb-map-control-btn" onClick={() => fitBounds()} title="Zoom to all properties">
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
                <span className={`lb-popup-badge${selectedProp.vacant ? ' vacant' : ''}`}>
                  {selectedProp.vacant ? 'Vacant' : selectedProp.monthsLeft != null ? `Rented · ${selectedProp.monthsLeft}mo left` : 'Rented'}
                </span>
              </div>
              <button type="button" className="lb-popup-close" onClick={exitMapSelection}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            </div>

            {clusterMemberIds != null && clusterMemberIds.length > 1 && (
              <>
                <div className="lb-popup-cluster-banner">
                  {clusterMemberIds.length} properties at this map location
                </div>
                {clusterNav != null && (
                  <div className="lb-popup-cluster-nav">
                    <button
                      type="button"
                      className="lb-popup-cluster-arrow"
                      onClick={e => {
                        e.stopPropagation()
                        goClusterPrev()
                      }}
                      disabled={clusterNav.index === 0}
                      aria-label="Previous property in cluster"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 3L5 8l5 5" />
                      </svg>
                    </button>
                    <span className="lb-popup-cluster-position">
                      {clusterNav.index + 1} of {clusterNav.total}
                    </span>
                    <button
                      type="button"
                      className="lb-popup-cluster-arrow"
                      onClick={e => {
                        e.stopPropagation()
                        goClusterNext()
                      }}
                      disabled={clusterNav.index >= clusterNav.total - 1}
                      aria-label="Next property in cluster"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3l5 5-5 5" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="lb-popup-tabs">
              <button className={`lb-popup-tab${popupTab === 'financial' ? ' active' : ''}`} onClick={() => setPopupTab('financial')}>Financial</button>
              <button className={`lb-popup-tab${popupTab === 'details' ? ' active' : ''}`} onClick={() => setPopupTab('details')}>Details</button>
            </div>

            {popupTab === 'financial' ? (
              <div className="lb-popup-metrics">
                <div className="lb-popup-row">
                  <span className="lb-popup-label">Rent</span>
                  <span className="lb-popup-val">{formatMetricValue('rent', selectedProp.rent, displayCurrency)}</span>
                </div>
                <div className="lb-popup-row">
                  <span className="lb-popup-label">Monthly Income</span>
                  <span className="lb-popup-val">{formatMetricValue('monthlyIncome', selectedProp.monthlyIncome, displayCurrency)}</span>
                </div>
                <div className="lb-popup-row">
                  <span className="lb-popup-label">GPI</span>
                  <span className="lb-popup-val">{formatMetricValue('rent', selectedProp.annual.gpi, displayCurrency)}</span>
                </div>
                <div className="lb-popup-row">
                  <span className="lb-popup-label">EGI</span>
                  <span className="lb-popup-val">{formatMetricValue('rent', selectedProp.annual.egi, displayCurrency)}</span>
                </div>
                <div className="lb-popup-row">
                  <span className="lb-popup-label">OPEX</span>
                  <span className="lb-popup-val">{formatMetricValue('rent', selectedProp.annual.totalOpex, displayCurrency)}</span>
                </div>
                <div className="lb-popup-row">
                  <span className="lb-popup-label">NOI</span>
                  <span className="lb-popup-val">{formatMetricValue('noi', selectedProp.annual.noi, displayCurrency)}</span>
                </div>
                <div className="lb-popup-row">
                  <span className="lb-popup-label">Net CF</span>
                  <span className="lb-popup-val">{formatMetricValue('netCf', selectedProp.annual.netCf, displayCurrency)}</span>
                </div>
              </div>
            ) : (
              <div className="lb-popup-metrics">
                {selectedProp.propertyType && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Type</span>
                    <span className="lb-popup-val">{selectedProp.propertyType}</span>
                  </div>
                )}
                <div className="lb-popup-row">
                  <span className="lb-popup-label">Area</span>
                  <span className="lb-popup-val">{selectedProp.area.toLocaleString()} m²</span>
                </div>
                {selectedProp.bedrooms > 0 && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Bedrooms</span>
                    <span className="lb-popup-val">{selectedProp.bedrooms}</span>
                  </div>
                )}
                {selectedProp.bathrooms > 0 && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Bathrooms</span>
                    <span className="lb-popup-val">{selectedProp.bathrooms}</span>
                  </div>
                )}
                {selectedProp.parking > 0 && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Parking</span>
                    <span className="lb-popup-val">{selectedProp.parking}</span>
                  </div>
                )}
                {selectedProp.storageUnits > 0 && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Storage</span>
                    <span className="lb-popup-val">{selectedProp.storageUnits}</span>
                  </div>
                )}
                {selectedProp.floors > 0 && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Floors</span>
                    <span className="lb-popup-val">{selectedProp.floors}</span>
                  </div>
                )}
                {selectedProp.terrace > 0 && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Terrace</span>
                    <span className="lb-popup-val">{selectedProp.terrace} m²</span>
                  </div>
                )}
                {selectedProp.balcony > 0 && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Balcony</span>
                    <span className="lb-popup-val">{selectedProp.balcony} m²</span>
                  </div>
                )}
                {selectedProp.concierge && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Concierge</span>
                    <span className="lb-popup-val">Yes</span>
                  </div>
                )}
                {selectedProp.yearBuilt != null && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Year built</span>
                    <span className="lb-popup-val">{selectedProp.yearBuilt}</span>
                  </div>
                )}
                {selectedProp.estrato != null && (
                  <div className="lb-popup-row">
                    <span className="lb-popup-label">Estrato</span>
                    <span className="lb-popup-val">{selectedProp.estrato}</span>
                  </div>
                )}
              </div>
            )}

            <button className="lb-popup-detail-btn" onClick={() => onSelectProperty(selectedProp.id)}>
              View details
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
