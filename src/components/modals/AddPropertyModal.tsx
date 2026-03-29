import { useState, useRef, useEffect, useCallback } from 'react'
import type { Property } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { CurrencySelect } from '../CurrencySelect'
import { COUNTRIES, countryFlagUrl } from '../../lib/countries'
import { parseNum } from '../../lib/format'
import { PROPERTY_TYPES } from '../../lib/constants'
import Map, { Marker, type MapRef, type ViewStateChangeEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

type Props = {
  onSave: (p: Property) => void
  onClose: () => void
}

const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

  const filtered = COUNTRIES.filter(c => {
    if (!search) return true
    return c.name.toLowerCase().includes(search.toLowerCase())
  })

  const selected = COUNTRIES.find(c => c.name === value)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '9px 32px 9px 12px', fontSize: 15,
          background: '#f7f9fc', border: '1px solid #e8ecf2', borderRadius: 10,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          textAlign: 'left', position: 'relative', color: value ? '#1a1d23' : '#9ca3af',
        }}
      >
        {selected && <img src={countryFlagUrl(selected.code, 40)} alt="" width={22} height={16} style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />}
        <span>{value || 'Select country...'}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ position: 'absolute', right: 12, top: '50%', transform: `translateY(-50%)${open ? ' rotate(180deg)' : ''}`, transition: 'transform 0.15s ease' }}>
          <path d="M1 1l4 4 4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4,
          background: '#fff', border: '1px solid #e8ecf2', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50,
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
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                className="ghost"
                onClick={() => { onChange(c.name); setOpen(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 14px',
                  display: 'flex', alignItems: 'center', gap: 10, borderRadius: 0,
                  background: value === c.name ? '#f0f5ff' : undefined,
                }}
              >
                <img src={countryFlagUrl(c.code, 40)} alt="" width={22} height={16} style={{ borderRadius: 3, objectFit: 'cover' }} />
                <span style={{ fontSize: 13, color: '#374151' }}>{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Pin icon SVG ── */
const PinIcon = () => (
  <svg width="28" height="40" viewBox="0 0 28 40" fill="none">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="#3b82f6"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
  </svg>
)

export function AddPropertyModal({ onSave, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState({
    owner: '',
    name: '',
    propertyType: '',
    address: '',
    city: '',
    country: '',
    currency: 'USD' as CurrencyCode,
    area: '',
    tenant: '',
    monthlyRent: '',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    adminFee: '',
  })
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [viewState, setViewState] = useState({
    longitude: -74.08,
    latitude: 4.65,
    zoom: 3,
    bearing: 0,
    pitch: 0,
  })
  const mapRef = useRef<MapRef>(null)

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
    setError('')
  }

  const goToStep2 = () => {
    const missing: string[] = []
    if (!form.name.trim()) missing.push('Unit name')
    if (!form.currency) missing.push('Currency')
    if (missing.length) {
      setError(`Missing required fields: ${missing.join(', ')}`)
      return
    }
    // Pre-fill search query from address + city
    const parts = [form.address, form.city, form.country].filter(Boolean)
    setSearchQuery(parts.join(', '))
    setStep(2)
  }

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: searchQuery.trim(), format: 'json', limit: '1' })
      const res = await fetch(`${NOMINATIM_URL}?${params}`)
      const data = await res.json()
      if (data.length > 0) {
        const { lat, lon } = data[0]
        const latNum = parseFloat(lat)
        const lngNum = parseFloat(lon)
        setPin({ lat: latNum, lng: lngNum })
        setViewState(prev => ({ ...prev, longitude: lngNum, latitude: latNum, zoom: 15 }))
      }
    } catch {
      // Nominatim lookup failed — user can still click to place pin
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  const handleMapClick = useCallback((e: { lngLat: { lng: number; lat: number } }) => {
    setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })
  }, [])

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState as typeof viewState)
  }, [])

  const save = () => {
    const currency = form.currency
    const rent = parseNum(form.monthlyRent)
    onSave({
      id: Date.now(),
      owner: form.owner,
      name: form.name,
      address: form.address,
      neighbourhood: '',
      city: form.city,
      postalCode: '',
      country: form.country,
      currency,
      latitude: pin?.lat,
      longitude: pin?.lng,
      area: parseNum(form.area),
      bedrooms: 0,
      bathrooms: 0,
      parking: 0,
      storageUnits: 0,
      concierge: false,
      terrace: 0,
      balcony: 0,
      floors: 0,
      year: 2026,
      contracts: form.tenant
        ? [
            {
              id: Date.now() + 1,
              status: 'active' as const,
              tenant: form.tenant,
              contractManager: '',
              monthlyRent: rent,
              startDate: form.startDate,
              endDate: form.endDate,
              paymentDay: 1,
              deposit: 2,
              increment: 'ipc+',
              ipcExtra: 1,
              adminFee: parseNum(form.adminFee),
              notes: '',
            },
          ]
        : [],
      months: {},
      capex: [],
      taxes: { items: [] },
      factSheet: {
        propertyType: form.propertyType,
        estrato: null,
        yearBuilt: null,
        lastRenovation: null,
        floor: null,
        matriculaInmobiliaria: '',
        cedulaCatastral: '',
        chip: '',
        customId: '',
        purchasePrice: null,
        purchaseDate: form.startDate,
        currentValue: null,
        valuationDate: '',
        photos: [],
        contacts: form.owner.trim()
          ? [{ id: Date.now() + 2, name: form.owner.trim(), role: 'Owner', phone: '', email: '' }]
          : [],
        notes: '',
      },
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Add property</div>
            <div className="modal-sub">{step === 1 ? 'Unit details and first contract' : 'Pin location on the map'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Step indicators */}
            <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: step === 2 ? '#3b82f6' : '#e8ecf2' }} />
            </div>
            <button type="button" className="ghost" onClick={onClose} style={{ fontSize: '18px', padding: '4px 8px' }}>
              ×
            </button>
          </div>
        </div>

        {step === 1 ? (
          <>
            <div className="modal-body">
              {/* ── Unit name & Owner ── */}
              <div className="contract-grid" style={{ marginBottom: 0 }}>
                <div className="field">
                  <label>Unit name *</label>
                  <input placeholder="Apto 104" value={form.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div className="field">
                  <label>Property owner</label>
                  <input placeholder="Juan Pérez" value={form.owner} onChange={(e) => set('owner', e.target.value)} />
                </div>
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />

              {/* ── Location ── */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Location</div>
              <div className="contract-grid" style={{ marginBottom: 0 }}>
                <div className="field" style={{ gridColumn: 'span 2' }}>
                  <label>Address</label>
                  <input placeholder="Carrera 15 #93-42" value={form.address} onChange={(e) => set('address', e.target.value)} />
                </div>
                <div className="field">
                  <label>City</label>
                  <input placeholder="Bogotá" value={form.city} onChange={(e) => set('city', e.target.value)} />
                </div>
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />

              {/* ── Country & currency ── */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Country & currency</div>
              <div className="contract-grid" style={{ marginBottom: 0 }}>
                <div className="field">
                  <label>Country</label>
                  <CountrySelect value={form.country} onChange={(v) => set('country', v)} />
                </div>
                <div className="field">
                  <label>Currency *</label>
                  <CurrencySelect value={form.currency} onChange={(c) => set('currency', c)} />
                </div>
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />

              {/* ── Spatial features ── */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Spatial features</div>
              <div className="contract-grid" style={{ marginBottom: 0 }}>
                <div className="field">
                  <label>Property type</label>
                  <select value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
                    <option value="">Select...</option>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Area (m²)</label>
                  <input type="number" placeholder="133" value={form.area} onChange={(e) => set('area', e.target.value)} />
                </div>
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />

              {/* ── Contract ── */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Contract (optional)</div>
              <div className="contract-grid" style={{ marginBottom: 0 }}>
                <div className="field" style={{ gridColumn: 'span 2' }}>
                  <label>Tenant</label>
                  <input type="text" value={form.tenant} onChange={(e) => set('tenant', e.target.value)} />
                </div>
                <div className="field">
                  <label>Monthly rent ({form.currency})</label>
                  <input type="text" value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} placeholder="1,800,000" />
                </div>
                <div className="field">
                  <label>Start date</label>
                  <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
                </div>
                <div className="field">
                  <label>End date</label>
                  <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
                </div>
                <div className="field">
                  <label>Admin fee ({form.currency})</label>
                  <input type="text" value={form.adminFee} onChange={(e) => set('adminFee', e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {error && (
                <div style={{ color: '#b91c1c', fontSize: 13, fontWeight: 500 }}>{error}</div>
              )}
              {!error && <span />}
              <div className="flex gap8">
                <button type="button" onClick={onClose}>Cancel</button>
                <button type="button" className="primary" onClick={goToStep2}>Continue</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="modal-body" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Search bar */}
              <div style={{ display: 'flex', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                  placeholder="Search address..."
                  style={{
                    flex: 1, padding: '9px 14px', fontSize: 14,
                    background: '#f7f9fc', border: '1px solid #e8ecf2', borderRadius: 10,
                  }}
                />
                <button
                  type="button"
                  className="primary"
                  onClick={handleSearch}
                  disabled={searching}
                  style={{ padding: '9px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Map */}
              <div style={{ height: 400, position: 'relative' }}>
                <Map
                  ref={mapRef as React.Ref<MapRef>}
                  {...viewState}
                  onMove={handleMove}
                  onClick={handleMapClick}
                  mapStyle={CARTO_STYLE}
                  style={{ width: '100%', height: '100%' }}
                  cursor="crosshair"
                  attributionControl={false}
                >
                  {pin && (
                    <Marker
                      latitude={pin.lat}
                      longitude={pin.lng}
                      anchor="bottom"
                      draggable
                      onDragEnd={(e) => setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
                    >
                      <PinIcon />
                    </Marker>
                  )}
                </Map>

                {/* Coordinates display */}
                {pin && (
                  <div style={{
                    position: 'absolute', bottom: 12, left: 12,
                    background: 'rgba(255,255,255,0.95)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500,
                    color: 'var(--text2)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}>
                    {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                  </div>
                )}

                {/* Hint */}
                <div style={{
                  position: 'absolute', top: 12, left: 12,
                  background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: '6px 14px',
                  fontSize: 12, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}>
                  {pin ? 'Drag pin or click to reposition' : 'Click the map to place a pin'}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setStep(1)}>
                ← Back
              </button>
              <div className="flex gap8">
                {pin && (
                  <button type="button" onClick={() => setPin(null)} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                    Remove pin
                  </button>
                )}
                <button type="button" className="primary" onClick={save}>
                  {pin ? 'Add property' : 'Skip & add property'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
