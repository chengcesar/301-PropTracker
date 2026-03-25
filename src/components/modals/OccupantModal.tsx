import { useState } from 'react'
import type { Occupant, OccupantRelation } from '../../lib/types'

const RELATIONS: OccupantRelation[] = ['Owner', 'Family', 'Caretaker', 'Other']

type Props = {
  occupant?: Occupant
  onSave: (occupant: Occupant) => void
  onClose: () => void
}

export function OccupantModal({ occupant, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name: occupant?.name ?? '',
    relation: occupant?.relation ?? ('Owner' as OccupantRelation),
    since: occupant?.since ?? '',
    notes: occupant?.notes ?? '',
  })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
  }

  const save = () => {
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      relation: form.relation,
      since: form.since || undefined,
      notes: form.notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">{occupant ? 'Edit occupant' : 'Add occupant'}</div>
            <div className="modal-sub">Non-rental occupant details</div>
          </div>
          <button type="button" className="ghost" onClick={onClose} style={{ fontSize: '18px', padding: '4px 8px' }}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="contract-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label>Name *</label>
              <input type="text" placeholder="Juan Perez" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Relation</label>
              <select value={form.relation} onChange={(e) => set('relation', e.target.value as OccupantRelation)}>
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Since</label>
              <input type="date" value={form.since} onChange={(e) => set('since', e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Notes</label>
              <input type="text" placeholder="e.g. Owner-occupied, no rent" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <span />
          <div className="flex gap8">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" className="primary" onClick={save}>
              {occupant ? 'Save' : 'Add occupant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
