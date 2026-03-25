import { useState } from 'react'
import type { Contract } from '../../lib/types'
import { parseNum } from '../../lib/format'
import { ContractForm, type ContractFormState } from './ContractForm'

type Props = {
  contract: Contract
  onSave: (c: Contract) => void
  onClose: () => void
}

export function EditContractModal({ contract, onSave, onClose }: Props) {
  const [form, setForm] = useState<ContractFormState>({
    tenant: contract.tenant,
    contractManager: contract.contractManager ?? '',
    monthlyRent: contract.monthlyRent,
    startDate: contract.startDate,
    endDate: contract.endDate,
    paymentDay: contract.paymentDay,
    deposit: contract.deposit,
    increment: contract.increment,
    ipcExtra: contract.ipcExtra,
    adminFee: contract.adminFee,
    notes: contract.notes,
  })

  const save = () => {
    onSave({
      ...contract,
      ...form,
      monthlyRent: parseNum(form.monthlyRent),
      adminFee: parseNum(form.adminFee),
      increment: form.increment as Contract['increment'],
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Edit — {contract.tenant}</div>
            <div className="modal-sub">
              {contract.status === 'archived' ? 'Archived contract (historical record)' : 'Active contract'}
            </div>
          </div>
          <button type="button" className="ghost" onClick={onClose} style={{ fontSize: '18px', padding: '4px 8px' }}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {contract.status === 'archived' && (
            <div className="warn-box mb16">Editing an archived contract updates the historical record only.</div>
          )}
          <ContractForm value={form} onChange={setForm} />
        </div>
        <div className="modal-footer">
          <span />
          <div className="flex gap8">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={save}>
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
