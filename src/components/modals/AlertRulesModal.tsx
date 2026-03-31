import { useState } from 'react'
import type { AlertRuleConfigV1, AlertSeverity, CompareOp, TriggerKind, UserAlertRule } from '../../lib/alertRuleConfig'
import {
  COMPARE_OPS,
  cloneAlertRuleConfig,
  createDefaultAlertRuleConfig,
  emptyUserRule,
  validateAlertRuleConfig,
} from '../../lib/alertRuleConfig'

const OP_LABELS: Record<CompareOp, string> = {
  eq: '=',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  between: 'Between',
}

const TRIGGER_LABELS: Record<TriggerKind, string> = {
  vacant: 'Property is vacant',
  monthsLeft: 'Months until contract ends',
  taxDaysLeft: 'Days until tax due',
}

type Props = {
  config: AlertRuleConfigV1
  onSave: (c: AlertRuleConfigV1) => void
  onClose: () => void
}

function triggerKind(t: UserAlertRule['trigger']): TriggerKind {
  return t.kind
}

function setTriggerKind(prev: UserAlertRule, kind: TriggerKind): UserAlertRule {
  if (kind === 'vacant') return { ...prev, trigger: { kind: 'vacant' } }
  if (kind === 'monthsLeft')
    return { ...prev, trigger: { kind: 'monthsLeft', op: 'lte', value: 1, value2: undefined } }
  return { ...prev, trigger: { kind: 'taxDaysLeft', op: 'lte', value: 30, value2: undefined } }
}

export function AlertRulesModal({ config, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(() => cloneAlertRuleConfig(config))
  const [error, setError] = useState<string | null>(null)

  const updateRule = (id: string, patch: Partial<UserAlertRule> | ((r: UserAlertRule) => UserAlertRule)) => {
    setDraft(d => ({
      ...d,
      rules: d.rules.map(r => {
        if (r.id !== id) return r
        return typeof patch === 'function' ? patch(r) : { ...r, ...patch }
      }),
    }))
    setError(null)
  }

  const save = () => {
    const err = validateAlertRuleConfig(draft)
    if (err) {
      setError(err)
      return
    }
    onSave(draft)
    onClose()
  }

  const resetDefaults = () => {
    setDraft(createDefaultAlertRuleConfig())
    setError(null)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal ar-rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Alert rules</div>
            <div className="modal-sub">When a property matches a trigger, it appears in Alerts with the severity you choose.</div>
          </div>
          <button type="button" className="ghost" onClick={onClose} style={{ fontSize: '18px', padding: '4px 8px' }}>
            ×
          </button>
        </div>
        <div className="modal-body ar-rules-body">
          {error && <div className="ar-rules-error">{error}</div>}
          <div className="ar-rules-list">
            {draft.rules.map((rule, idx) => (
              <div key={rule.id} className={`ar-rule-card${rule.enabled ? '' : ' ar-rule-card-disabled'}`}>
                <div className="ar-rule-card-top">
                  <label className="ar-rules-check">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                    />
                    <span>On</span>
                  </label>
                  <button type="button" className="ghost fs11 ar-rule-remove" onClick={() => {
                    setDraft(d => ({ ...d, rules: d.rules.filter(r => r.id !== rule.id) }))
                    setError(null)
                  }}>
                    Remove
                  </button>
                </div>
                <div className="ar-flow">
                  <div className="ar-flow-node">
                    <span className="ar-flow-label">When</span>
                    <select
                      className="ar-select"
                      value={triggerKind(rule.trigger)}
                      onChange={(e) => updateRule(rule.id, r => setTriggerKind(r, e.target.value as TriggerKind))}
                    >
                      {(Object.keys(TRIGGER_LABELS) as TriggerKind[]).map(k => (
                        <option key={k} value={k}>{TRIGGER_LABELS[k]}</option>
                      ))}
                    </select>
                    {rule.trigger.kind !== 'vacant' && (
                      <div className="ar-condition-row">
                        <select
                          className="ar-select ar-select-narrow"
                          value={rule.trigger.op}
                          onChange={(e) => {
                            const op = e.target.value as CompareOp
                            updateRule(rule.id, r => {
                              const t = r.trigger
                              if (t.kind === 'vacant') return r
                              const next = op === 'between'
                                ? { ...t, op, value2: t.value2 ?? t.value }
                                : { ...t, op, value2: undefined }
                              return { ...r, trigger: next }
                            })
                          }}
                        >
                          {COMPARE_OPS.map(op => (
                            <option key={op} value={op}>{OP_LABELS[op]}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className="ar-input-num"
                          value={rule.trigger.value}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10)
                            updateRule(rule.id, r => {
                              const t = r.trigger
                              if (t.kind === 'vacant') return r
                              return { ...r, trigger: { ...t, value: Number.isFinite(v) ? v : 0 } }
                            })
                          }}
                        />
                        {rule.trigger.op === 'between' && (
                          <>
                            <span className="ar-between-sep">and</span>
                            <input
                              type="number"
                              className="ar-input-num"
                              value={rule.trigger.value2 ?? ''}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                updateRule(rule.id, r => {
                                  const t = r.trigger
                                  if (t.kind === 'vacant' || t.op !== 'between') return r
                                  return {
                                    ...r,
                                    trigger: {
                                      ...t,
                                      value2: Number.isFinite(v) ? v : t.value,
                                    },
                                  }
                                })
                              }}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ar-flow-connector" aria-hidden />
                  <div className="ar-flow-node">
                    <span className="ar-flow-label">Do</span>
                    <select
                      className="ar-select"
                      value={rule.severity}
                      onChange={(e) => updateRule(rule.id, { severity: e.target.value as AlertSeverity })}
                    >
                      <option value="critical">Severity: Critical</option>
                      <option value="warning">Severity: Warning</option>
                      <option value="info">Severity: Info</option>
                    </select>
                    <input
                      type="text"
                      className="ar-input-label"
                      placeholder="Badge label (optional)"
                      value={rule.label ?? ''}
                      onChange={(e) => updateRule(rule.id, { label: e.target.value || undefined })}
                    />
                  </div>
                </div>
                {idx < draft.rules.length - 1 && <div className="ar-rules-divider" />}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ghost fs12 ar-add-rule"
            onClick={() => {
              setDraft(d => ({ ...d, rules: [...d.rules, emptyUserRule()] }))
              setError(null)
            }}
          >
            + Add rule
          </button>
        </div>
        <div className="modal-footer">
          <button type="button" className="ghost fs12" onClick={resetDefaults}>
            Reset to defaults
          </button>
          <div className="flex gap8">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
