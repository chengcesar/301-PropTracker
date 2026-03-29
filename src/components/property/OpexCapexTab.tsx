import { useState } from 'react'
import { CAPEX_CATS, MONTHS } from '../../lib/constants'
import type { CapexItem, Property } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { expenseRowsForYear, yearMonths } from '../../lib/finance'
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
}

const emptyCapexForm = (): CapexForm => ({
  date: '',
  dateEnd: '',
  desc: '',
  cat: 'Improvement',
  amount: '',
})

export function OpexCapexTab({ prop, onUpdateProp, cx = (n) => n }: Props) {
  const [newCapex, setNewCapex] = useState<CapexForm>(emptyCapexForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CapexForm>(emptyCapexForm())

  const startEdit = (c: CapexItem) => {
    setEditingId(c.id)
    setEditForm({
      date: c.date,
      dateEnd: c.dateEnd ?? '',
      desc: c.desc,
      cat: c.cat,
      amount: String(Math.round(c.amount)),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(emptyCapexForm())
  }

  const saveEdit = () => {
    if (editingId === null) return
    if (!editForm.desc || !editForm.amount) return
    const id = editingId
    onUpdateProp((p) => ({
      ...p,
      capex: p.capex.map((x) => {
        if (x.id !== id) return x
        const base: CapexItem = {
          id: x.id,
          date: editForm.date,
          desc: editForm.desc,
          cat: editForm.cat,
          amount: parseNum(editForm.amount),
        }
        return editForm.dateEnd.trim() ? { ...base, dateEnd: editForm.dateEnd.trim() } : base
      }),
    }))
    cancelEdit()
  }

  const addCapex = () => {
    if (!newCapex.desc || !newCapex.amount) return
    const item = {
      id: Date.now(),
      date: newCapex.date,
      desc: newCapex.desc,
      cat: newCapex.cat,
      amount: parseNum(newCapex.amount),
      ...(newCapex.dateEnd.trim() ? { dateEnd: newCapex.dateEnd.trim() } : {}),
    }
    onUpdateProp((p) => ({ ...p, capex: [...p.capex, item] }))
    setNewCapex(emptyCapexForm())
  }

  const ym = yearMonths(prop)
  const rowDefs = expenseRowsForYear(prop)

  return (
    <div>
      <div className="sec-hdr mb12">
        <span className="sec-title">OPEX by month · {prop.year}</span>
      </div>
      <div className="card mb24" style={{ overflow: 'hidden' }}>
        <table className="cf-table">
          <thead>
            <tr>
              <th>Month</th>
              {rowDefs.map((def) => (
                <th key={def.key}>{def.label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((name, i) => {
              const exp = ym[i]?.expenses ?? {}
              let total = 0
              const cellValues = rowDefs.map((def) => {
                let val = 0
                const v = exp[def.key]
                val = typeof v === 'number' ? v : 0
                total += val
                return val
              })
              return (
                <tr key={i} className={!ym[i] ? 'no-contract-row' : ''}>
                  <td>{name}</td>
                  {cellValues.map((v, j) => (
                    <td key={rowDefs[j].key} className={v ? '' : 'text3'}>{v ? fmt(cx(v)) : '—'}</td>
                  ))}
                  <td className="fw5">−{fmt(cx(total))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="sec-hdr mb12">
        <span className="sec-title">CAPEX log</span>
        <span className="fs11 text3">Total: {fmt(cx(prop.capex.reduce((a, b) => a + b.amount, 0)))}</span>
      </div>
      <div className="card mb16">
        <div className="card-inner">
          {prop.capex.length === 0 && (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-title">No CAPEX this year</div>
            </div>
          )}
          {prop.capex.map((c) => {
            if (c.id === editingId) {
              const weeks = capexDurationWeeks(editForm.date, editForm.dateEnd)
              return (
                <div key={c.id} className="capex-item" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 130px 1fr 130px 140px',
                      gap: '10px',
                      width: '100%',
                      flexBasis: '100%',
                    }}
                  >
                    <div className="field">
                      <label>Start</label>
                      <input type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>End</label>
                      <input type="date" value={editForm.dateEnd} onChange={(e) => setEditForm((p) => ({ ...p, dateEnd: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>Description</label>
                      <input
                        type="text"
                        value={editForm.desc}
                        onChange={(e) => setEditForm((p) => ({ ...p, desc: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>Category</label>
                      <select value={editForm.cat} onChange={(e) => setEditForm((p) => ({ ...p, cat: e.target.value as (typeof CAPEX_CATS)[number] }))}>
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
                        value={editForm.amount}
                        onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <div style={{ width: '80px', flexShrink: 0 }}>
                      <div className="fs11 text3">Weeks</div>
                      <div className="fs13 fw5">{weeks !== null ? weeks : '—'}</div>
                    </div>
                    <button type="button" className="primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={saveEdit}>
                      Save
                    </button>
                    <button type="button" className="ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="ghost danger"
                      title="Remove CAPEX entry"
                      onClick={() => {
                        onUpdateProp((p) => ({ ...p, capex: p.capex.filter((x) => x.id !== c.id) }))
                        cancelEdit()
                      }}
                      style={{ padding: '4px 8px' }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            }

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
                <div style={{ width: '130px', textAlign: 'right' }}>
                  <div className="fs11 text3">Amount</div>
                  <div className="fs13 fw6 neg">−{fmt(cx(c.amount))}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="ghost"
                    title="Edit CAPEX entry"
                    onClick={() => startEdit(c)}
                    style={{ padding: '4px 8px', fontSize: 13 }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="ghost danger"
                    title="Remove CAPEX entry"
                    onClick={() => onUpdateProp((p) => ({ ...p, capex: p.capex.filter((x) => x.id !== c.id) }))}
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
      <div className="card">
        <div className="card-inner">
          <div className="sec-title mb12">Add CAPEX</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 130px 1fr 130px 140px auto',
              gap: '10px',
              alignItems: 'end',
            }}
          >
            <div className="field">
              <label>Start</label>
              <input type="date" value={newCapex.date} onChange={(e) => setNewCapex((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>End</label>
              <input type="date" value={newCapex.dateEnd} onChange={(e) => setNewCapex((p) => ({ ...p, dateEnd: e.target.value }))} />
            </div>
            <div className="field">
              <label>Description</label>
              <input
                type="text"
                value={newCapex.desc}
                placeholder="Renovation"
                onChange={(e) => setNewCapex((p) => ({ ...p, desc: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={newCapex.cat} onChange={(e) => setNewCapex((p) => ({ ...p, cat: e.target.value as (typeof CAPEX_CATS)[number] }))}>
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
                value={newCapex.amount}
                placeholder="0"
                onChange={(e) => setNewCapex((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <button type="button" className="primary" onClick={addCapex}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
