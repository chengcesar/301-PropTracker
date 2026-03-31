/**
 * User-configurable property alerts for the leaderboard map.
 * Persistence: localStorage v1; swap load/save implementation for Firestore later.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info'

export type CompareOp = 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'between'

export type AlertTrigger =
  | { kind: 'vacant' }
  | { kind: 'monthsLeft'; op: CompareOp; value: number; value2?: number }
  | { kind: 'taxDaysLeft'; op: CompareOp; value: number; value2?: number }

export interface UserAlertRule {
  id: string
  enabled: boolean
  trigger: AlertTrigger
  severity: AlertSeverity
  /** Optional badge override; otherwise auto-generated */
  label?: string
}

export interface AlertRuleConfigV1 {
  version: 1
  rules: UserAlertRule[]
}

export interface AlertPropertyMetrics {
  monthsLeft: number | null
  vacant: boolean
  taxPending: boolean
  taxDaysLeft: number | null
}

export interface EvaluatedAlertMatch {
  userRuleId: string
  severity: AlertSeverity
  label: string
  describe: string
  pulseRgb: [number, number, number]
}

const STORAGE_KEY = 'proptracker_alert_rules_v1'

const PULSE_BY_SEVERITY: Record<AlertSeverity, [number, number, number]> = {
  critical: [185, 28, 28],
  warning: [217, 119, 6],
  info: [59, 130, 246],
}

export const COMPARE_OPS: CompareOp[] = ['eq', 'lt', 'lte', 'gt', 'gte', 'between']

export const TRIGGER_KINDS = ['vacant', 'monthsLeft', 'taxDaysLeft'] as const
export type TriggerKind = (typeof TRIGGER_KINDS)[number]

export function pulseRgbForSeverity(s: AlertSeverity): [number, number, number] {
  return PULSE_BY_SEVERITY[s]
}

function compareN(n: number, op: CompareOp, value: number, value2?: number): boolean {
  switch (op) {
    case 'eq':
      return n === value
    case 'lt':
      return n < value
    case 'lte':
      return n <= value
    case 'gt':
      return n > value
    case 'gte':
      return n >= value
    case 'between':
      if (value2 == null || Number.isNaN(value2)) return false
      return n >= value && n <= value2
    default:
      return false
  }
}

function triggerMatches(trigger: AlertTrigger, p: AlertPropertyMetrics): boolean {
  switch (trigger.kind) {
    case 'vacant':
      return p.vacant
    case 'monthsLeft':
      if (p.monthsLeft == null) return false
      return compareN(p.monthsLeft, trigger.op, trigger.value, trigger.value2)
    case 'taxDaysLeft':
      if (!p.taxPending || p.taxDaysLeft == null) return false
      return compareN(p.taxDaysLeft, trigger.op, trigger.value, trigger.value2)
    default:
      return false
  }
}

function describeForTrigger(trigger: AlertTrigger, p: AlertPropertyMetrics): string {
  switch (trigger.kind) {
    case 'vacant':
      return 'No active contract — property is vacant'
    case 'monthsLeft':
      if (p.monthsLeft == null) return 'Contract end date unknown'
      {
        const m = p.monthsLeft
        return `Contract expires in ${m} month${m === 1 ? '' : 's'}`
      }
    case 'taxDaysLeft':
      if (!p.taxPending || p.taxDaysLeft == null) return 'No pending property tax'
      if (p.taxDaysLeft <= 0) return 'Tax payment is overdue'
      return `Tax due in ${p.taxDaysLeft} days`
    default:
      return 'Alert'
  }
}

function autoLabel(trigger: AlertTrigger): string {
  switch (trigger.kind) {
    case 'vacant':
      return 'Vacant'
    case 'monthsLeft':
      return opLabel('Months left', trigger.op, trigger.value, trigger.value2)
    case 'taxDaysLeft':
      return opLabel('Tax days', trigger.op, trigger.value, trigger.value2)
    default:
      return 'Alert'
  }
}

function opLabel(prefix: string, op: CompareOp, value: number, value2?: number): string {
  switch (op) {
    case 'eq':
      return `${prefix} = ${value}`
    case 'lt':
      return `${prefix} < ${value}`
    case 'lte':
      return `${prefix} ≤ ${value}`
    case 'gt':
      return `${prefix} > ${value}`
    case 'gte':
      return `${prefix} ≥ ${value}`
    case 'between':
      return value2 != null ? `${prefix} ${value}–${value2}` : `${prefix} (range)`
    default:
      return prefix
  }
}

export function ruleLabel(rule: UserAlertRule): string {
  if (rule.label?.trim()) return rule.label.trim()
  return autoLabel(rule.trigger)
}

/** All matching enabled rules, in config order */
export function evaluatePropertyAlerts(config: AlertRuleConfigV1, p: AlertPropertyMetrics): EvaluatedAlertMatch[] {
  const out: EvaluatedAlertMatch[] = []
  for (const rule of config.rules) {
    if (!rule.enabled) continue
    if (!triggerMatches(rule.trigger, p)) continue
    out.push({
      userRuleId: rule.id,
      severity: rule.severity,
      label: ruleLabel(rule),
      describe: describeForTrigger(rule.trigger, p),
      pulseRgb: PULSE_BY_SEVERITY[rule.severity],
    })
  }
  return out
}

export function hasCriticalAlert(config: AlertRuleConfigV1, p: AlertPropertyMetrics): boolean {
  return evaluatePropertyAlerts(config, p).some(m => m.severity === 'critical')
}

