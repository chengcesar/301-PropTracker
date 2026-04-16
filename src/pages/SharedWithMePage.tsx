import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { subscribeViewerShares } from '../services/sharesService'
import type { Share } from '../lib/types'
import AuthHeader from '../components/AuthHeader'

function shareLabel(share: Share): string {
  if (share.scope === 'portfolio') return 'Full portfolio access'
  if (share.scope === 'properties') return `${share.propertyIds.length} specific propert${share.propertyIds.length === 1 ? 'y' : 'ies'}`
  if (share.filters.length === 0) return 'Filtered view (no filters set)'
  return share.filters
    .map((f) => `${f.field.charAt(0).toUpperCase() + f.field.slice(1)} = ${f.values.join(', ')}`)
    .join(' · ')
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatDate(ms: number | null): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SharedWithMePage() {
  const { user } = useAuth() as unknown as { user: any }
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    return subscribeViewerShares(user.uid, (s) => {
      setShares(s)
      setLoading(false)
    })
  }, [user])

  return (
    <>
      <AuthHeader />
      <div className="content">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1d23', margin: 0 }}>Shared with me</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Portfolios and views shared with your account</p>
        </div>

        {shares.length > 0 && (
          <section>
            <div className="sharing-section-label">ACTIVE ({shares.length})</div>
            <div className="sharing-list">
              {shares.map((s) => (
                <div key={s.id} className="sharing-row">
                  <div className="sharing-avatar">
                    {initials(s.ownerDisplayName || s.granteeEmail)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sharing-email">
                      {s.ownerDisplayName || s.ownerUid}
                    </div>
                    <div className="sharing-scope">
                      {s.ownerPortfolioName && (
                        <span style={{ fontWeight: 500, color: '#374151' }}>{s.ownerPortfolioName} · </span>
                      )}
                      {shareLabel(s)}
                    </div>
                    {s.acceptedAt && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                        Accepted {formatDate(s.acceptedAt)}
                      </div>
                    )}
                  </div>
                  <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    Active
                  </span>
                  <Link
                    to={`/shared/${s.id}`}
                    className="sharing-btn-secondary"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  >
                    View portfolio
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && shares.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#6b7280', fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>No shared portfolios yet</div>
            <div>When someone shares their portfolio with you, it will appear here.</div>
          </div>
        )}
      </div>
    </>
  )
}
