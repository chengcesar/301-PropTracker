type Props = {
  inviteToken: string
  granteeEmail: string
  onClose: () => void
}

export function InviteLinkScreen({ inviteToken, granteeEmail, onClose }: Props) {
  const link = `${window.location.origin}/invite/${inviteToken}`
  const subject = encodeURIComponent('You have been invited to view a portfolio on PropTracker')
  const body = encodeURIComponent(`Hi,\n\nYou have been invited to view a portfolio on PropTracker. Click the link below to accept:\n\n${link}\n\nThis link is personal — please do not share it.`)
  const mailtoHref = `mailto:${granteeEmail}?subject=${subject}&body=${body}`

  function copyLink() {
    navigator.clipboard.writeText(link)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1d23', margin: 0 }}>Invite link created</h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Share this link with {granteeEmail}</p>
        </div>
        <div className="invite-link-box">{link}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn-save" style={{ flex: 1 }} onClick={copyLink}>Copy link</button>
          <a href={mailtoHref} className="filter-bar-btn" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Open in email ✉
          </a>
        </div>
        <button className="filter-bar-btn" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
