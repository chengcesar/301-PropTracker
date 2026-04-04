import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PLANS } from '../../lib/planConfig'
import type { PlanId, PlanDefinition } from '../../lib/planConfig'
import { useAuth } from '../../contexts/AuthContext'

export type UpgradeReason = 'property-limit' | 'ai-limit'

type Props = {
  reason: UpgradeReason
  onClose: () => void
}

const CONTENT: Record<UpgradeReason, { title: string; body: string; icon: string | null }> = {
  'property-limit': {
    icon: null,
    title: 'Exceeds current plan',
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

function PlanCard({ def, isCurrent }: { def: PlanDefinition; isCurrent: boolean }) {
  const propLabel = def.propertyLimit === null ? 'Unlimited' : `${def.propertyLimit} properties`
  const aiLabel = def.aiLimit === null ? 'Unlimited AI reports' : `${def.aiLimit} AI reports`
  const uploadLabel = def.uploadLimit === null ? 'Uploads on all properties' : `Uploads on first ${def.uploadLimit} properties`
  const p = def.pricing

  return (
    <div style={{
      border: isCurrent ? `2px solid ${def.badgeColor}` : '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
      flex: 1,
      minWidth: 140,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      background: isCurrent ? `${def.badgeColor}08` : undefined,
    }}>
      {/* Badge */}
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

      {/* Price */}
      {p && (
        <div style={{ minHeight: 44 }}>
          {p.monthly === null ? (
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>Contact us</div>
          ) : p.monthly === 0 ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', verticalAlign: 'super', lineHeight: 1 }}>$</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>0</span>
              <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 2 }}>{p.freeLabel}</span>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                {p.monthlyOriginal && (
                  <span style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'line-through', marginRight: 2 }}>
                    {p.monthlyOriginal.toFixed(2)}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', verticalAlign: 'super', lineHeight: 1 }}>$</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{p.monthly}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 2 }}>/ month</span>
              </div>
              {p.annual && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  <span style={{ fontSize: 10 }}>$</span> {p.annual.toFixed(2)} / year
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Features */}
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, flex: 1 }}>
        <div>✓ {propLabel}</div>
        <div>✓ {aiLabel}</div>
        <div>✓ {uploadLabel}</div>
      </div>

      {/* CTA button */}
      <button
        disabled={isCurrent}
        style={{
          marginTop: 4,
          width: '100%',
          padding: '8px 0',
          borderRadius: 8,
          border: 'none',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          cursor: isCurrent ? 'default' : 'pointer',
          background: isCurrent ? 'var(--accent-bg-subtle, #eff6ff)' : 'var(--accent-bg, #3b82f6)',
          color: isCurrent ? 'var(--accent-bg, #3b82f6)' : '#fff',
          transition: 'opacity 0.15s',
        }}
        onClick={isCurrent ? undefined : () => {
          window.open('mailto:cheng.cesar@gmail.com?subject=PropTracker upgrade', '_blank')
        }}
      >
        {isCurrent ? 'Current' : 'Choose'}
      </button>
    </div>
  )
}

export function UpgradeModal({ reason, onClose }: Props) {
  const { title, body, icon } = CONTENT[reason]
  const { plan: currentPlan } = (useAuth() as unknown) as { plan: PlanId }

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
        style={{ maxWidth: 620 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title" id="upgrade-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {icon === null
                ? <img src="/App-Icon.svg" alt="" style={{ width: 22, height: 22, flexShrink: 0 }} />
                : <span>{icon}</span>}
              {title}
            </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }} className="upgrade-plans-grid">
            {UPGRADE_PLANS.map(([id, def]) => (
              <PlanCard key={id} def={def} isCurrent={id === currentPlan} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="ghost" style={{ fontSize: 13, color: 'var(--text3)' }} onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
