import { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useAppState } from '../../context/useAppState'
import { createShare } from '../../services/sharesService'
import { applyShareFilters, filterFieldValues } from '../../lib/shareFilters'
import { InviteLinkScreen } from './InviteLinkScreen'
import type { ShareScope, ShareFilter, ShareFilterField } from '../../lib/types'

const FILTER_FIELD_LABELS: Record<ShareFilterField, string> = {
  owner: 'Owner',
  country: 'Country',
  city: 'City',
  group: 'Group',
}

const ALL_FILTER_FIELDS: ShareFilterField[] = ['owner', 'country', 'city', 'group']

type Props = {
  onClose: () => void
}

export function InviteModal({ onClose }: Props) {
  const { user } = useAuth() as unknown as { user: any }
  const { properties } = useAppState()
  const [email, setEmail] = useState('')
  const [scope, setScope] = useState<ShareScope>('filtered')
  const [filters, setFilters] = useState<ShareFilter[]>([{ field: 'owner', values: [] }])
  const [saving, setSaving] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewCount = useMemo(() => {
    return applyShareFilters(properties, scope, filters, []).length
  }, [properties, scope, filters])

  function addFilter() {
    const usedFields = new Set(filters.map((f) => f.field))
    const nextField = ALL_FILTER_FIELDS.find((f) => !usedFields.has(f)) ?? 'owner'
    setFilters((prev) => [...prev, { field: nextField, values: [] }])
  }

  function removeFilter(idx: number) {
    setFilters((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateFilterField(idx: number, field: ShareFilterField) {
    setFilters((prev) => prev.map((f, i) => i === idx ? { field, values: [] } : f))
  }

  function toggleFilterValue(idx: number, value: string) {
    setFilters((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f
        const next = f.values.includes(value)
          ? f.values.filter((v) => v !== value)
          : [...f.values, value]
        return { ...f, values: next }
      }),
    )
  }

  async function handleSubmit() {
    if (!email.trim() || !user) return
    setSaving(true)
    setError(null)
    try {
      const { inviteToken: token } = await createShare({
        ownerUid: user.uid,
        ownerDisplayName: user.displayName || user.email,
        ownerPortfolioName: `${(user.displayName || user.email.split('@')[0])}'s Portfolio`,
        granteeEmail: email.trim().toLowerCase(),
        scope,
        filters: scope === 'filtered' ? filters.filter((f) => f.values.length > 0) : [],
        propertyIds: [],
      })
      setInviteToken(token)
    } catch (e) {
      setError('Failed to create invite. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (inviteToken) {
    return <InviteLinkScreen inviteToken={inviteToken} granteeEmail={email} onClose={onClose} />
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1d23', marginTop: 0, marginBottom: 20 }}>Invite viewer</h2>

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-label">EMAIL ADDRESS</label>
          <input
            type="email"
            className="input"
            placeholder="viewer@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-label">ACCESS SCOPE</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['filtered', 'portfolio'] as ShareScope[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`filter-bar-btn scope-btn${scope === s ? ' active' : ''}`}
                onClick={() => setScope(s)}
              >
                {s === 'filtered' ? 'Filtered view' : 'Full portfolio'}
              </button>
            ))}
          </div>
        </div>

        {scope === 'filtered' && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">FILTERS <span style={{ fontWeight: 400, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>(all must match)</span></label>
            {filters.map((filter, idx) => {
              const availableValues = filterFieldValues(properties, filter.field)
              return (
                <div key={idx} className="filter-builder-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <select
                      className="input"
                      style={{ flex: 1, padding: '5px 8px', fontSize: 13 }}
                      value={filter.field}
                      onChange={(e) => updateFilterField(idx, e.target.value as ShareFilterField)}
                    >
                      {ALL_FILTER_FIELDS.map((f) => (
                        <option key={f} value={f}>{FILTER_FIELD_LABELS[f]}</option>
                      ))}
                    </select>
                    <span style={{ color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>is any of</span>
                    {filters.length > 1 && (
                      <button type="button" className="filter-bar-btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => removeFilter(idx)}>✕</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {availableValues.map((v) => (
                      <button
                        key={v}
                        type="button"
                        style={{
                          borderRadius: 5, padding: '3px 9px', fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
                          background: filter.values.includes(v) ? '#dbeafe' : '#f7f9fc',
                          color: filter.values.includes(v) ? '#1d4ed8' : '#6b7280',
                          outline: filter.values.includes(v) ? '1px solid #bfdbfe' : '1px solid #e8ecf2',
                        }}
                        onClick={() => toggleFilterValue(idx, v)}
                      >
                        {v}
                      </button>
                    ))}
                    {availableValues.length === 0 && (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>No values found for this field</span>
                    )}
                  </div>
                </div>
              )
            })}
            {filters.length < ALL_FILTER_FIELDS.length && (
              <button type="button" className="filter-bar-btn" style={{ width: '100%', marginTop: 6 }} onClick={addFilter}>
                + Add filter
              </button>
            )}
          </div>
        )}

        {scope === 'filtered' && (
          <div className="invite-preview-banner">
            Viewer will see <strong>{previewCount} propert{previewCount === 1 ? 'y' : 'ies'}</strong> matching current filters
          </div>
        )}

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="filter-bar-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-save"
            style={{ flex: 2 }}
            disabled={!email.trim() || saving}
            onClick={handleSubmit}
          >
            {saving ? 'Creating…' : 'Generate invite link'}
          </button>
        </div>
      </div>
    </div>
  )
}
