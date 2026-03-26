import { useState } from 'react'
import type { Property, TaxItem, TaxStatus } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { calcAnnual } from '../../lib/finance'
import { fmt, parseNum } from '../../lib/format'

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

const TAX_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  paid:    { bg: '#d1fae5', color: '#047857' },
  pending: { bg: '#fef9c3', color: '#a16207' },
}

export function TaxesTab({ prop, onUpdateProp, cx = (n) => n }: Props) {
  const ann = calcAnnual(prop)
  const items = prop.taxes.items ?? []
  const itemsTotal = items.reduce((a, t) => a + t.amount, 0)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    taxId: '',
    amount: '',
    dueDate: '',
    status: 'pending' as TaxStatus,
  })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
  }

  const resetForm = () => {
    setForm({ taxId: '', amount: '', dueDate: '', status: 'pending' })
    setShowForm(false)
    setEditingId(null)
  }

  const addItem = () => {
    if (!form.taxId.trim() && !form.amount) return
    const item: TaxItem = {
      id: Date.now(),
      taxId: form.taxId.trim(),
      amount: parseNum(form.amount),
      dueDate: form.dueDate,
      status: form.status,
    }
    onUpdateProp((p) => ({
      ...p,
      taxes: { ...p.taxes, items: [...(p.taxes.items ?? []), item] },
    }))
    resetForm()
  }

  const startEdit = (t: TaxItem) => {
    setEditingId(t.id)
    setForm({
      taxId: t.taxId,
      amount: t.amount ? String(t.amount) : '',
      dueDate: t.dueDate,
      status: t.status,
    })
    setShowForm(true)
  }

  const saveEdit = () => {
    if (!form.taxId.trim() || editingId === null) return
    onUpdateProp((p) => ({
      ...p,
      taxes: {
        ...p.taxes,
        items: (p.taxes.items ?? []).map((t) =>
          t.id === editingId
            ? {
                ...t,
                taxId: form.taxId.trim(),
                amount: parseNum(form.amount),
                dueDate: form.dueDate,
                status: form.status,
              }
            : t,
        ),
      },
    }))
    resetForm()
  }

  const updateStatus = (id: number, status: TaxStatus) => {
    onUpdateProp((p) => ({
      ...p,
      taxes: {
        ...p.taxes,
        items: (p.taxes.items ?? []).map((t) => (t.id === id ? { ...t, status } : t)),
      },
    }))
  }

  const removeItem = (id: number) => {
    onUpdateProp((p) => ({
      ...p,
      taxes: { ...p.taxes, items: (p.taxes.items ?? []).filter((t) => t.id !== id) },
    }))
  }

  return (
    <div>
      {/* Header */}
      <div className="sec-hdr mb12">
        <span className="sec-title">Property tax items (Predial)</span>
        <button
          type="button"
          className="primary"
          style={{ fontSize: 12, padding: '5px 14px' }}
          onClick={() => setShowForm(true)}
        >
          + Add tax item
        </button>
      </div>

      {/* Empty state */}
      {items.length === 0 && !showForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-title">No tax items registered</div>
              <div className="fs12 text3 mt4">Track predial tax bills for this property, parking, and storage units</div>
              <button type="button" className="primary mt12" onClick={() => setShowForm(true)}>
                + Add first tax item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax items table */}
      {items.length > 0 && (
        <div className="card mb24" style={{ overflow: 'hidden' }}>
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Tax ID</th>
                <th>Amount</th>
                <th>Due date</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th>{ann.egi ? '% of EGI' : '% of total'}</th>
                <th style={{ width: 64, textAlign: 'center' }} />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td style={{ textAlign: 'left', fontWeight: 500 }}>{t.taxId || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{t.amount ? fmt(cx(t.amount)) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {t.dueDate
                      ? new Date(t.dueDate + 'T12:00').toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                      <select
                        value={t.status}
                        onChange={(e) => updateStatus(t.id, e.target.value as TaxStatus)}
                        style={{
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          background: TAX_STATUS_COLORS[t.status]?.bg ?? '#f3f4f6',
                          color: TAX_STATUS_COLORS[t.status]?.color ?? '#6b7280',
                          border: 'none',
                          borderRadius: 20,
                          padding: '3px 22px 3px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          width: 'auto',
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                      </select>
                      <svg
                        width="10" height="10" viewBox="0 0 10 10"
                        style={{ position: 'absolute', right: 8, pointerEvents: 'none', fill: TAX_STATUS_COLORS[t.status]?.color ?? '#6b7280' }}
                      >
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text3)' }}>
                    {t.amount
                      ? ann.egi
                        ? `${((t.amount / ann.egi) * 100).toFixed(1)}%`
                        : itemsTotal
                          ? `${((t.amount / itemsTotal) * 100).toFixed(1)}%`
                          : '—'
                      : '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '4px 8px', fontSize: 13 }}
                      onClick={() => startEdit(t)}
                      title="Edit tax item"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      style={{ padding: '4px 8px' }}
                      onClick={() => removeItem(t.id)}
                      title="Delete tax item"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td style={{ textAlign: 'left' }}>Total</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(cx(itemsTotal))}</td>
                <td />
                <td />
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{ann.egi && itemsTotal ? `${((itemsTotal / ann.egi) * 100).toFixed(1)}%` : ann.egi ? '—' : '100%'}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="sec-title mb12">{editingId ? 'Edit tax item' : 'New tax item'}</div>
            <div className="contract-grid">
              <div className="field">
                <label>Tax ID *</label>
                <input
                  type="text"
                  placeholder="CL 78 5 32 - AP 102"
                  value={form.taxId}
                  onChange={(e) => set('taxId', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Amount ({prop.currency})</label>
                <input
                  type="text"
                  placeholder="3,472,000"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Due date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => set('dueDate', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as TaxStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
            <div className="flex gap8 mt12">
              <button
                type="button"
                className="primary"
                style={{ fontSize: 12, padding: '6px 16px' }}
                onClick={editingId ? saveEdit : addItem}
              >
                {editingId ? 'Save changes' : 'Add tax item'}
              </button>
              <button
                type="button"
                className="ghost"
                style={{ fontSize: 12 }}
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
