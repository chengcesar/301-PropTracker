import { useState } from 'react'
import { CAPEX_CATS, MONTHS } from '../../lib/constants'
import type { Property } from '../../lib/types'
import { expenseRowsForYear, yearMonths } from '../../lib/finance'
import { fmt, parseNum } from '../../lib/format'

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
}

export function OpexCapexTab({ prop, onUpdateProp }: Props) {
  const [newCapex, setNewCapex] = useState({
    date: '',
    desc: '',
    cat: 'Improvement' as (typeof CAPEX_CATS)[number],
    amount: '',
  })

  const addCapex = () => {
    if (!newCapex.desc || !newCapex.amount) return
    onUpdateProp((p) => ({
      ...p,
      capex: [...p.capex, { id: Date.now(), ...newCapex, amount: parseNum(newCapex.amount) }],
    }))
    setNewCapex({ date: '', desc: '', cat: 'Improvement', amount: '' })
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
                    <td key={rowDefs[j].key} className={v ? '' : 'text3'}>{v ? fmt(v) : '—'}</td>
                  ))}
                  <td className="fw5">−{fmt(total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="sec-hdr mb12">
        <span className="sec-title">CAPEX log</span>
        <span className="fs11 text3">Total: {fmt(prop.capex.reduce((a, b) => a + b.amount, 0))}</span>
      </div>
      <div className="card mb16">
        <div className="card-inner">
          {prop.capex.length === 0 && (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-title">No CAPEX this year</div>
            </div>
          )}
          {prop.capex.map((c) => (
            <div key={c.id} className="capex-item">
              <div style={{ width: '110px', flexShrink: 0 }}>
                <div className="fs11 text3">Date</div>
                <div className="fs13 mono">{c.date}</div>
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
                <div className="fs13 fw6 neg">−{fmt(c.amount)}</div>
              </div>
              <button
                type="button"
                className="ghost danger"
                onClick={() => onUpdateProp((p) => ({ ...p, capex: p.capex.filter((x) => x.id !== c.id) }))}
                style={{ padding: '4px 8px' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-inner">
          <div className="sec-title mb12">Add CAPEX</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr 130px 140px auto',
              gap: '10px',
              alignItems: 'end',
            }}
          >
            <div className="field">
              <label>Date</label>
              <input type="date" value={newCapex.date} onChange={(e) => setNewCapex((p) => ({ ...p, date: e.target.value }))} />
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
              <label>Amount (COP)</label>
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
