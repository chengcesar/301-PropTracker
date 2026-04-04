import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PLANS } from '../../lib/planConfig'
import type { PlanId } from '../../lib/planConfig'

export type UpgradeReason = 'property-limit' | 'ai-limit'

type Props = {
  reason: UpgradeReason
  onClose: () => void
}

const CONTENT: Record<UpgradeReason, { title: string; body: string; icon: string }> = {
  'property-limit': {
    icon: '🏠',
    title: 'Property limit reached',
    body: "You've used all your property slots on the current plan. Upgrade to add more.",
  },
  'ai-limit': {
    icon: '✨',
    title: 'AI analysis limit reached',
    body: "You've used all your AI report generations on the current plan. Upgrade for more.",
  },
}

// Only show public plans in the upgrade modal, ordered by property limit ascending
const UPGRADE_PLANS = (Object.entries(PLANS) as [PlanId, typeof PLANS[PlanId]][])
  .filter(([, p]) => p.public)
  .sort((a, b) => {
    const aL = a[1].propertyLimit ?? Infinity
    const bL = b[1].propertyLimit ?? Infinity
    return aL - bL
  })

function PlanCard({ def }: { def: typeof PLANS[PlanId] }) {
  const propLabel = def.propertyLimit === null ? 'Unlimited' : `${def.propertyLimit} properties`
  const aiLabel = def.aiLimit === null ? 'Unlimited AI reports' : `${def.aiLimit} AI reports`
  const uploadLabel = def.uploadLimit === null ? 'Uploads on all properties' : `Uploads on first ${def.uploadLimit} properties`

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
      flex: 1,
      minWidth: 140,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
          color: def.badgeColor,
          background: `${def.badgeColor}18`,
          borderRadius: 6, padding: '2px 8px',
        }}>
          {def.label}
        </span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
        <div>✓ {propLabel}</div>
        <div>✓ {aiLabel}</div>
        <div>✓ {uploadLabel}</div>
      </div>
    </div>
  )
}

export function UpgradeModal({ reason, onClose }: Props) {
  const { title, body, icon } = CONTENT[reason]

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-sm"
        style={{ maxWidth: 460 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title" id="upgrade-modal-title">{icon} {title}</div>
            <div className="modal-sub">{body}</div>
          </div>
          <button
            className="ghost"
            style={{ padding: '4px 10px', fontSize: 22, lineHeight: 1, color: 'var(--text3)', marginLeft: 12 }}
            onClick={onClose}
            aria-label="Close"
          >×</button>
        </div>

        {/* Plan comparison */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Available plans
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {UPGRADE_PLANS.map(([id, def]) => (
              <PlanCard key={id} def={def} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="ghost" style={{ fontSize: 13, color: 'var(--text3)' }} onClick={onClose}>
            Maybe later
          </button>
          <button
            className="primary"
            onClick={() => {
              // TODO: wire to Stripe checkout when payment is integrated
              window.open('mailto:cheng.cesar@gmail.com?subject=PropTracker upgrade', '_blank')
              onClose()
            }}
          >
            Upgrade plan →
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
