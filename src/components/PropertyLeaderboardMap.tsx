import { useState, useMemo, useCallback, useRef, useEffect, type Ref } from 'react'
import Map, { type ViewStateChangeEvent, type MapRef } from 'react-map-gl/maplibre'
import { DeckGLOverlay } from './DeckGLOverlay'
import { ScatterplotLayer, IconLayer, TextLayer, WebMercatorViewport } from 'deck.gl'
import Supercluster from 'supercluster'
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

/** Design token: primary blue (`#0539FF`) */
const PRIMARY_BLUE: [number, number, number, number] = [5, 57, 255, 255]

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
  /** Property ids grouped when user clicks a map cluster (supercluster); enables "2 of 3" popup navigation. */
  const [clusterMemberIds, setClusterMemberIds] = useState<number[] | null>(null)
  const [alertOn, setAlertOn] = useState(false)
  const [panelTab, setPanelTab] = useState<'list' | 'alerts'>('list')
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
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

  // Re-fit bounds when filtered data changes
  const dataKey = useMemo(() => data.map(d => d.id).join(','), [data])
  useEffect(() => {
    if (didFitRef.current) fitBounds()
  }, [dataKey, fitBounds])

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
    getRadius: (d: ClusterCircle) => Math.min(46, 14 + Math.sqrt(d.pointCount) * 5),
    getFillColor: [PRIMARY_BLUE[0], PRIMARY_BLUE[1], PRIMARY_BLUE[2], 236],
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

  const pointRadius = (d: PropertyWithMetrics) => {
    const pct = normalizedMap.get(d.id) ?? 50
    return 20 + (pct / 100) * 16
  }
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
        getSize: pointRadius,
        getColor: (d: PropertyWithMetrics) =>
          d.id === selectedId ? [41, 204, 151, 255] : PRIMARY_BLUE,
        sizeMinPixels: 20,
        sizeMaxPixels: 40,
        onClick: onPointClick,
        updateTriggers: {
          getColor: [selectedId],
          getSize: [selectedMetric],
        },
      })
    : new ScatterplotLayer({
        id: 'properties-icons',
        data: unclusteredPoints,
        pickable: true,
        radiusUnits: 'pixels',
        getPosition: (d: PropertyWithMetrics) => [d.longitude, d.latitude],
        getRadius: pointRadius,
        radiusMinPixels: 20,
        radiusMaxPixels: 40,
        getFillColor: (d: PropertyWithMetrics) =>
          d.id === selectedId ? [41, 204, 151, 220] : [5, 57, 255, 210],
        getLineColor: (d: PropertyWithMetrics) =>
          d.id === selectedId ? [41, 204, 151, 255] : [255, 255, 255, 200],
        stroked: true,
        lineWidthMinPixels: 1.5,
        onClick: onPointClick,
        updateTriggers: {
          getFillColor: [selectedId],
          getLineColor: [selectedId],
          getRadius: [selectedMetric],
        },
      })
  /* eslint-enable react-hooks/refs */

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

        >
          <DeckGLOverlay
            layers={
              pulseLayer
                ? [pulseLayer, clusterLayer, clusterLabelLayer, clusterHitLayer, propertyIconLayer]
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
