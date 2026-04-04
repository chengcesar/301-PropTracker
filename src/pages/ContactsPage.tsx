import { useMemo, useState } from 'react'
import { useAppState } from '../context/useAppState'
import type { PropertyContact } from '../lib/types'

const CONTACT_ROLES = ['Owner', 'Property Manager', 'Building Manager', 'Broker', 'Insurance', 'Lawyer', 'Accountant', 'Architect', 'Contractor', 'Plumber', 'MEP', 'Other']

type FlatContact = PropertyContact & { propertyId: number; propertyName: string }

type ContactAssignment = {
  propertyId: number
  propertyName: string
  sourceContactId: number
  role: string
  phone: string
  email: string
  bankInstitution?: string
  accountDetails?: string
  name: string
}

type MergedContact = {
  mergeKey: string
  displayName: string
  roles: string[]
  assignments: ContactAssignment[]
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Same person across properties: email, else phone digits, else name+role (weak). */
function mergeKeyFor(row: FlatContact): string {
  const em = row.email?.trim()
  if (em) return `e:${normalizeEmail(em)}`
  const ph = digitsOnly(row.phone || '')
  if (ph.length > 0) return `p:${ph}`
  return `n:${normalizeToken(row.name)}|r:${normalizeToken(row.role)}`
}

function toAssignment(row: FlatContact): ContactAssignment {
  return {
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    sourceContactId: row.id,
    role: row.role,
    phone: row.phone,
    email: row.email,
    bankInstitution: row.bankInstitution,
    accountDetails: row.accountDetails,
    name: row.name,
  }
}

function mergeContacts(flat: FlatContact[]): MergedContact[] {
  const map = new Map<string, MergedContact>()
  for (const row of flat) {
    const key = mergeKeyFor(row)
    const assignment = toAssignment(row)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        mergeKey: key,
        displayName: row.name.trim(),
        roles: [],
        assignments: [assignment],
      })
    } else {
      existing.assignments.push(assignment)
      const t = row.name.trim()
      if (t.length > existing.displayName.length) existing.displayName = t
    }
  }
  const list = [...map.values()]
  for (const m of list) {
    m.assignments.sort((a, b) => a.propertyName.localeCompare(b.propertyName, undefined, { sensitivity: 'base' }))
    m.roles = [...new Set(m.assignments.map((a) => a.role))].sort()
  }
  list.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
  return list
}

