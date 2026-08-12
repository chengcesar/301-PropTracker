import { Fragment, useState } from 'react'
import type { Contract, Property } from '../../lib/types'
import { fmtCurrency } from '../../lib/format'
import { EditContractModal } from '../modals/EditContractModal'
import { NewContractModal } from '../modals/NewContractModal'

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
}

function incrementSummary(c: Contract): string {
  switch (c.increment) {
    case 'fixed':
      return `Fixed ${c.fixedPct}%`
    case 'ipc':
      return `IPC ${c.cpiEstimatePct}%`
    case 'ipc+':
      return `IPC ${c.cpiEstimatePct}% + ${c.ipcExtra}%`
    case 'none':
    default:
      return 'None'
  }
}

export function ContractsTab({ prop, onUpdateProp }: Props) {
  const [newModal, setNewModal] = useState(false)
  const [editModal, setEditModal] = useState<Contract | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const sorted = [...prop.contracts].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

  const archiveContract = (id: number) => {
    onUpdateProp((p) => ({
      ...p,
      contracts: p.contracts.map((c) => (c.id === id ? { ...c, status: 'archived' as const } : c)),
    }))
    setConfirmArchive(null)
  }

  const activateContract = (id: number) => {
    onUpdateProp((p) => ({
      ...p,
      contracts: p.contracts.map((c) =>
        c.id === id
          ? { ...c, status: 'active' as const }
          : c.status === 'active'
            ? { ...c, status: 'archived' as const }
            : c,
      ),
    }))
  }

  const deleteContract = (id: number) => {
    onUpdateProp((p) => ({ ...p, contracts: p.contracts.filter((c) => c.id !== id) }))
    setConfirmDelete(null)
  }

  const saveNew = (contracts: Contract[]) => onUpdateProp((p) => ({ ...p, contracts }))

  const saveEdit = (updated: Contract) => {
    onUpdateProp((p) => ({
      ...p,
      contracts: p.contracts.map((c) => (c.id === updated.id ? updated : c)),
    }))
  }

  return (
    <div>
      <div className="sec-hdr mb12">
        <span className="sec-title">Contract history</span>
        <button type="button" className="primary" style={{ fontSize: '12px', padding: '5px 14px' }} onClick={() => setNewModal(true)}>
          + New contract
        </button>
      </div>
      <div className="contract-timeline">
        <div className="ct-line" />
        {sorted.length === 0 && (
          <div className="empty-state">
            <div className="empty-title">No contracts yet</div>
            <div className="fs12 text3 mt4">Add a contract to start tracking this property</div>
            <button type="button" className="primary mt12" onClick={() => setNewModal(true)}>
              + Add first contract
            </button>
          </div>
        )}
        {sorted.map((c, idx) => {
          const prev = sorted[idx - 1]
          const gapExists = prev && new Date(c.endDate) < new Date(prev.startDate)
          return (
            <Fragment key={c.id}>
              {gapExists && (
                <div className="ct-gap">
                  <span className="dot vacant" style={{ flexShrink: 0 }} />
                  <div>
                    <div className="fs12 fw5" style={{ color: 'var(--amber)' }}>
                      Vacancy gap
                    </div>
                    <div className="fs11 text3">
                      {c.endDate} → {prev.startDate}
                    </div>
                  </div>
                </div>
              )}
              <div className="ct-item">
                <div className={`ct-dot ${c.status}`} />
                <div className={`ct-card ${c.status === 'active' ? 'active-card' : c.status === 'draft' ? 'draft-card' : ''}`}>
                  <div className="ct-header">
                    <div>
                      <div className="ct-tenant">{c.tenant || '—'}</div>
                      <div className="ct-dates">
                        {c.startDate} → {c.endDate}
                      </div>
                    </div>
                    <span className={`badge ${c.status === 'active' ? 'active-c' : c.status === 'draft' ? 'draft-c' : 'archived-c'}`}>
                      {c.status === 'active' ? 'Active' : c.status === 'draft' ? 'Draft' : 'Archived'}
                    </span>
                  </div>
                  <div className="ct-fields mb8">
                    <div>
                      <div className="ct-field-label">Rent</div>
                      <div className="ct-field-val">{c.monthlyRent ? fmtCurrency(c.monthlyRent, prop.currency) : '—'}</div>
                    </div>
                    <div>
                      <div className="ct-field-label">Admin fee</div>
                      <div className="ct-field-val">{c.adminFee ? fmtCurrency(c.adminFee, prop.currency) : '—'}</div>
                    </div>
                    <div>
                      <div className="ct-field-label">Increment</div>
                      <div className="ct-field-val">{incrementSummary(c)}</div>
                    </div>
                    <div>
                      <div className="ct-field-label">Deposit</div>
                      <div className="ct-field-val">{c.deposit} mo.</div>
                    </div>
                  </div>
                  {c.notes && <div className="info-box mb8 fs11">{c.notes}</div>}
                  <div className="ct-actions">
                    <button type="button" className="ghost fs12" onClick={() => setEditModal(c)}>
                      Edit
                    </button>
                    {c.status === 'active' && (
                      <button type="button" className="warning fs12" onClick={() => setConfirmArchive(c.id)}>
                        Archive
                      </button>
                    )}
                    {c.status === 'draft' && (
                      <button
                        type="button"
                        className="primary"
                        style={{ fontSize: '12px', padding: '4px 12px' }}
                        onClick={() => activateContract(c.id)}
                      >
                        Activate
                      </button>
                    )}
                    {c.status === 'archived' && (
                      <button type="button" className="ghost fs12" onClick={() => activateContract(c.id)}>
                        Reactivate
                      </button>
                    )}
                    <button type="button" className="danger fs12" onClick={() => setConfirmDelete(c.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>

      {confirmArchive !== null && (
        <div className="modal-overlay" onClick={() => setConfirmArchive(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Archive contract?</div>
                <div className="modal-sub">Property will show vacant until a new contract is added</div>
              </div>
            </div>
            <div className="modal-body">
              <div className="warn-box">Historical expense data linked to this contract is preserved.</div>
            </div>
            <div className="modal-footer">
              <button type="button" className="ghost" onClick={() => setConfirmArchive(null)}>
                Cancel
              </button>
              <button type="button" className="warning" onClick={() => archiveContract(confirmArchive)}>
                Archive contract
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Delete contract?</div>
                <div className="modal-sub">This will permanently remove the contract and all associated data</div>
              </div>
            </div>
            <div className="modal-body">
              <div className="warn-box">This action cannot be undone. All expense data linked to this contract will be lost.</div>
            </div>
            <div className="modal-footer">
              <button type="button" className="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={() => deleteContract(confirmDelete)}>
                Delete contract
              </button>
            </div>
          </div>
        </div>
      )}
      {newModal && <NewContractModal prop={prop} onSave={saveNew} onClose={() => setNewModal(false)} />}
      {editModal && <EditContractModal contract={editModal} currency={prop.currency} onSave={saveEdit} onClose={() => setEditModal(null)} />}
    </div>
  )
}
