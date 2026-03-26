import { Fragment, useState } from 'react'
import type { Contract, Property } from '../../lib/types'
import { activeContract } from '../../lib/finance'
import { parseNum, fmtCurrency } from '../../lib/format'
import { ContractForm, type ContractFormState } from './ContractForm'

type NewContractForm = ContractFormState & { activateNow: boolean }

type Props = {
  prop: Property
  onSave: (contracts: Contract[]) => void
  onClose: () => void
}

export function NewContractModal({ prop, onSave, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<NewContractForm>({
    tenant: '',
    contractManager: '',
    monthlyRent: '',
    startDate: '',
    endDate: '',
    paymentDay: 1,
    deposit: 2,
    increment: 'ipc+',
    ipcExtra: 1,
    adminFee: '',
    notes: '',
    activateNow: true,
  })

  const active = activeContract(prop)
  const hasOverlap =
    !!active &&
    !!form.startDate &&
    active.status === 'active' &&
    new Date(form.startDate) <= new Date(active.endDate)
  const valid1 = !!(form.tenant && form.monthlyRent && form.startDate && form.endDate)

  const save = () => {
    const newC: Contract = {
      id: Date.now(),
      status: form.activateNow ? 'active' : 'draft',
      tenant: form.tenant,
      contractManager: form.contractManager,
      monthlyRent: parseNum(form.monthlyRent),
      startDate: form.startDate,
      endDate: form.endDate,
      paymentDay: form.paymentDay,
      deposit: form.deposit,
      increment: form.increment as Contract['increment'],
      ipcExtra: form.ipcExtra,
      adminFee: parseNum(form.adminFee),
      notes: form.notes ?? '',
    }
    let contracts = [...prop.contracts]
    if (form.activateNow) {
      contracts = contracts.map((c) => (c.status === 'active' ? { ...c, status: 'archived' as const } : c))
    }
    contracts.push(newC)
    onSave(contracts)
    onClose()
  }

  // activateNow is only for step 2 — omit from contract form fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activateNow, ...contractFormValue } = form

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">New contract — {prop.name}</div>
            <div className="modal-sub">Set up a new rental agreement</div>
          </div>
          <button type="button" className="ghost" onClick={onClose} style={{ fontSize: '18px', padding: '4px 8px' }}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="stepper">
            {(
              [
                ['Contract details', 1],
                ['Review & activate', 2],
              ] as const
            ).map(([label, n], i) => (
              <Fragment key={n}>
                {i > 0 && <div className="step-sep" />}
                <div className={`step-pill${step === n ? ' active' : step > n ? ' done' : ''}`}>
                  <div className="step-num">{step > n ? '✓' : n}</div>
                  {label}
                </div>
              </Fragment>
            ))}
          </div>
          {step === 1 && (
            <ContractForm
              value={contractFormValue}
              onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              currency={prop.currency}
            />
          )}
          {step === 2 && (
            <div>
              {hasOverlap && active && (
                <div className="warn-box mb16">
                  <strong>Date overlap.</strong> Activating this contract will archive the current one with{' '}
                  {active.tenant} (ends {active.endDate}).
                </div>
              )}
              <div className="card mb16">
                <div className="card-inner">
                  <div className="sec-title mb12">Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    {(
                      [
                        ['Tenant', form.tenant],
                        ['Rent', fmtCurrency(parseNum(form.monthlyRent), prop.currency)],
                        ['Period', `${form.startDate} → ${form.endDate}`],
                        [
                          'Increment',
                          form.increment === 'ipc+' ? `IPC+${form.ipcExtra}%` : form.increment,
                        ],
                        ['Admin fee', fmtCurrency(parseNum(form.adminFee), prop.currency)],
                        ['Deposit', `${form.deposit} months`],
                      ] as const
                    ).map(([l, v]) => (
                      <div key={l}>
                        <div className="fs11 text3 mb4">{l}</div>
                        <div className="fs13 fw5">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <label className="flex gap8 align-center fs13" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.activateNow}
                  onChange={(e) => setForm((p) => ({ ...p, activateNow: e.target.checked }))}
                />
                Activate immediately {active ? `(archives ${active.tenant})` : ''}
              </label>
              {!form.activateNow && (
                <div className="info-box mt8">Saved as draft — activate later from the Contracts tab.</div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <div>{step > 1 && <button className="ghost" onClick={() => setStep((s) => s - 1)}>← Back</button>}</div>
          <div className="flex gap8">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            {step < 2 ? (
              <button type="button" className="primary" onClick={() => setStep(2)} disabled={!valid1}>
                Review →
              </button>
            ) : (
              <button type="button" className="primary" onClick={save}>
                {form.activateNow ? 'Activate contract' : 'Save as draft'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
