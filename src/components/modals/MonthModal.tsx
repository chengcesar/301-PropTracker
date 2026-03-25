import { useState } from 'react'
import { MONTHS_FULL } from '../../lib/constants'
import type { MonthData, Property } from '../../lib/types'
import { contractForMonth, expenseRowsForYear, yearMonths } from '../../lib/finance'
import { fmt, parseNum } from '../../lib/format'

type ExtraRow = { id: number; label: string; amount: string }

type Props = {
  prop: Property
  mIdx: number
  onSave: (mIdx: number, data: MonthData) => void
  onClose: () => void
}

export function MonthModal({ prop, mIdx, onSave, onClose }: Props) {
  const contract = contractForMonth(prop.contracts, prop.year, mIdx)
  const ym = yearMonths(prop)
  const orig = ym[mIdx] ?? { status: 'rented' as const, incomeOverride: null, expenses: {} }

  const [status, setStatus] = useState<'rented' | 'vacant'>(orig.status ?? 'rented')
  const [incOverride, setIncOverride] = useState(
    orig.incomeOverride !== null && orig.incomeOverride !== undefined ? String(orig.incomeOverride) : '',
  )

  // Build expense rows from services + custom cats for this year
  const rowDefs = expenseRowsForYear(prop)
  // Init manual expenses from saved data
  const initExpenses: Record<string, string | number> = {}
  for (const def of rowDefs) initExpenses[def.key] = 0
  Object.assign(initExpenses, orig.expenses)

  const [expenses, setExpenses] = useState<Record<string, string | number>>(initExpenses)
  const [extras, setExtras] = useState<ExtraRow[]>([])

  const income = !contract ? 0 : status === 'vacant' ? 0 : incOverride !== '' ? parseNum(incOverride) : contract.monthlyRent
  const totalOpex =
    Object.values(expenses).reduce((a: number, b: string | number) => a + (parseFloat(String(b)) || 0), 0) +
    extras.reduce((a: number, b) => a + (parseFloat(String(b.amount)) || 0), 0)
  const net = income - totalOpex

  const save = () => {
    const parsed: Record<string, number | { label: string; amount: number }> = {}
    Object.entries(expenses).forEach(([k, v]) => {
      parsed[k] = parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0
    })
    extras.forEach((e) => {
      if (e.label) parsed[`extra_${e.id}`] = { label: e.label, amount: parseFloat(e.amount) || 0 }
    })
    onSave(mIdx, {
      status,
      incomeOverride: incOverride !== '' ? parseNum(incOverride) : null,
      expenses: parsed,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {MONTHS_FULL[mIdx]} {prop.year} — {prop.name}
            </div>
            <div className="modal-sub">
              {contract
                ? `Contract: ${contract.tenant}`
                : prop.occupant
                  ? `Occupant: ${prop.occupant.name} (${prop.occupant.relation})`
                  : 'No contract this month'}
            </div>
          </div>
          <button type="button" className="ghost" onClick={onClose} style={{ fontSize: '18px', padding: '4px 8px' }}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {!contract && (
            <div className="warn-box mb16" style={{ background: '#f0f4ff', borderColor: '#c7d6f8', color: 'var(--text2)' }}>
              No contract this month — income is $0, but you can still log expenses.
            </div>
          )}
          <div className="flex gap8 align-center mb16">
            <span className="fs11 text2 fw5">Status:</span>
            {(['rented', 'vacant'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={status === s ? 'primary' : ''}
                style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', textTransform: 'capitalize' }}
              >
                {s}
              </button>
            ))}
          </div>
          {contract && status !== 'vacant' && (
            <div className="field mb16">
              <label>Income override (leave blank for contract amount)</label>
              <div className="flex gap8 align-center">
                <input
                  type="text"
                  value={incOverride}
                  onChange={(e) => setIncOverride(e.target.value)}
                  placeholder={contract.monthlyRent.toLocaleString('es-CO')}
                  className="input-sm"
                />
                {incOverride && (
                  <button type="button" className="ghost fs11" onClick={() => setIncOverride('')}>
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="sec-title mb8">Expenses</div>
          <table className="exp-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rowDefs.map((def) => (
                <tr key={def.key}>
                  <td style={{ fontSize: '12px', fontWeight: 500 }}>{def.label}</td>
                  <td>
                    <span className="badge pending">Manual</span>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={expenses[def.key] ?? ''}
                      onChange={(e) => setExpenses((p) => ({ ...p, [def.key]: e.target.value }))}
                      placeholder="0"
                      className="input-sm"
                      style={{ textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
              {extras.map((e) => (
                <tr key={e.id}>
                  <td>
                    <input
                      type="text"
                      value={e.label}
                      onChange={(ev) =>
                        setExtras((p) => p.map((x) => (x.id === e.id ? { ...x, label: ev.target.value } : x)))
                      }
                      placeholder="Description"
                      className="input-sm"
                    />
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                      One-off
                    </span>
                  </td>
                  <td className="flex gap4">
                    <input
                      type="text"
                      value={e.amount}
                      onChange={(ev) =>
                        setExtras((p) => p.map((x) => (x.id === e.id ? { ...x, amount: ev.target.value } : x)))
                      }
                      placeholder="0"
                      className="input-sm"
                      style={{ textAlign: 'right' }}
                    />
                    <button
                      type="button"
                      className="ghost danger"
                      onClick={() => setExtras((p) => p.filter((x) => x.id !== e.id))}
                      style={{ padding: '4px 6px', flexShrink: 0 }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="ghost fs12"
            onClick={() => setExtras((p) => [...p, { id: Date.now(), label: '', amount: '' }])}
            style={{ color: 'var(--purple)' }}
          >
            + One-off expense
          </button>
        </div>
        <div className="modal-footer">
          <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--mono)' }}>
            <span className="text3 fs11">Net: </span>
            <span className={net >= 0 ? 'pos' : 'neg'}>
              {net >= 0 ? '+' : ''}
              {fmt(net)}
            </span>
          </div>
          <div className="flex gap8">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={save}>
              Save month
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