function distinctNonEmpty(values: (string | undefined)[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const t = (v ?? '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function formatMergedField(values: (string | undefined)[]): string {
  const d = distinctNonEmpty(values)
  if (d.length === 0) return '—'
  if (d.length === 1) return d[0]!
  return `${d[0]!} (+${d.length - 1})`
}

function mergedMatchesFilters(m: MergedContact, query: string, roleFilter: string, propFilter: string): boolean {
  if (roleFilter !== 'All' && !m.assignments.some((a) => a.role === roleFilter)) return false
  if (propFilter !== 'All' && !m.assignments.some((a) => a.propertyName === propFilter)) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (m.displayName.toLowerCase().includes(q)) return true
  if (m.roles.some((r) => r.toLowerCase().includes(q))) return true
  return m.assignments.some((a) =>
    a.propertyName.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.role.toLowerCase().includes(q) ||
    a.email.toLowerCase().includes(q) ||
    (a.phone && a.phone.toLowerCase().includes(q)) ||
    (a.bankInstitution && a.bankInstitution.toLowerCase().includes(q)) ||
    (a.accountDetails && a.accountDetails.toLowerCase().includes(q))
  )
}

export function ContactsPage() {
  const { properties, setSelectedId } = useAppState()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [propFilter, setPropFilter] = useState('All')
  const [previewContact, setPreviewContact] = useState<MergedContact | null>(null)

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

  const mergedContacts = useMemo(() => mergeContacts(allContacts), [allContacts])

  const filtered = useMemo(
    () => mergedContacts.filter((m) => mergedMatchesFilters(m, query, roleFilter, propFilter)),
    [mergedContacts, query, roleFilter, propFilter]
  )

  const uniqueProperties = useMemo(
    () => Array.from(new Set(allContacts.map((c) => c.propertyName))).sort(),
    [allContacts]
  )

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of CONTACT_ROLES) counts[r] = 0
    for (const m of mergedContacts) {
      for (const r of CONTACT_ROLES) {
        if (m.assignments.some((a) => a.role === r)) counts[r]++
      }
    }
    return counts
  }, [mergedContacts])

  const totalLinks = allContacts.length

  return (
    <div className="main contacts-page">
      <div className="page-header mb24">
        <div>
          <div className="page-title">Contacts</div>
          <div className="fs12 text3 mt4">
            {mergedContacts.length} contact{mergedContacts.length !== 1 ? 's' : ''}
            {totalLinks !== mergedContacts.length && (
              <> · {totalLinks} property link{totalLinks !== 1 ? 's' : ''}</>
            )}
            {' '}across {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
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
          <option value="All">All roles ({mergedContacts.length})</option>
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
                <th style={{ textAlign: 'left' }}>Properties</th>
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
                  key={row.mergeKey}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setPreviewContact(row)}
                >
                  <td style={{ textAlign: 'left', fontWeight: 500 }}>{row.displayName}</td>
                  <td style={{ textAlign: 'left' }}>
                    {row.roles.length === 1 ? (
                      <span className="badge rented">{row.roles[0]}</span>
                    ) : (
                      <span className="badge rented" title={row.roles.join(', ')}>
                        Multiple roles ({row.roles.length})
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'left', fontSize: 13 }}>{formatMergedField(row.assignments.map((a) => a.phone))}</td>
                  <td style={{ textAlign: 'left', fontSize: 13 }}>{formatMergedField(row.assignments.map((a) => a.email))}</td>
                  <td className="col-bank" style={{ textAlign: 'left', fontSize: 13 }}>{formatMergedField(row.assignments.map((a) => a.bankInstitution))}</td>
                  <td className="col-acct" style={{ textAlign: 'left', fontSize: 13 }}>{formatMergedField(row.assignments.map((a) => a.accountDetails))}</td>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {row.assignments.map((a) => (
                        <button
                          key={`${a.propertyId}-${a.sourceContactId}`}
                          type="button"
                          className="ghost"
                          style={{ fontSize: 12, padding: '3px 10px' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedId(a.propertyId) }}
                        >
                          {a.propertyName}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewContact && (
        <ContactPreviewModal
          contact={previewContact}
          onClose={() => setPreviewContact(null)}
          onOpenProperty={(id) => { setSelectedId(id); setPreviewContact(null) }}
        />
      )}
    </div>
  )
}

function ContactPreviewModal({
  contact,
  onClose,
  onOpenProperty,
}: {
  contact: MergedContact
  onClose: () => void
  onOpenProperty: (propertyId: number) => void
}) {
  const phones = distinctNonEmpty(contact.assignments.map((a) => a.phone))
  const emails = distinctNonEmpty(contact.assignments.map((a) => a.email))
  const banks = distinctNonEmpty(contact.assignments.map((a) => a.bankInstitution))
  const accts = distinctNonEmpty(contact.assignments.map((a) => a.accountDetails))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{contact.displayName}</div>
            <div className="modal-sub">
              {contact.assignments.length} propert{contact.assignments.length !== 1 ? 'ies' : 'y'}
            </div>
          </div>
          <button type="button" className="ghost" style={{ padding: '4px 8px', fontSize: 16 }} onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="flex gap8 align-center flex-wrap">
              {contact.roles.map((r) => (
                <span key={r} className="badge rented">{r}</span>
              ))}
            </div>

            {phones.length <= 1 && phones[0] && <PreviewRow label="Phone" value={phones[0]} />}
            {phones.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280' }}>Phone (varies by property)</span>
                {contact.assignments.filter((a) => a.phone?.trim()).map((a) => (
                  <div key={`${a.propertyId}-ph`} style={{ fontSize: 13, color: '#1a1d23' }}>
                    <span style={{ color: '#6b7280' }}>{a.propertyName}:</span> {a.phone}
                  </div>
                ))}
              </div>
            )}
            {phones.length === 0 && <PreviewRow label="Phone" value="—" />}

            {emails.length <= 1 && emails[0] && <PreviewRow label="Email" value={emails[0]} />}
            {emails.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280' }}>Email (varies by property)</span>
                {contact.assignments.filter((a) => a.email?.trim()).map((a) => (
                  <div key={`${a.propertyId}-em`} style={{ fontSize: 13, color: '#1a1d23' }}>
                    <span style={{ color: '#6b7280' }}>{a.propertyName}:</span> {a.email}
                  </div>
                ))}
              </div>
            )}
            {emails.length === 0 && <PreviewRow label="Email" value="—" />}

            {banks.length === 1 && <PreviewRow label="Bank Institution" value={banks[0]!} />}
            {banks.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280' }}>Bank (varies by property)</span>
                {contact.assignments.filter((a) => a.bankInstitution?.trim()).map((a) => (
                  <div key={`${a.propertyId}-bk`} style={{ fontSize: 13, color: '#1a1d23' }}>
                    <span style={{ color: '#6b7280' }}>{a.propertyName}:</span> {a.bankInstitution}
                  </div>
                ))}
              </div>
            )}

            {accts.length === 1 && <PreviewRow label="Account Details" value={accts[0]!} />}
            {accts.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280' }}>Account details (varies by property)</span>
                {contact.assignments.filter((a) => a.accountDetails?.trim()).map((a) => (
                  <div key={`${a.propertyId}-ac`} style={{ fontSize: 13, color: '#1a1d23' }}>
                    <span style={{ color: '#6b7280' }}>{a.propertyName}:</span> {a.accountDetails}
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280' }}>Open property</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {contact.assignments.map((a) => (
                  <button
                    key={`${a.propertyId}-${a.sourceContactId}`}
                    type="button"
                    className="ghost"
                    style={{ fontSize: 13, justifyContent: 'flex-start', textAlign: 'left' }}
                    onClick={() => onOpenProperty(a.propertyId)}
                  >
                    {a.propertyName} →
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="ghost" style={{ fontSize: 13 }} onClick={onClose}>Close</button>
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