export function firstCriticalPulseColor(config: AlertRuleConfigV1, p: AlertPropertyMetrics): [number, number, number] {
  for (const m of evaluatePropertyAlerts(config, p)) {
    if (m.severity === 'critical') return m.pulseRgb
  }
  return PULSE_BY_SEVERITY.critical
}

export function createDefaultAlertRuleConfig(): AlertRuleConfigV1 {
  return {
    version: 1,
    rules: [
      {
        id: 'default-vacant',
        enabled: true,
        trigger: { kind: 'vacant' },
        severity: 'critical',
        label: 'Vacant',
      },
      {
        id: 'default-contract-1mo',
        enabled: true,
        trigger: { kind: 'monthsLeft', op: 'lte', value: 1 },
        severity: 'critical',
        label: 'Expiring < 1 mo',
      },
      {
        id: 'default-contract-3mo',
        enabled: true,
        trigger: { kind: 'monthsLeft', op: 'between', value: 2, value2: 3 },
        severity: 'warning',
        label: 'Expiring < 3 mo',
      },
      {
        id: 'default-contract-6mo',
        enabled: true,
        trigger: { kind: 'monthsLeft', op: 'between', value: 4, value2: 6 },
        severity: 'info',
        label: 'Expiring < 6 mo',
      },
      {
        id: 'default-tax-10d',
        enabled: true,
        trigger: { kind: 'taxDaysLeft', op: 'lte', value: 10 },
        severity: 'critical',
        label: 'Tax overdue',
      },
      {
        id: 'default-tax-30d',
        enabled: true,
        trigger: { kind: 'taxDaysLeft', op: 'between', value: 11, value2: 30 },
        severity: 'warning',
        label: 'Tax due < 30d',
      },
      {
        id: 'default-tax-90d',
        enabled: true,
        trigger: { kind: 'taxDaysLeft', op: 'between', value: 31, value2: 90 },
        severity: 'info',
        label: 'Tax due < 90d',
      },
    ],
  }
}

function isCompareOp(x: unknown): x is CompareOp {
  return typeof x === 'string' && (COMPARE_OPS as readonly string[]).includes(x)
}

function isSeverity(x: unknown): x is AlertSeverity {
  return x === 'critical' || x === 'warning' || x === 'info'
}

function normalizeTrigger(raw: unknown): AlertTrigger | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = o.kind
  if (kind === 'vacant') return { kind: 'vacant' }
  if (kind === 'monthsLeft' || kind === 'taxDaysLeft') {
    if (!isCompareOp(o.op)) return null
    const value = typeof o.value === 'number' && Number.isFinite(o.value) ? Math.round(o.value) : null
    if (value === null) return null
    const value2 =
      typeof o.value2 === 'number' && Number.isFinite(o.value2) ? Math.round(o.value2 as number) : undefined
    if (o.op === 'between' && value2 == null) return null
    return { kind, op: o.op, value, ...(value2 != null ? { value2 } : {}) } as AlertTrigger
  }
  return null
}

function normalizeRule(raw: unknown): UserAlertRule | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : null
  if (!id) return null
  const enabled = o.enabled !== false
  if (!isSeverity(o.severity)) return null
  const trigger = normalizeTrigger(o.trigger)
  if (!trigger) return null
  const label = typeof o.label === 'string' ? o.label : undefined
  return { id, enabled, trigger, severity: o.severity, label }
}

function parseStoredConfig(raw: unknown): AlertRuleConfigV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.rules)) return null
  const rules: UserAlertRule[] = []
  for (const r of o.rules) {
    const rule = normalizeRule(r)
    if (rule) rules.push(rule)
  }
  if (rules.length === 0) return null
  return { version: 1, rules }
}

/** Load from localStorage; falls back to defaults if missing or invalid */
export function loadAlertRuleConfig(): AlertRuleConfigV1 {
  if (typeof localStorage === 'undefined') return createDefaultAlertRuleConfig()
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return createDefaultAlertRuleConfig()
    const parsed = JSON.parse(s) as unknown
    const config = parseStoredConfig(parsed)
    return config ?? createDefaultAlertRuleConfig()
  } catch {
    return createDefaultAlertRuleConfig()
  }
}

export function saveAlertRuleConfig(config: AlertRuleConfigV1): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* ignore quota */
  }
}

export function newUserRuleId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `rule-${crypto.randomUUID()}`
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyUserRule(): UserAlertRule {
  return {
    id: newUserRuleId(),
    enabled: true,
    trigger: { kind: 'monthsLeft', op: 'lte', value: 1 },
    severity: 'warning',
  }
}

/** Deep clone for draft editing */
export function cloneAlertRuleConfig(config: AlertRuleConfigV1): AlertRuleConfigV1 {
  return JSON.parse(JSON.stringify(config)) as AlertRuleConfigV1
}

/** Validate config before save (modal). Returns error message or null */
export function validateAlertRuleConfig(config: AlertRuleConfigV1): string | null {
  if (config.version !== 1 || !Array.isArray(config.rules)) return 'Invalid config shape'
  for (const rule of config.rules) {
    if (!rule.id) return 'Every rule needs an id'
    const t = rule.trigger
    if (t.kind === 'monthsLeft' || t.kind === 'taxDaysLeft') {
      if (!Number.isFinite(t.value)) return 'Enter a valid number for each rule'
      if (t.op === 'between') {
        if (t.value2 == null || !Number.isFinite(t.value2)) return '"Between" needs two numbers'
        if (t.value > t.value2) return 'Range min must be ≤ max'
      }
    }
  }
  return null
}
