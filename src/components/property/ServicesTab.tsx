import { useState, useCallback } from 'react'
import type { CapexStatus, MaintenanceEvent, Property, ServiceEntry, ServiceOneTimeItem, TaxStatus } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { fmt, parseNum } from '../../lib/format'
import { CAPEX_CATS, CAPEX_STATUSES } from '../../lib/constants'

const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
)
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4"/></svg>
)

const SERVICE_TYPES = ['Admin', 'Electricity', 'Water', 'Gas', 'Internet', 'TV', 'Phone', 'Insurance', 'Cleaning', 'Security', 'Management Fee', 'Broker Fee', 'Other'] as const

const OT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  paid: { bg: '#d1fae5', color: '#047857' },
  pending: { bg: '#fef9c3', color: '#a16207' },
}

const SERVICE_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  Admin:       { bg: '#f3e8ff', color: '#7c3aed' },
  Electricity: { bg: '#fef9c3', color: '#a16207' },
  Water:       { bg: 'var(--accent-muted-bg)', color: 'var(--accent-hover)' },
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
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
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

export function ServicesTab({ prop, onUpdateProp, cx = (n) => n }: Props) {
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

  const oneTimeItems = prop.serviceOneTimeItems ?? []
  const oneTimeYearTotal = oneTimeItems.reduce((a, it) => {
    if (!it.paymentDate?.trim()) return a
    const d = new Date(it.paymentDate + 'T12:00')
    if (d.getFullYear() !== prop.year) return a
    return a + (it.amount ?? 0)
  }, 0)

  const [showOtForm, setShowOtForm] = useState(false)
  const [editingOtId, setEditingOtId] = useState<number | null>(null)
  const [copiedOt, setCopiedOt] = useState(false)
  const [formOt, setFormOt] = useState({
    provider: '',
    type: 'Electricity' as string,
    accountNumber: '',
    amount: '',
    paymentDate: '',
    notes: '',
    status: 'pending' as TaxStatus,
  })

  const setOt = <K extends keyof typeof formOt>(k: K, v: (typeof formOt)[K]) => {
    setFormOt((p) => ({ ...p, [k]: v }))
  }

  const resetOtForm = () => {
    setFormOt({ provider: '', type: 'Electricity', accountNumber: '', amount: '', paymentDate: '', notes: '', status: 'pending' })
    setShowOtForm(false)
    setEditingOtId(null)
  }

  const addOneTime = () => {
    if (!formOt.provider.trim() || !formOt.paymentDate.trim()) return
    const item: ServiceOneTimeItem = {
      id: Date.now(),
      provider: formOt.provider.trim(),
      type: formOt.type,
      accountNumber: formOt.accountNumber.trim() || undefined,
      amount: parseNum(formOt.amount),
      paymentDate: formOt.paymentDate,
      notes: formOt.notes.trim() || undefined,
      status: formOt.status,
    }
    onUpdateProp((p) => ({
      ...p,
      serviceOneTimeItems: [...(p.serviceOneTimeItems ?? []), item],
    }))
    resetOtForm()
  }

  const startEditOt = (it: ServiceOneTimeItem) => {
    setEditingOtId(it.id)
    setFormOt({
      provider: it.provider,
      type: it.type,
      accountNumber: it.accountNumber ?? '',
      amount: it.amount ? String(it.amount) : '',
      paymentDate: it.paymentDate,
      notes: it.notes ?? '',
      status: it.status ?? 'pending',
    })
    setShowOtForm(true)
  }

  const saveEditOt = () => {
    if (!formOt.provider.trim() || !formOt.paymentDate.trim() || editingOtId === null) return
    onUpdateProp((p) => ({
      ...p,
      serviceOneTimeItems: (p.serviceOneTimeItems ?? []).map((it) =>
        it.id === editingOtId
          ? {
              ...it,
              provider: formOt.provider.trim(),
              type: formOt.type,
              accountNumber: formOt.accountNumber.trim() || undefined,
              amount: parseNum(formOt.amount),
              paymentDate: formOt.paymentDate,
              notes: formOt.notes.trim() || undefined,
              status: formOt.status,
            }
          : it,
      ),
    }))
    resetOtForm()
  }

  const updateOtStatus = (id: number, status: TaxStatus) => {
    onUpdateProp((p) => ({
      ...p,
      serviceOneTimeItems: (p.serviceOneTimeItems ?? []).map((it) => (it.id === id ? { ...it, status } : it)),
    }))
  }

  const removeOneTime = (id: number) => {
    onUpdateProp((p) => ({
      ...p,
      serviceOneTimeItems: (p.serviceOneTimeItems ?? []).filter((it) => it.id !== id),
    }))
  }

  const formatPayCell = (dateStr: string) =>
    dateStr
      ? new Date(dateStr + 'T12:00').toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        })
      : '—'

  const handleCopyOt = useCallback(() => {
    const headers = ['Provider', 'Type', 'Account #', 'Amount', 'Payment date', 'Status', 'Notes']
    const rows = oneTimeItems.map((it) =>
      [
        it.provider || '—',
        it.type,
        it.accountNumber || '—',
        it.amount ? fmt(cx(it.amount)) : '—',
        formatPayCell(it.paymentDate),
        (it.status ?? 'pending').charAt(0).toUpperCase() + (it.status ?? 'pending').slice(1),
        it.notes || '—',
      ].join('\t'),
    )
    const totalAll = oneTimeItems.reduce((a, it) => a + (it.amount ?? 0), 0)
    rows.push(['Total (all)', '', '', totalAll ? fmt(cx(totalAll)) : '—', '', '', ''].join('\t'))
    navigator.clipboard.writeText([headers.join('\t'), ...rows].join('\n'))
    setCopiedOt(true)
    setTimeout(() => setCopiedOt(false), 2000)
  }, [oneTimeItems, cx])

  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    const headers = ['Provider', 'Type', 'Account #', 'Monthly cost', 'Year est.', 'Notes']
    const rows = services.map((s) =>
      [s.provider, s.type, s.accountNumber || '—', s.monthlyCost ? fmt(cx(s.monthlyCost)) : '—', s.monthlyCost ? fmt(cx(s.monthlyCost * 12)) : '—', s.notes || '—'].join('\t')
    )
    rows.push(['Total', '', '', fmt(cx(totalMonthlyCost)), fmt(cx(totalMonthlyCost * 12)), ''].join('\t'))
    navigator.clipboard.writeText([headers.join('\t'), ...rows].join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [services, totalMonthlyCost, cx])

  const maintenanceItems = prop.maintenanceEvents ?? []
  const maintenanceYearTotal = maintenanceItems.reduce((a, it) => {
    if (!it.date?.trim()) return a
    const d = new Date(it.date + 'T12:00')
    if (d.getFullYear() !== prop.year) return a
    return a + (it.amount ?? 0)
  }, 0)

  const [showMaintForm, setShowMaintForm] = useState(false)
  const [editingMaintId, setEditingMaintId] = useState<number | null>(null)
  const [copiedMaint, setCopiedMaint] = useState(false)
  const [formMaint, setFormMaint] = useState({
    desc: '',
    provider: '',
    cat: 'Repair' as (typeof CAPEX_CATS)[number],
    amount: '',
    date: '',
    dateEnd: '',
    status: 'To do' as CapexStatus,
    notes: '',
  })

  const setMaint = <K extends keyof typeof formMaint>(k: K, v: (typeof formMaint)[K]) => {
    setFormMaint((p) => ({ ...p, [k]: v }))
  }

  const resetMaintForm = () => {
    setFormMaint({ desc: '', provider: '', cat: 'Repair', amount: '', date: '', dateEnd: '', status: 'To do', notes: '' })
    setShowMaintForm(false)
    setEditingMaintId(null)
  }

  const addMaintenance = () => {
    if (!formMaint.desc.trim() || !formMaint.date.trim()) return
    const item: MaintenanceEvent = {
      id: Date.now(),
      desc: formMaint.desc.trim(),
      provider: formMaint.provider.trim() || undefined,
      cat: formMaint.cat,
      amount: parseNum(formMaint.amount),
      date: formMaint.date,
      dateEnd: formMaint.dateEnd.trim() || undefined,
      status: formMaint.status,
      notes: formMaint.notes.trim() || undefined,
    }
    onUpdateProp((p) => ({
      ...p,
      maintenanceEvents: [...(p.maintenanceEvents ?? []), item],
    }))
    resetMaintForm()
  }

  const startEditMaintenance = (it: MaintenanceEvent) => {
    setEditingMaintId(it.id)
    setFormMaint({
      desc: it.desc,
      provider: it.provider ?? '',
      cat: it.cat,
      amount: it.amount ? String(it.amount) : '',
      date: it.date,
      dateEnd: it.dateEnd ?? '',
      status: it.status ?? 'To do',
      notes: it.notes ?? '',
    })
    setShowMaintForm(true)
  }

  const saveEditMaintenance = () => {
    if (!formMaint.desc.trim() || !formMaint.date.trim() || editingMaintId === null) return
    onUpdateProp((p) => ({
      ...p,
      maintenanceEvents: (p.maintenanceEvents ?? []).map((it) =>
        it.id === editingMaintId
          ? {
              ...it,
              desc: formMaint.desc.trim(),
              provider: formMaint.provider.trim() || undefined,
              cat: formMaint.cat,
              amount: parseNum(formMaint.amount),
              date: formMaint.date,
              dateEnd: formMaint.dateEnd.trim() || undefined,
              status: formMaint.status,
              notes: formMaint.notes.trim() || undefined,
            }
          : it,
      ),
    }))
    resetMaintForm()
  }

  const removeMaintenance = (id: number) => {
    onUpdateProp((p) => ({
      ...p,
      maintenanceEvents: (p.maintenanceEvents ?? []).filter((it) => it.id !== id),
    }))
  }

  const handleCopyMaintenance = useCallback(() => {
    const headers = ['Description', 'Provider', 'Category', 'Amount', 'Start date', 'End date', 'Status', 'Notes']
    const rows = maintenanceItems.map((it) =>
      [
        it.desc || '—',
        it.provider || '—',
        it.cat,
        it.amount ? fmt(cx(it.amount)) : '—',
        formatPayCell(it.date),
        it.dateEnd ? formatPayCell(it.dateEnd) : '—',
        it.status ?? 'To do',
        it.notes || '—',
      ].join('\t'),
    )
    const totalAll = maintenanceItems.reduce((a, it) => a + (it.amount ?? 0), 0)
    rows.push(['Total (all)', '', '', totalAll ? fmt(cx(totalAll)) : '—', '', '', '', ''].join('\t'))
    navigator.clipboard.writeText([headers.join('\t'), ...rows].join('\n'))
    setCopiedMaint(true)
    setTimeout(() => setCopiedMaint(false), 2000)
  }, [maintenanceItems, cx])

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
                  <td style={{ textAlign: 'right' }}>{s.monthlyCost ? fmt(cx(s.monthlyCost)) : '—'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text3)' }}>{s.monthlyCost ? fmt(cx(s.monthlyCost * 12)) : '—'}</td>
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
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(cx(totalMonthlyCost))}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(cx(totalMonthlyCost * 12))}</td>
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
                <label>Monthly cost ({prop.currency})</label>
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

      <div className="sec-hdr mb12 mt24">
        <span className="sec-title">One-time payments · {prop.year}</span>
        <button
          type="button"
          className="primary"
          style={{ fontSize: 12, padding: '5px 14px' }}
          onClick={() => setShowOtForm(true)}
        >
          + Add payment
        </button>
      </div>
      <div className="fs12 text3 mb12" style={{ maxWidth: 640 }}>
        Lump fees dated in a month (broker, annual insurance, etc.) appear on Overview and Cashflow for that month when the payment year matches {prop.year}.
      </div>

      {oneTimeItems.length === 0 && !showOtForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-title">No one-time payments</div>
              <div className="fs12 text3 mt4">Add fees that hit cashflow in a single month</div>
              <button type="button" className="primary mt12" onClick={() => setShowOtForm(true)}>
                + Add first payment
              </button>
            </div>
          </div>
        </div>
      )}

      {oneTimeItems.length > 0 && (
        <div className="card mb24" style={{ overflow: 'hidden' }}>
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Provider</th>
                <th style={{ textAlign: 'left' }}>Type</th>
                <th style={{ textAlign: 'left' }}>Account #</th>
                <th>Amount</th>
                <th>Payment date</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'left' }}>Notes</th>
                <th style={{ width: 64, textAlign: 'center' }}>
                  <button
                    className="ghost"
                    style={{ padding: 0, border: 'none', background: 'transparent', margin: '0 auto', display: 'block' }}
                    title={copiedOt ? 'Copied!' : 'Copy table'}
                    onClick={handleCopyOt}
                  >
                    {copiedOt ? <IconCheck /> : <IconCopy />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {oneTimeItems.map((it) => {
                const st = it.status ?? 'pending'
                return (
                  <tr key={it.id}>
                    <td style={{ textAlign: 'left', fontWeight: 500 }}>{it.provider}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span
                        className="badge"
                        style={{
                          background: SERVICE_TYPE_COLORS[it.type]?.bg ?? '#f3f4f6',
                          color: SERVICE_TYPE_COLORS[it.type]?.color ?? '#6b7280',
                        }}
                      >
                        {it.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 12 }}>{it.accountNumber || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{it.amount ? fmt(cx(it.amount)) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatPayCell(it.paymentDate)}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <select
                          value={st}
                          onChange={(e) => updateOtStatus(it.id, e.target.value as TaxStatus)}
                          style={{
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            background: OT_STATUS_COLORS[st]?.bg ?? '#f3f4f6',
                            color: OT_STATUS_COLORS[st]?.color ?? '#6b7280',
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
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          style={{ position: 'absolute', right: 8, pointerEvents: 'none', fill: OT_STATUS_COLORS[st]?.color ?? '#6b7280' }}
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      </span>
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 12 }}>{it.notes || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: '4px 8px', fontSize: 13 }}
                        onClick={() => startEditOt(it)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button type="button" className="ghost danger" style={{ padding: '4px 8px' }} onClick={() => removeOneTime(it.id)} title="Delete">
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr className="total-row">
                <td style={{ textAlign: 'left' }}>Total ({prop.year})</td>
                <td />
                <td />
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{oneTimeYearTotal ? fmt(cx(oneTimeYearTotal)) : '—'}</td>
                <td />
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showOtForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="sec-title mb12">{editingOtId ? 'Edit one-time payment' : 'New one-time payment'}</div>
            <div className="contract-grid">
              <div className="field">
                <label>Provider *</label>
                <input type="text" placeholder="Agency, insurer…" value={formOt.provider} onChange={(e) => setOt('provider', e.target.value)} />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={formOt.type} onChange={(e) => setOt('type', e.target.value)}>
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Account number</label>
                <input type="text" value={formOt.accountNumber} onChange={(e) => setOt('accountNumber', e.target.value)} />
              </div>
              <div className="field">
                <label>Amount ({prop.currency})</label>
                <input type="text" placeholder="500,000" value={formOt.amount} onChange={(e) => setOt('amount', e.target.value)} />
              </div>
              <div className="field">
                <label>Payment date *</label>
                <input type="date" value={formOt.paymentDate} onChange={(e) => setOt('paymentDate', e.target.value)} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={formOt.status} onChange={(e) => setOt('status', e.target.value as TaxStatus)}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Notes</label>
                <input type="text" value={formOt.notes} onChange={(e) => setOt('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex gap8 mt12">
              <button
                type="button"
                className="primary"
                style={{ fontSize: 12, padding: '6px 16px' }}
                onClick={editingOtId ? saveEditOt : addOneTime}
              >
                {editingOtId ? 'Save changes' : 'Add payment'}
              </button>
              <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={resetOtForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sec-hdr mb12 mt24">
        <span className="sec-title">Maintenance events · {prop.year}</span>
        <button
          type="button"
          className="primary"
          style={{ fontSize: 12, padding: '5px 14px' }}
          onClick={() => setShowMaintForm(true)}
        >
          + Add event
        </button>
      </div>
      <div className="fs12 text3 mb12" style={{ maxWidth: 640 }}>
        Ad-hoc costs routed to OpEx — reduce NOI.
      </div>

      {maintenanceItems.length === 0 && !showMaintForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-title">No maintenance events</div>
              <div className="fs12 text3 mt4">Add ad-hoc maintenance costs that reduce NOI via OpEx</div>
              <button type="button" className="primary mt12" onClick={() => setShowMaintForm(true)}>
                + Add first event
              </button>
            </div>
          </div>
        </div>
      )}

      {maintenanceItems.length > 0 && (
        <div className="card mb24" style={{ overflow: 'hidden' }}>
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Description</th>
                <th style={{ textAlign: 'left' }}>Provider</th>
                <th style={{ textAlign: 'left' }}>Category</th>
                <th>Amount</th>
                <th>Start date</th>
                <th>End date</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'left' }}>Notes</th>
                <th style={{ width: 64, textAlign: 'center' }}>
                  <button
                    className="ghost"
                    style={{ padding: 0, border: 'none', background: 'transparent', margin: '0 auto', display: 'block' }}
                    title={copiedMaint ? 'Copied!' : 'Copy table'}
                    onClick={handleCopyMaintenance}
                  >
                    {copiedMaint ? <IconCheck /> : <IconCopy />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {maintenanceItems.map((it) => {
                const status = it.status ?? 'To do'
                return (
                  <tr key={it.id}>
                    <td style={{ textAlign: 'left', fontWeight: 500 }}>{it.desc}</td>
                    <td style={{ textAlign: 'left' }}>{it.provider || '—'}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span
                        className={`badge ${it.cat === 'Improvement' ? 'rented' : it.cat === 'Equipment' ? 'override' : 'pending'}`}
                      >
                        {it.cat}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{it.amount ? fmt(cx(it.amount)) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatPayCell(it.date)}</td>
                    <td style={{ textAlign: 'right' }}>{it.dateEnd ? formatPayCell(it.dateEnd) : '—'}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span className={`badge ${status === 'Completed' ? 'rented' : status === 'Ongoing' ? 'override' : 'pending'}`}>
                        {status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 12 }}>{it.notes || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: '4px 8px', fontSize: 13 }}
                        onClick={() => startEditMaintenance(it)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button type="button" className="ghost danger" style={{ padding: '4px 8px' }} onClick={() => removeMaintenance(it.id)} title="Delete">
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr className="total-row">
                <td style={{ textAlign: 'left' }}>Total ({prop.year})</td>
                <td />
                <td />
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{maintenanceYearTotal ? fmt(cx(maintenanceYearTotal)) : '—'}</td>
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showMaintForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="sec-title mb12">{editingMaintId ? 'Edit maintenance event' : 'New maintenance event'}</div>
            <div className="contract-grid">
              <div className="field">
                <label>Description *</label>
                <input type="text" placeholder="Describe the maintenance work..." value={formMaint.desc} onChange={(e) => setMaint('desc', e.target.value)} />
              </div>
              <div className="field">
                <label>Service provider</label>
                <input type="text" placeholder="Contractor, company..." value={formMaint.provider} onChange={(e) => setMaint('provider', e.target.value)} />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={formMaint.cat} onChange={(e) => setMaint('cat', e.target.value as (typeof CAPEX_CATS)[number])}>
                  {CAPEX_CATS.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Amount ({prop.currency})</label>
                <input type="text" placeholder="0" value={formMaint.amount} onChange={(e) => setMaint('amount', e.target.value)} />
              </div>
              <div className="field">
                <label>Start date *</label>
                <input type="date" value={formMaint.date} onChange={(e) => setMaint('date', e.target.value)} />
              </div>
              <div className="field">
                <label>End date</label>
                <input type="date" value={formMaint.dateEnd} onChange={(e) => setMaint('dateEnd', e.target.value)} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={formMaint.status} onChange={(e) => setMaint('status', e.target.value as CapexStatus)}>
                  {CAPEX_STATUSES.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Notes</label>
                <input type="text" value={formMaint.notes} onChange={(e) => setMaint('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex gap8 mt12">
              <button
                type="button"
                className="primary"
                style={{ fontSize: 12, padding: '6px 16px' }}
                onClick={editingMaintId ? saveEditMaintenance : addMaintenance}
              >
                {editingMaintId ? 'Save changes' : 'Add event'}
              </button>
              <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={resetMaintForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
