import { useState, useCallback } from 'react'
import type { Property, ServiceEntry } from '../../lib/types'
import { fmt } from '../../lib/format'

const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
)
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4"/></svg>
)

const SERVICE_TYPES = ['Admin', 'Electricity', 'Water', 'Gas', 'Internet', 'TV', 'Phone', 'Insurance', 'Cleaning', 'Security', 'Management Fee', 'Broker Fee', 'Other'] as const

const SERVICE_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Admin:       { bg: '#f3e8ff', color: '#7c3aed' },
  Electricity: { bg: '#fef9c3', color: '#a16207' },
  Water:       { bg: '#dbeafe', color: '#2563eb' },
  Gas:         { bg: '#ffedd5', color: '#c2410c' },
  Internet:    { bg: '#e0e7ff', color: '#4338ca' },
  TV:          { bg: '#fce7f3', color: '#be185d' },
  Phone:       { bg: '#d1fae5', color: '#047857' },
  Insurance:   { bg: '#fee2e2', color: '#b91c1c' },
  Cleaning:    { bg: '#ccfbf1', color: '#0f766e' },
  Security:        { bg: '#f1f5f9', color: '#475569' },
  'Management Fee': { bg: '#fef3c7', color: '#92400e' },
  'Broker Fee':     { bg: '#ede9fe', color: '#6d28d9' },
  Other:           { bg: '#f3f4f6', color: '#6b7280' },
}

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
}

/** Find the closest year that has at least one service entry */
function nearestYear(all: Record<number, ServiceEntry[]>, year: number): number | null {
  const years = Object.keys(all)
    .map(Number)
    .filter((y) => y !== year && (all[y]?.length ?? 0) > 0)
  if (years.length === 0) return null
  years.sort((a, b) => Math.abs(a - year) - Math.abs(b - year))
  return years[0]
}

