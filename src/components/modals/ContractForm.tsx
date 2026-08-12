import { INCREMENT_OPTS } from '../../lib/constants'
import type { IncrementType } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'

export type ContractFormState = {
  tenant: string
  contractManager: string
  monthlyRent: string | number
  startDate: string
  endDate: string
  paymentDay: number
  deposit: number
  increment: IncrementType | string
  ipcExtra: number
  fixedPct: number
  cpiEstimatePct: number
  adminFee: string | number
  notes: string
}

type Props = {
  value: ContractFormState
  onChange: (next: ContractFormState) => void
  currency?: CurrencyCode
}

export function ContractForm({ value, onChange, currency = 'COP' }: Props) {
  const set = <K extends keyof ContractFormState>(k: K, v: ContractFormState[K]) => {
    onChange({ ...value, [k]: v })
  }

  return (
    <div className="contract-grid">
      <div className="field" style={{ gridColumn: '1/-1' }}>
        <label>Tenant name</label>
        <input
          value={value.tenant ?? ''}
          onChange={(e) => set('tenant', e.target.value)}
          placeholder="Name or company"
        />
      </div>
      <div className="field" style={{ gridColumn: '1/-1' }}>
        <label>Contract manager</label>
        <input
          value={value.contractManager ?? ''}
          onChange={(e) => set('contractManager', e.target.value)}
          placeholder="Person or company managing the contract"
        />
      </div>
      <div className="field">
        <label>Monthly rent ({currency})</label>
        <input
          type="text"
          value={value.monthlyRent ?? ''}
          onChange={(e) => set('monthlyRent', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Start date</label>
        <input type="date" value={value.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} />
      </div>
      <div className="field">
        <label>End date</label>
        <input type="date" value={value.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} />
      </div>
      <div className="field">
        <label>Payment day</label>
        <input
          type="number"
          min={1}
          max={28}
          value={value.paymentDay ?? 1}
          onChange={(e) => set('paymentDay', parseInt(e.target.value, 10))}
        />
      </div>
      <div className="field">
        <label>Deposit (months)</label>
        <select value={value.deposit ?? 2} onChange={(e) => set('deposit', parseInt(e.target.value, 10))}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Annual increment</label>
        <select value={value.increment ?? 'ipc+'} onChange={(e) => set('increment', e.target.value as IncrementType)}>
          {INCREMENT_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {value.increment === 'fixed' && (
        <div className="field">
          <label>Fixed %</label>
          <input
            type="number"
            step={0.1}
            value={value.fixedPct ?? 0}
            onChange={(e) => set('fixedPct', parseFloat(e.target.value))}
          />
        </div>
      )}
      {value.increment === 'ipc' && (
        <div className="field">
          <label>IPC (estimate) %</label>
          <input
            type="number"
            step={0.1}
            value={value.cpiEstimatePct ?? 0}
            onChange={(e) => set('cpiEstimatePct', parseFloat(e.target.value))}
          />
        </div>
      )}
      {(value.increment === 'ipc+' || !value.increment) && (
        <>
          <div className="field">
            <label>IPC (estimate) %</label>
            <input
              type="number"
              step={0.1}
              value={value.cpiEstimatePct ?? 0}
              onChange={(e) => set('cpiEstimatePct', parseFloat(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Fixed extra %</label>
            <input
              type="number"
              step={0.1}
              value={value.ipcExtra ?? 1}
              onChange={(e) => set('ipcExtra', parseFloat(e.target.value))}
            />
          </div>
        </>
      )}
      <div className="divider" style={{ gridColumn: '1/-1' }} />
      <div className="field">
        <label>Admin / mgmt fee ({currency})</label>
        <input type="text" value={value.adminFee ?? ''} onChange={(e) => set('adminFee', e.target.value)} />
      </div>
      <div className="field" style={{ gridColumn: '1/-1' }}>
        <label>Notes</label>
        <textarea
          rows={2}
          value={value.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Optional"
          style={{ resize: 'vertical' }}
        />
      </div>
    </div>
  )
}
