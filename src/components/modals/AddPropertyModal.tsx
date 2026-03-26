import { useState, useRef, useEffect } from 'react'
import type { Property } from '../../lib/types'
import { type CurrencyCode, CURRENCIES, CURRENCY_LIST, flagUrl } from '../../lib/currency'
import { COUNTRIES, countryFlagUrl } from '../../lib/countries'
import { parseNum } from '../../lib/format'

type Props = {
  onSave: (p: Property) => void
  onClose: () => void
}

function CurrencySelect({ value, onChange }: { value: CurrencyCode | ''; onChange: (c: CurrencyCode) => void }) {
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

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '9px 32px 9px 12px', fontSize: 15,
          background: '#f7f9fc', border: '1px solid #e8ecf2', borderRadius: 10,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          textAlign: 'left', position: 'relative',
          color: value ? '#1a1d23' : '#9ca3af',
        }}
      >
        {value ? (
          <img src={flagUrl(value, 40)} alt="" width={22} height={16} style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <span style={{ width: 22, height: 16, flexShrink: 0 }} aria-hidden />
        )}
        <span style={{ fontWeight: 500 }}>{value || 'Select currency...'}</span>
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
            {filtered.map(code => {
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
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

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

const PROPERTY_TYPES = ['Apartment', 'House', 'Studio', 'Penthouse', 'Office', 'Commercial', 'Lot', 'Other'] as const

export function AddPropertyModal({ onSave, onClose }: Props) {
  const [form, setForm] = useState({
    owner: '',
    name: '',
    propertyType: '',
    address: '',
    city: '',
    country: '',
    currency: 'USD' as CurrencyCode,
    area: '',
    bedrooms: '',
    tenant: '',
    monthlyRent: '',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    adminFee: '',
  })

  const [error, setError] = useState('')

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
    setError('')
  }

  const save = () => {
    const missing: string[] = []
    if (!form.name.trim()) missing.push('Unit name')
    if (!form.currency) missing.push('Currency')
    if (missing.length) {
      setError(`Missing required fields: ${missing.join(', ')}`)
      return
    }
    const currency = form.currency
    const rent = parseNum(form.monthlyRent)
    onSave({
      id: Date.now(),
      owner: form.owner,
      name: form.name,
      address: form.address,
      neighbourhood: '',
      city: form.city,
      country: form.country,
      currency,
      area: parseNum(form.area),
      bedrooms: parseNum(form.bedrooms),
      bathrooms: 0,
      parking: 0,
      storageUnits: 0,
      concierge: false,
      terrace: 0,
      balcony: 0,
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
        purchaseDate: '',
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
            <div className="modal-sub">Unit details and first contract</div>
          </div>
          <button type="button" className="ghost" onClick={onClose} style={{ fontSize: '18px', padding: '4px 8px' }}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {/* ── Owner ── */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Owner</div>
          <div className="contract-grid" style={{ marginBottom: 0 }}>
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Property owner</label>
              <input placeholder="Juan Pérez" value={form.owner} onChange={(e) => set('owner', e.target.value)} />
            </div>
          </div>

          <div className="divider" style={{ margin: '16px 0' }} />

          {/* ── Location ── */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Location</div>
          <div className="contract-grid" style={{ marginBottom: 0 }}>
            <div className="field">
              <label>Unit name *</label>
              <input placeholder="Apto 104" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Address</label>
              <input placeholder="Calle 78 #5-32" value={form.address} onChange={(e) => set('address', e.target.value)} />
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
            <div className="field">
              <label>Bedrooms</label>
              <input type="number" placeholder="3" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
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
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={save}>
              Add property
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