export function ServicesTab({ prop, onUpdateProp }: Props) {
  const all = prop.services ?? {}
  const own = all[prop.year]
  const hasOwn = own !== undefined
  const sourceYear = !hasOwn ? nearestYear(all, prop.year) : null
  const inherited = !hasOwn && sourceYear !== null
  const services: ServiceEntry[] = hasOwn ? own : sourceYear !== null ? all[sourceYear] : []

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    provider: '',
    type: 'Electricity' as string,
    accountNumber: '',
    monthlyCost: '',
    notes: '',
  })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
  }

  /** Clone inherited entries into the current year, returning the base array */
  const cloneInherited = (p: Property): ServiceEntry[] => {
    const a = p.services ?? {}
    const src = nearestYear(a, p.year)
    if (src === null) return []
    return a[src].map((s) => ({ ...s, id: Date.now() + Math.random() }))
  }

  const resetForm = () => {
    setForm({ provider: '', type: 'Electricity', accountNumber: '', monthlyCost: '', notes: '' })
    setShowForm(false)
    setEditingId(null)
  }

  const addService = () => {
    if (!form.provider.trim()) return
    const entry: ServiceEntry = {
      id: Date.now(),
      provider: form.provider.trim(),
      type: form.type,
      accountNumber: form.accountNumber.trim(),
      monthlyCost: Number(form.monthlyCost.replace(/[,.\s]/g, '')) || 0,
      notes: form.notes.trim(),
    }
    onUpdateProp((p) => {
      const a = p.services ?? {}
      const base = a[p.year] ?? cloneInherited(p)
      return { ...p, services: { ...a, [p.year]: [...base, entry] } }
    })
    resetForm()
  }

  const startEdit = (s: ServiceEntry) => {
    setEditingId(s.id)
    setForm({
      provider: s.provider,
      type: s.type,
      accountNumber: s.accountNumber,
      monthlyCost: s.monthlyCost ? String(s.monthlyCost) : '',
      notes: s.notes,
    })
    setShowForm(true)
  }

  const saveEdit = () => {
    if (!form.provider.trim() || editingId === null) return
    onUpdateProp((p) => {
      const a = p.services ?? {}
      const base = a[p.year] ?? cloneInherited(p)
      return {
        ...p,
        services: {
          ...a,
          [p.year]: base.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  provider: form.provider.trim(),
                  type: form.type,
                  accountNumber: form.accountNumber.trim(),
                  monthlyCost: Number(form.monthlyCost.replace(/[,.\s]/g, '')) || 0,
                  notes: form.notes.trim(),
                }
              : s
          ),
        },
      }
    })
    resetForm()
  }

  const removeService = (id: number) => {
    onUpdateProp((p) => {
      const a = p.services ?? {}
      const base = a[p.year] ?? cloneInherited(p)
      return { ...p, services: { ...a, [p.year]: base.filter((s) => s.id !== id) } }
    })
  }

  const customizeForYear = () => {
    onUpdateProp((p) => {
      const a = p.services ?? {}
      if (a[p.year]) return p
      return { ...p, services: { ...a, [p.year]: cloneInherited(p) } }
    })
  }

  const totalMonthlyCost = services.reduce((a, s) => a + s.monthlyCost, 0)

  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    const headers = ['Provider', 'Type', 'Account #', 'Monthly cost', 'Year est.', 'Notes']
    const rows = services.map((s) =>
      [s.provider, s.type, s.accountNumber || '—', s.monthlyCost ? fmt(s.monthlyCost) : '—', s.monthlyCost ? fmt(s.monthlyCost * 12) : '—', s.notes || '—'].join('\t')
    )
    rows.push(['Total', '', '', fmt(totalMonthlyCost), fmt(totalMonthlyCost * 12), ''].join('\t'))
    navigator.clipboard.writeText([headers.join('\t'), ...rows].join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [services, totalMonthlyCost])

  return (
    <div>
      <div className="sec-hdr mb12">
        <span className="sec-title">Services & utilities · {prop.year}</span>
        <button
          type="button"
          className="primary"
          style={{ fontSize: 12, padding: '5px 14px' }}
          onClick={() => setShowForm(true)}
        >
          + Add service
        </button>
      </div>

      {inherited && (
        <div
          className="card mb12"
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface2)',
            fontSize: 13,
            color: 'var(--text3)',
          }}
        >
          <span>Carried over from {sourceYear}</span>
          <button
            type="button"
            className="ghost"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}
            onClick={customizeForYear}
          >
            Customize for {prop.year}
          </button>
        </div>
      )}

      {services.length === 0 && !showForm && (
        <div className="card">
          <div className="card-inner">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-title">No services registered</div>
              <div className="fs12 text3 mt4">Track utility accounts, insurance, and other services for this property</div>
              <button type="button" className="primary mt12" onClick={() => setShowForm(true)}>
                + Add first service
              </button>
            </div>
          </div>
        </div>
      )}

      {services.length > 0 && (
        <div className="card mb24" style={{ overflow: 'hidden' }}>
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Provider</th>
                <th style={{ textAlign: 'left' }}>Type</th>
                <th style={{ textAlign: 'left' }}>Account #</th>
                <th>Monthly cost</th>
                <th>Year est.</th>
                <th style={{ textAlign: 'left' }}>Notes</th>
                <th style={{ width: 64, textAlign: 'center' }}>
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
              {services.map((s) => (
                <tr key={s.id}>
                  <td style={{ textAlign: 'left', fontWeight: 500 }}>{s.provider}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span
                      className="badge"
                      style={{
                        background: SERVICE_TYPE_COLORS[s.type]?.bg ?? '#f3f4f6',
                        color: SERVICE_TYPE_COLORS[s.type]?.color ?? '#6b7280',
                      }}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 12 }}>{s.accountNumber || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{s.monthlyCost ? fmt(s.monthlyCost) : '—'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text3)' }}>{s.monthlyCost ? fmt(s.monthlyCost * 12) : '—'}</td>
                  <td style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 12 }}>{s.notes || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '4px 8px', fontSize: 13 }}
                      onClick={() => startEdit(s)}
                      title="Edit service"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      style={{ padding: '4px 8px' }}
                      onClick={() => removeService(s.id)}
                      title="Delete service"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td style={{ textAlign: 'left' }}>Total</td>
                <td />
                <td />
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(totalMonthlyCost)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(totalMonthlyCost * 12)}</td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="sec-title mb12">{editingId ? 'Edit service' : 'New service'}</div>
            <div className="contract-grid">
              <div className="field">
                <label>Provider *</label>
                <input type="text" placeholder="EPM, Tigo, etc." value={form.provider} onChange={(e) => set('provider', e.target.value)} />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Account number</label>
                <input type="text" placeholder="12634590" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
              </div>
              <div className="field">
                <label>Monthly cost (COP)</label>
                <input type="text" placeholder="175,000" value={form.monthlyCost} onChange={(e) => set('monthlyCost', e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Notes</label>
                <input type="text" placeholder="Cuenta corriente, estrato 4..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex gap8 mt12">
              <button type="button" className="primary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={editingId ? saveEdit : addService}>
                {editingId ? 'Save changes' : 'Add service'}
              </button>
              <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={resetForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
