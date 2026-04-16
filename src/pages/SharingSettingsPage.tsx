import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeOwnerShares, revokeShare, cancelShare } from '../services/sharesService'
import type { Share } from '../lib/types'
import AuthHeader from '../components/AuthHeader'
import { InviteModal } from '../components/sharing/InviteModal'
import { ConfirmDialog } from '../components/ConfirmDialog'

function StatusBadge({ status }: { status: 'pending' | 'active' }) {
  const styles: Record<string, React.CSSProperties> = {
    active: { background: '#d1fae5', color: '#065f46' },
    pending: { background: '#fef3c7', color: '#92400e' },
  }
  return (
    <span style={{ ...styles[status], borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function shareLabel(share: Share): string {
  if (share.scope === 'portfolio') return 'Full portfolio access'
  if (share.scope === 'properties') return `${share.propertyIds.length} specific propert${share.propertyIds.length === 1 ? 'y' : 'ies'}`
  if (share.filters.length === 0) return 'Filtered view (no filters set)'
  return share.filters
    .map((f) => `${f.field.charAt(0).toUpperCase() + f.field.slice(1)} = ${f.values.join(', ')}`)
    .join(' · ')
}

function initials(email: string): string {
  return email[0].toUpperCase()
}

export function SharingSettingsPage() {
  const { user } = useAuth() as unknown as { user: any }
  const [shares, setShares] = useState<Share[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ type: 'revoke' | 'cancel'; shareId: string; email: string } | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeOwnerShares(user.uid, (s) => {
      setShares(s)
      setLoading(false)
    })
  }, [user])

  const activeShares = shares.filter((s) => s.status === 'active')
  const pendingShares = shares.filter((s) => s.status === 'pending')

  async function handleConfirm() {
    if (!confirmAction) return
    if (confirmAction.type === 'revoke') await revokeShare(confirmAction.shareId)
    else await cancelShare(confirmAction.shareId)
    setConfirmAction(null)
  }

  return (
    <>
      <AuthHeader />
      <div className="content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1d23', margin: 0 }}>Sharing &amp; Access</h1>
            <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Control who can view your portfolio</p>
          </div>
          <button className="add-btn" onClick={() => setInviteOpen(true)}>+ Invite viewer</button>
        </div>

        {activeShares.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div className="sharing-section-label">ACTIVE ({activeShares.length})</div>
            <div className="sharing-list">
              {activeShares.map((s) => (
                <div key={s.id} className="sharing-row">
                  <div className="sharing-avatar">{initials(s.granteeEmail)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sharing-email">{s.granteeEmail}</div>
                    <div className="sharing-scope">{shareLabel(s)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                        {`${window.location.origin}/invite/${s.inviteToken}`}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status="active" />
                  <button
                    className="sharing-btn-secondary"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${s.inviteToken}`)}
                  >
                    Copy link
                  </button>
                  <button className="sharing-btn-danger" onClick={() => setConfirmAction({ type: 'revoke', shareId: s.id, email: s.granteeEmail })}>Revoke</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {pendingShares.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div className="sharing-section-label">PENDING ({pendingShares.length})</div>
            <div className="sharing-list">
              {pendingShares.map((s) => (
                <div key={s.id} className="sharing-row">
                  <div className="sharing-avatar" style={{ background: '#fef3c7', color: '#92400e' }}>{initials(s.granteeEmail)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sharing-email">{s.granteeEmail}</div>
                    <div className="sharing-scope">{shareLabel(s)} · Invite not yet accepted</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                        {`${window.location.origin}/invite/${s.inviteToken}`}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status="pending" />
                  <button
                    className="sharing-btn-secondary"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${s.inviteToken}`)}
                  >
                    Copy link
                  </button>
                  <button className="sharing-btn-danger" onClick={() => setConfirmAction({ type: 'cancel', shareId: s.id, email: s.granteeEmail })}>Cancel</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && shares.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280', fontSize: 14 }}>
            No active shares. Click "Invite viewer" to share your portfolio.
          </div>
        )}
      </div>

      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.type === 'revoke' ? 'Revoke access' : 'Cancel invite'}
          message={confirmAction.type === 'revoke'
            ? `Revoke access for ${confirmAction.email}? They will immediately lose access to this portfolio.`
            : `Cancel the invite for ${confirmAction.email}? The invite link will stop working.`
          }
          confirmLabel={confirmAction.type === 'revoke' ? 'Revoke' : 'Cancel invite'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  )
}
