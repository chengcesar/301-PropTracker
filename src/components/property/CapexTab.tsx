import { useState } from 'react'
import { CAPEX_CATS, CAPEX_STATUSES } from '../../lib/constants'
import type { CapexItem, CapexStatus, Property } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { fmt, parseNum } from '../../lib/format'

function capexDurationWeeks(start: string, end?: string): number | null {
  if (!end?.trim()) return null
  const t0 = new Date(`${start}T12:00:00`).getTime()
  const t1 = new Date(`${end}T12:00:00`).getTime()
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null
  const days = Math.round((t1 - t0) / (24 * 60 * 60 * 1000)) + 1
  if (days < 1) return null
  if (days < 7) return 1
  return Math.ceil(days / 7)
}

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

type CapexForm = {
  date: string
  dateEnd: string
  desc: string
  cat: (typeof CAPEX_CATS)[number]
  amount: string
  status: CapexStatus
}

const emptyCapexForm = (): CapexForm => ({
  date: '',
  dateEnd: '',
  desc: '',
  cat: 'Improvement',
  amount: '',
  status: 'To do',
})

function CapexLogSection({
  prop,
  onUpdateProp,
  cx,
  recurring,
  title,
  hint,
  addLabel,
  emptyTitle,
  emptyHint,
}: {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
  cx: (n: number) => number
  recurring: boolean
  title: string
  hint: string
  addLabel: string
  emptyTitle: string
  emptyHint: string
}) {
  const items = prop.capex.filter((c) => Boolean(c.recurring) === recurring)
  const total = items.reduce((a, b) => a + b.amount, 0)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CapexForm>(emptyCapexForm())

  const resetForm = () => {
    setForm(emptyCapexForm())
    setShowForm(false)
    setEditingId(null)
  }

  const startEdit = (c: CapexItem) => {
    setEditingId(c.id)
    setForm({
      date: c.date,
      dateEnd: c.dateEnd ?? '',
      desc: c.desc,
      cat: c.cat,
      amount: String(Math.round(c.amount)),
      status: c.status ?? 'To do',
    })
    setShowForm(true)
  }

  const saveEdit = () => {
    if (editingId === null) return
    if (!form.desc || !form.amount) return
    const id = editingId
    onUpdateProp((p) => ({
      ...p,
      capex: p.capex.map((x) => {
        if (x.id !== id) return x
        const base: CapexItem = {
          id: x.id,
          date: form.date,
          desc: form.desc,
          cat: form.cat,
          amount: parseNum(form.amount),
          status: form.status,
          ...(x.recurring ? { recurring: true } : {}),
        }
        return form.dateEnd.trim() ? { ...base, dateEnd: form.dateEnd.trim() } : base
      }),
    }))
    resetForm()
  }

  const addItem = () => {
    if (!form.desc || !form.amount) return
    const item: CapexItem = {
      id: Date.now(),
      date: form.date,
      desc: form.desc,
      cat: form.cat,
      amount: parseNum(form.amount),
      status: form.status,
      ...(form.dateEnd.trim() ? { dateEnd: form.dateEnd.trim() } : {}),
      ...(recurring ? { recurring: true } : {}),
    }
    onUpdateProp((p) => ({ ...p, capex: [...p.capex, item] }))
    resetForm()
  }

  const removeItem = (id: number) => {
    onUpdateProp((p) => ({ ...p, capex: p.capex.filter((x) => x.id !== id) }))
  }

  return (
    <div className="mb24">
      <div className="sec-hdr mb12">
        <div>
          <span className="sec-title">{title}</span>
          <div className="fs11 text3" style={{ marginTop: 2 }}>{hint}</div>
        </div>
        <div className="flex align-center gap12">
          {items.length > 0 && <span className="fs11 text3">{fmt(cx(total))} total</span>}
          <button
            type="button"
            className="primary"
            style={{ fontSize: 12, padding: '5px 14px' }}
            onClick={() => {
              setEditingId(null)
              setForm(emptyCapexForm())
              setShowForm(true)
            }}
          >
            {addLabel}
          </button>
        </div>
      </div>

      {items.length === 0 && !showForm && (
        <div className="card">
          <div className="card-inner">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-title">{emptyTitle}</div>
              <div className="fs12 text3" style={{ marginTop: 4 }}>{emptyHint}</div>
              <button
                type="button"
                className="primary mt12"
                onClick={() => {
                  setEditingId(null)
                  setForm(emptyCapexForm())
                  setShowForm(true)
                }}
              >
                + Add first {recurring ? 'recurring' : 'non-recurring'} CapEx
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="card-inner">
            {items.map((c) => {
              const weeks = capexDurationWeeks(c.date, c.dateEnd)
              return (
                <div key={c.id} className="capex-item">
                  <div style={{ width: '110px', flexShrink: 0 }}>
                    <div className="fs11 text3">Start</div>
                    <div className="fs13 mono">{c.date || '—'}</div>
                  </div>
                  <div style={{ width: '110px', flexShrink: 0 }}>
                    <div className="fs11 text3">End</div>
                    <div className="fs13 mono">{c.dateEnd?.trim() ? c.dateEnd : '—'}</div>
                  </div>
                  <div style={{ width: '80px', flexShrink: 0 }}>
                    <div className="fs11 text3">Weeks</div>
                    <div className="fs13 fw5">{weeks !== null ? weeks : '—'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fs11 text3">Description</div>
                    <div className="fs13 fw5">{c.desc}</div>
                  </div>
                  <span className={`badge ${c.cat === 'Improvement' ? 'rented' : c.cat === 'Equipment' ? 'override' : 'pending'}`}>
                    {c.cat}
                  </span>
                  <span className={`badge ${c.status === 'Completed' ? 'rented' : c.status === 'Ongoing' ? 'override' : 'pending'}`}>
                    {c.status ?? 'To do'}
                  </span>
                  <div style={{ width: '130px', textAlign: 'right' }}>
                    <div className="fs11 text3">Amount</div>
                    <div className="fs13 fw6 neg">−{fmt(cx(c.amount))}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="ghost"
                      title="Edit CapEx entry"
                      onClick={() => startEdit(c)}
                      style={{ padding: '4px 8px', fontSize: 13 }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      title="Remove CapEx entry"
                      onClick={() => removeItem(c.id)}
                      style={{ padding: '4px 8px' }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card mt16">
          <div className="card-inner">
            <div className="sec-title mb12">{editingId ? 'Edit CapEx entry' : `New ${recurring ? 'recurring' : 'non-recurring'} CapEx`}</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '130px 130px 1fr 130px 140px 120px',
                gap: '10px',
              }}
            >
              <div className="field">
                <label>Start</label>
                <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="field">
                <label>End</label>
                <input type="date" value={form.dateEnd} onChange={(e) => setForm((p) => ({ ...p, dateEnd: e.target.value }))} />
              </div>
              <div className="field">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Renovation"
                  value={form.desc}
                  onChange={(e) => setForm((p) => ({ ...p, desc: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={form.cat} onChange={(e) => setForm((p) => ({ ...p, cat: e.target.value as (typeof CAPEX_CATS)[number] }))}>
                  {CAPEX_CATS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Amount ({prop.currency})</label>
                <input
                  type="text"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CapexStatus }))}>
                  {CAPEX_STATUSES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap8 mt12">
              <button type="button" className="primary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={editingId ? saveEdit : addItem}>
                {editingId ? 'Save changes' : 'Add CapEx'}
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

export function CapexTab({ prop, onUpdateProp, cx = (n) => n }: Props) {
  return (
    <div>
      <CapexLogSection
        prop={prop}
        onUpdateProp={onUpdateProp}
        cx={cx}
        recurring={false}
        title="Non-recurring CapEx"
        hint="One-time capital projects — renovations, tenant improvements, major replacements"
        addLabel="+ Add Non-Recurring CapEx"
        emptyTitle="No non-recurring CapEx this year"
        emptyHint="Track one-time capital projects for this property"
      />
      <CapexLogSection
        prop={prop}
        onUpdateProp={onUpdateProp}
        cx={cx}
        recurring
        title="Recurring CapEx"
        hint="Capital reserves — ongoing improvements, repairs, equipment"
        addLabel="+ Add Recurring CapEx"
        emptyTitle="No recurring CapEx entries"
        emptyHint="Track ongoing capital reserves, repairs, and equipment replacements"
      />
    </div>
  )
}
