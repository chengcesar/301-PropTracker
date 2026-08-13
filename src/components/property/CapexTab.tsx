import { useState } from 'react'
import { CAPEX_AMORTIZE_BASES, CAPEX_CATS, CAPEX_STATUSES, CAPEX_TREATMENTS, MONTHS_FULL } from '../../lib/constants'
import type { CapexAmortizeBasis, CapexItem, CapexStatus, CapexTreatment, Property } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { fmt, parseNum } from '../../lib/format'
import { buildCapexAmortizationSchedule, capexAmortizationProgress, capexDepreciationForMonth } from '../../lib/capexAmortization'

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

const CAPEX_TREATMENT_LABELS: Record<CapexTreatment, string> = {
  capitalize: 'Capitalize & Depreciate',
  expense: 'Expense',
}
const CAPEX_AMORTIZE_BASIS_LABELS: Record<CapexAmortizeBasis, string> = {
  manual: 'Manual months',
  contract: 'Contract',
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
  provider: string
  cat: (typeof CAPEX_CATS)[number]
  amount: string
  status: CapexStatus
  treatment: CapexTreatment
  amortizeBasis: CapexAmortizeBasis
  amortizeMonths: string
  contractId: string
}

const emptyCapexForm = (): CapexForm => ({
  date: '',
  dateEnd: '',
  desc: '',
  provider: '',
  cat: 'Improvement',
  amount: '',
  status: 'To do',
  treatment: 'capitalize',
  amortizeBasis: 'manual',
  amortizeMonths: '',
  contractId: '',
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
      provider: c.provider ?? '',
      cat: c.cat,
      amount: String(Math.round(c.amount)),
      status: c.status ?? 'To do',
      treatment: c.treatment ?? 'expense',
      amortizeBasis: c.amortizeBasis ?? 'manual',
      amortizeMonths: c.amortizeMonths ? String(c.amortizeMonths) : '',
      contractId: c.contractId != null ? String(c.contractId) : '',
    })
    setShowForm(true)
  }

  const buildCapexItemFromForm = (id: number, preserveRecurring: boolean): CapexItem => {
    const base: CapexItem = {
      id,
      date: form.date,
      desc: form.desc,
      cat: form.cat,
      amount: parseNum(form.amount),
      status: form.status,
      treatment: form.treatment,
      ...(preserveRecurring ? { recurring: true } : {}),
      ...(form.provider.trim() ? { provider: form.provider.trim() } : {}),
      ...(form.dateEnd.trim() ? { dateEnd: form.dateEnd.trim() } : {}),
    }
    if (form.treatment !== 'capitalize') return base
    return {
      ...base,
      amortizeBasis: form.amortizeBasis,
      ...(form.amortizeBasis === 'manual' ? { amortizeMonths: parseNum(form.amortizeMonths) } : {}),
      ...(form.amortizeBasis === 'contract' && form.contractId ? { contractId: Number(form.contractId) } : {}),
    }
  }

  const isFormValid = (): boolean => {
    if (!form.desc || !form.amount) return false
    if (form.treatment !== 'capitalize') return true
    if (form.amortizeBasis === 'manual') return parseNum(form.amortizeMonths) >= 1
    return form.contractId !== ''
  }

  const saveEdit = () => {
    if (editingId === null) return
    if (!isFormValid()) return
    const id = editingId
    onUpdateProp((p) => ({
      ...p,
      capex: p.capex.map((x) => (x.id !== id ? x : buildCapexItemFromForm(id, Boolean(x.recurring)))),
    }))
    resetForm()
  }

  const addItem = () => {
    if (!isFormValid()) return
    const item = buildCapexItemFromForm(Date.now(), recurring)
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
              const schedule = buildCapexAmortizationSchedule(c, prop.contracts)
              const today = new Date()
              const progress = schedule ? capexAmortizationProgress(schedule, today.getFullYear(), today.getMonth()) : null
              const linkedContract = c.contractId != null ? prop.contracts.find((ct) => ct.id === c.contractId) : undefined
              return (
                <div key={c.id} className="capex-item-wrap">
                  <div className="capex-item">
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
                      {c.provider && <div className="fs11 text3">{c.provider}</div>}
                    </div>
                    <span className={`badge ${c.cat === 'Improvement' ? 'rented' : c.cat === 'Equipment' ? 'override' : 'pending'}`}>
                      {c.cat}
                    </span>
                    <span className={`badge ${c.status === 'Completed' ? 'rented' : c.status === 'Ongoing' ? 'override' : 'pending'}`}>
                      {c.status ?? 'To do'}
                    </span>
                    <span className={`badge ${c.treatment === 'capitalize' ? 'override' : 'vacant'}`}>
                      {CAPEX_TREATMENT_LABELS[c.treatment ?? 'expense']}
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
                  {schedule && progress && (
                    <div>
                      <div className="capex-progress-track">
                        <div className="capex-progress-fill" style={{ width: `${progress.percent}%` }} />
                      </div>
                      <div className="fs11 text3">
                        {Math.round(progress.percent)}% · Amortized {fmt(cx(progress.amountAmortized))} · {fmt(cx(progress.amountLeft))} left
                      </div>
                      <div className="fs11 text3">
                        {linkedContract ? `Contract: ${linkedContract.tenant} · ` : ''}
                        {progress.monthsElapsed} / {progress.totalMonths} mo
                      </div>
                    </div>
                  )}
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
                gridTemplateColumns: '130px 130px 1fr 1fr 130px 140px 120px',
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
                <label>Service provider</label>
                <input
                  type="text"
                  placeholder="Contractor, company..."
                  value={form.provider}
                  onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
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

            <div className="mt12">
              <label className="fs11 text3" style={{ display: 'block', marginBottom: 6 }}>Treatment</label>
              <div className="flex gap16">
                {CAPEX_TREATMENTS.map((t) => (
                  <label key={t} className="flex align-center gap8" style={{ cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name={`capex-treatment-${recurring ? 'r' : 'nr'}`}
                      checked={form.treatment === t}
                      onChange={() => setForm((p) => ({ ...p, treatment: t }))}
                    />
                    {CAPEX_TREATMENT_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>

            {form.treatment === 'capitalize' && (
              <div className="mt12" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px' }}>
                <div className="field">
                  <label>Amortize against</label>
                  <select
                    value={form.amortizeBasis}
                    onChange={(e) => setForm((p) => ({ ...p, amortizeBasis: e.target.value as CapexAmortizeBasis }))}
                  >
                    {CAPEX_AMORTIZE_BASES.map((b) => (
                      <option key={b} value={b}>
                        {CAPEX_AMORTIZE_BASIS_LABELS[b]}
                      </option>
                    ))}
                  </select>
                </div>
                {form.amortizeBasis === 'manual' ? (
                  <div className="field">
                    <label>Months</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="12"
                      value={form.amortizeMonths}
                      onChange={(e) => setForm((p) => ({ ...p, amortizeMonths: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="field">
                    <label>Contract</label>
                    <select value={form.contractId} onChange={(e) => setForm((p) => ({ ...p, contractId: e.target.value }))}>
                      <option value="">— Select —</option>
                      {prop.contracts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.tenant}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap8 mt12">
              <button
                type="button"
                className="primary"
                style={{ fontSize: 12, padding: '6px 16px' }}
                disabled={!isFormValid()}
                onClick={editingId ? saveEdit : addItem}
              >
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

function CapexDepreciationTable({ prop, cx }: { prop: Property; cx: (n: number) => number }) {
  const items = prop.capex.filter((c) => c.treatment === 'capitalize')
  const monthlyByItem = items.map((c) =>
    Array.from({ length: 12 }, (_, m) => capexDepreciationForMonth(c, prop.contracts, prop.year, m)),
  )
  const activeIdx = items.map((_, idx) => idx).filter((idx) => monthlyByItem[idx].some((v) => v > 0))
  if (activeIdx.length === 0) return null

  const sumFor = (predicate: (idx: number) => boolean) =>
    Array.from({ length: 12 }, (_, m) => activeIdx.filter(predicate).reduce((a, idx) => a + monthlyByItem[idx][m], 0))
  const nrTotals = sumFor((idx) => !items[idx].recurring)
  const rTotals = sumFor((idx) => Boolean(items[idx].recurring))
  const combined = Array.from({ length: 12 }, (_, m) => nrTotals[m] + rTotals[m])
  const cell = (v: number) => (v > 0 ? `−${fmt(cx(v))}` : '—')
  const sumAll = (arr: number[]) => arr.reduce((a, v) => a + v, 0)

  return (
    <div className="mb24">
      <div className="sec-hdr mb12">
        <span className="sec-title">CapEx Depreciation by Month · {prop.year}</span>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="cf-table">
          <thead>
            <tr>
              <th>Month</th>
              {activeIdx.map((idx) => (
                <th key={items[idx].id}>{items[idx].desc}</th>
              ))}
              <th>NR Total</th>
              <th>R Total</th>
              <th>Combined</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS_FULL.map((name, m) => (
              <tr key={name}>
                <td>{name}</td>
                {activeIdx.map((idx) => (
                  <td key={items[idx].id}>{cell(monthlyByItem[idx][m])}</td>
                ))}
                <td>{cell(nrTotals[m])}</td>
                <td>{cell(rTotals[m])}</td>
                <td className="fw6">{cell(combined[m])}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Total</td>
              {activeIdx.map((idx) => (
                <td key={items[idx].id}>{cell(sumAll(monthlyByItem[idx]))}</td>
              ))}
              <td>{cell(sumAll(nrTotals))}</td>
              <td>{cell(sumAll(rTotals))}</td>
              <td className="fw6">{cell(sumAll(combined))}</td>
            </tr>
          </tbody>
        </table>
      </div>
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
      <CapexDepreciationTable prop={prop} cx={cx} />
    </div>
  )
}
