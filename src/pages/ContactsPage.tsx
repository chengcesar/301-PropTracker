import { useMemo, useState } from 'react'
import { useAppState } from '../context/useAppState'
import type { PropertyContact } from '../lib/types'

const CONTACT_ROLES = ['Owner', 'Property Manager', 'Building Manager', 'Broker', 'Insurance', 'Lawyer', 'Accountant', 'Architect', 'Contractor', 'Plumber', 'MEP', 'Other']

type FlatContact = PropertyContact & { propertyId: number; propertyName: string }

export function ContactsPage() {
  const { properties, setSelectedId } = useAppState()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [propFilter, setPropFilter] = useState('All')
  const [previewContact, setPreviewContact] = useState<FlatContact | null>(null)

  const allContacts = useMemo<FlatContact[]>(() =>
    properties.flatMap((prop) =>
      (prop.factSheet?.contacts ?? []).map((c) => ({
        ...c,
        propertyId: prop.id,
        propertyName: prop.name,
      }))
    ),
    [properties]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allContacts.filter((row) => {
      if (roleFilter !== 'All' && row.role !== roleFilter) return false
      if (propFilter !== 'All' && row.propertyName !== propFilter) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.role.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.propertyName.toLowerCase().includes(q) ||
        (row.phone && row.phone.toLowerCase().includes(q))
      )
    })
  }, [allContacts, query, roleFilter, propFilter])

  const uniqueProperties = useMemo(() =>
    Array.from(new Set(allContacts.map((c) => c.propertyName))).sort(),
    [allContacts]
  )

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of CONTACT_ROLES) counts[r] = 0
    for (const c of allContacts) {
      if (c.role in counts) counts[c.role]++
    }
    return counts
  }, [allContacts])

  return (
    <div className="main">
      <div className="page-header mb24">
        <div>
          <div className="page-title">Contacts</div>
          <div className="fs12 text3 mt4">
            {allContacts.length} contact{allContacts.length !== 1 ? 's' : ''} across {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="contacts-filter-bar mb16">
        <div className="filter-search-wrap">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="#9ca3af" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search name, role, or property…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="contacts-filter-select"
        >
          <option value="All">All roles ({allContacts.length})</option>
          {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r} ({roleCounts[r] ?? 0})</option>)}
        </select>
        <select
          value={propFilter}
          onChange={(e) => setPropFilter(e.target.value)}
          className="contacts-filter-select"
        >
          <option value="All">All properties</option>
          {uniqueProperties.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {allContacts.length === 0 ? (
        <div className="card">
          <div className="card-inner">
            <div className="empty-state" style={{ padding: 32 }}>
              <div className="empty-title">No contacts yet</div>
              <div className="fs12 text3 mt4">Add contacts to your properties in the Fact Sheet tab to see them here</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'left' }}>Role</th>
                <th style={{ textAlign: 'left' }}>Phone</th>
                <th style={{ textAlign: 'left' }}>Email</th>
                <th className="col-bank" style={{ textAlign: 'left' }}>Bank Institution</th>
                <th className="col-acct" style={{ textAlign: 'left' }}>Account Details</th>
                <th style={{ textAlign: 'left' }}>Property</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280', fontSize: 13 }}>
                    No contacts match your filters
                  </td>
                </tr>
              ) : filtered.map((row) => (
                <tr
                  key={`${row.propertyId}-${row.id}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setPreviewContact(row)}
                >
                  <td style={{ textAlign: 'left', fontWeight: 500 }}>{row.name}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="badge rented">{row.role}</span>
                  </td>
                  <td style={{ textAlign: 'left', fontSize: 13 }}>{row.phone || '—'}</td>
                  <td style={{ textAlign: 'left', fontSize: 13 }}>{row.email || '—'}</td>
                  <td className="col-bank" style={{ textAlign: 'left', fontSize: 13 }}>{row.bankInstitution || '—'}</td>
                  <td className="col-acct" style={{ textAlign: 'left', fontSize: 13 }}>{row.accountDetails || '—'}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button
                      type="button"
                      className="ghost"
                      style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(row.propertyId) }}
                    >
                      {row.propertyName}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewContact && (
        <ContactPreviewModal contact={previewContact} onClose={() => setPreviewContact(null)} onGoToProperty={() => { setSelectedId(previewContact.propertyId); setPreviewContact(null) }} />
      )}
    </div>
  )
}

function ContactPreviewModal({ contact, onClose, onGoToProperty }: { contact: FlatContact; onClose: () => void; onGoToProperty: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{contact.name}</div>
            <div className="modal-sub">{contact.propertyName}</div>
          </div>
          <button type="button" className="ghost" style={{ padding: '4px 8px', fontSize: 16 }} onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex gap8 align-center">
              <span className="badge rented">{contact.role}</span>
            </div>
            {contact.phone && <PreviewRow label="Phone" value={contact.phone} />}
            {contact.email && <PreviewRow label="Email" value={contact.email} />}
            {contact.bankInstitution && <PreviewRow label="Bank Institution" value={contact.bankInstitution} />}
            {contact.accountDetails && <PreviewRow label="Account Details" value={contact.accountDetails} />}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="ghost" style={{ fontSize: 13 }} onClick={onClose}>Close</button>
          <button type="button" className="primary" style={{ fontSize: 13 }} onClick={onGoToProperty}>Go to property →</button>
        </div>
      </div>
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 14, color: '#1a1d23' }}>{value}</span>
    </div>
  )
}
