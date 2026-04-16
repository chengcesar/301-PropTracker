import { useState, useRef } from 'react'

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
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function copyLink() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="65.6367" y="30.0342" width="12.3568" height="52.4532" fill="#6D2F20"/>
              <rect x="38.832" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
              <rect x="12" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
              <path d="M78.001 30.3232H65.623C65.5666 22.9727 59.5914 17.0313 52.2275 17.0312C44.8636 17.0312 38.8884 22.9726 38.832 30.3232H24.332V7H78.001V30.3232Z" fill="#6D2F20"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1d23', margin: 0 }}>Invite link created</h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Share this link with {granteeEmail}</p>
        </div>
        <div className="invite-link-box">{link}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <button className="btn-save" style={{ width: '100%' }} onClick={copyLink}>Copy link</button>
            {copied && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                background: '#1a1d23', color: '#fff', fontSize: 12, fontWeight: 500,
                padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap',
                pointerEvents: 'none', animation: 'toastFadeIn 0.15s ease',
              }}>
                Copied!
              </div>
            )}
          </div>
          <button className="filter-bar-btn" style={{ flex: 1 }} disabled>
            Open in email ✉
          </button>
        </div>
        <button className="filter-bar-btn" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
