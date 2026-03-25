import { useState } from 'react'
import type { Property } from '../../lib/types'
import { parseNum } from '../../lib/format'

type Props = {
  onSave: (p: Property) => void
  onClose: () => void
}

export function AddPropertyModal({ onSave, onClose }: Props) {
  const [form, setForm] = useState({
    owner: '',
    name: '',
    address: '',
    neighbourhood: '',
    city: '',
    area: '',
    bedrooms: '',
    bathrooms: '',
    parking: '',
    storageUnits: '',
    concierge: false,
    terrace: '',
    balcony: '',
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
    if (missing.length) {
      setError(`Missing required fields: ${missing.join(', ')}`)
      return
    }
    const rent = parseNum(form.monthlyRent)
    onSave({
      id: Date.now(),
      owner: form.owner,
      name: form.name,
      address: form.address,
      neighbourhood: form.neighbourhood,
      city: form.city,
      area: parseNum(form.area),
      bedrooms: parseNum(form.bedrooms),
      bathrooms: parseNum(form.bathrooms),
      parking: parseNum(form.parking),
      storageUnits: parseNum(form.storageUnits),
      concierge: form.concierge,
      terrace: parseNum(form.terrace),
      balcony: parseNum(form.balcony),
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
        propertyType: '',
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
          <div className="contract-grid">
            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>Property owner</label>
              <input placeholder="Juan Pérez" value={form.owner} onChange={(e) => set('owner', e.target.value)} />
            </div>
            <div className="field">
              <label>Unit name *</label>
              <input placeholder="Apto 104" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Address</label>
              <input placeholder="Calle 78 #5-32" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div className="field">
              <label>Neighbourhood</label>
              <input placeholder="Chicó" value={form.neighbourhood} onChange={(e) => set('neighbourhood', e.target.value)} />
            </div>
            <div className="field">
              <label>City</label>
              <input placeholder="Bogotá" value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="divider" style={{ gridColumn: '1/-1' }} />
            <div className="field">
              <label>Area (m²)</label>
              <input type="number" placeholder="133" value={form.area} onChange={(e) => set('area', e.target.value)} />
            </div>
            <div className="field">
              <label>Bedrooms</label>
              <input type="number" placeholder="3" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
            </div>
            <div className="field">
              <label>Bathrooms</label>
              <input type="number" placeholder="3" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
            </div>
            <div className="field">
              <label>Parking</label>
              <input type="number" placeholder="2" value={form.parking} onChange={(e) => set('parking', e.target.value)} />
            </div>
            <div className="field">
              <label>Storage units</label>
              <input type="number" placeholder="1" value={form.storageUnits} onChange={(e) => set('storageUnits', e.target.value)} />
            </div>
            <div className="field">
              <label>Concierge</label>
              <select value={form.concierge ? 'yes' : 'no'} onChange={(e) => set('concierge', e.target.value === 'yes')}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div className="field">
              <label>Terrace (m²)</label>
              <input type="number" placeholder="0" value={form.terrace} onChange={(e) => set('terrace', e.target.value)} />
            </div>
            <div className="field">
              <label>Balcony</label>
              <input type="number" placeholder="1" value={form.balcony} onChange={(e) => set('balcony', e.target.value)} />
            </div>
            <div className="divider" style={{ gridColumn: '1/-1' }} />
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Tenant (optional)</label>
              <input type="text" value={form.tenant} onChange={(e) => set('tenant', e.target.value)} />
            </div>
            <div className="field">
              <label>Monthly rent</label>
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
              <label>Admin fee</label>
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
