import { useMemo, useState } from 'react'
import { useAppState } from '../../context/useAppState'
import type { PropertyContact } from '../../lib/types'

const CONTACT_ROLES = ['Owner', 'Property Manager', 'Building Manager', 'Broker', 'Insurance', 'Lawyer', 'Accountant', 'Architect', 'Contractor', 'Plumber', 'MEP', 'Other']

type Props = {
  currentPropertyId: number
  currentContacts: PropertyContact[]
  onPick: (contact: PropertyContact) => void
  onClose: () => void
}

type FlatContact = PropertyContact & { propertyId: number; propertyName: string }

export function ContactPickerModal({ currentPropertyId, currentContacts, onPick, onClose }: Props) {
  const { properties } = useAppState()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  const allContacts = useMemo<FlatContact[]>(() =>
    properties
      .filter((p) => p.id !== currentPropertyId)
      .flatMap((prop) =>
        (prop.factSheet?.contacts ?? []).map((c) => ({
          ...c,
          propertyId: prop.id,
          propertyName: prop.name,
        }))
      ),
    [properties, currentPropertyId]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allContacts.filter((row) => {
      if (roleFilter !== 'All' && row.role !== roleFilter) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.role.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.propertyName.toLowerCase().includes(q)
      )
    })
  }, [allContacts, query, roleFilter])

  function isAlreadyAdded(c: FlatContact) {
    return currentContacts.some(
      (existing) => existing.name === c.name && existing.email === c.email
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Browse contacts</div>
            <div className="modal-sub">Select a contact to copy into this property</div>
          </div>
          <button type="button" className="ghost" style={{ padding: '4px 8px', fontSize: 16 }} onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {/* Filter row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="filter-search-wrap" style={{ flex: 1, minWidth: 160 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="6.5" cy="6.5" r="4.5" stroke="#9ca3af" strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search name, role…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="contacts-filter-select"
            >
              <option value="All">All roles</option>
              {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {allContacts.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-title">No contacts from other properties</div>
              <div className="fs12 text3 mt4">Add contacts to your other properties first</div>
            </div>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: 380 }}>
              <table className="cf-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Name</th>
                    <th style={{ textAlign: 'left' }}>Role</th>
                    <th style={{ textAlign: 'left' }}>Phone</th>
                    <th style={{ textAlign: 'left' }}>Email</th>
                    <th style={{ textAlign: 'left' }}>From property</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280', fontSize: 13 }}>
                        No contacts match your search
                      </td>
                    </tr>
                  ) : filtered.map((row) => {
                    const added = isAlreadyAdded(row)
                    return (
                      <tr key={`${row.propertyId}-${row.id}`} style={{ opacity: added ? 0.5 : 1 }}>
                        <td style={{ textAlign: 'left', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ textAlign: 'left' }}>
                          <span className="badge rented">{row.role}</span>
                        </td>
                        <td style={{ textAlign: 'left', fontSize: 13 }}>{row.phone || '—'}</td>
                        <td style={{ textAlign: 'left', fontSize: 13 }}>{row.email || '—'}</td>
                        <td style={{ textAlign: 'left', fontSize: 12, color: '#6b7280' }}>{row.propertyName}</td>
                        <td style={{ textAlign: 'right' }}>
                          {added ? (
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>Already added</span>
                          ) : (
                            <button
                              type="button"
                              className="primary"
                              style={{ fontSize: 12, padding: '4px 12px' }}
                              onClick={() => onPick(row)}
                            >
                              Add
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <span className="fs12 text3">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
          <button type="button" className="ghost" style={{ fontSize: 13 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
