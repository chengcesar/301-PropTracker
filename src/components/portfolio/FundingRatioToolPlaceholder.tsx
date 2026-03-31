import { useMemo, useState, type CSSProperties } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

/** Trimmed from Temp/FundingRatioCalculator.jsx — sample goals only (no table). */

const pvLump = (fv: number, r: number, n: number) => fv / (1 + r) ** n

const pvAnnuity = (pmt: number, r: number, n: number) => {
  if (r === 0) return pmt * n
  return (pmt * (1 - (1 + r) ** -n)) / r
}

const fmt = (n: number) => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`
  return `${sign}$${Math.round(abs).toLocaleString()}`
}

const STATUS = [
  { max: 0.8, label: 'Serious risk', accent: '#E24B4A', badgeBg: '#FEE2E2', text: '#991B1B' },
  { max: 0.95, label: 'Fragile', accent: '#D97706', badgeBg: '#FEF3C7', text: '#92400E' },
  { max: 1.1, label: 'Stable', accent: '#059669', badgeBg: '#D1FAE5', text: '#065F46' },
  { max: Infinity, label: 'Strong surplus', accent: 'var(--accent-bg)', badgeBg: '#DBEAFE', text: '#1E40AF' },
] as const

function getStatus(ratio: number) {
  return STATUS.find((s) => ratio < s.max) ?? STATUS[3]
}

type GoalType = 'lump' | 'annuity'
type Priority = 'essential' | 'important' | 'aspirational'

type Goal = {
  id: number
  name: string
  type: GoalType
  year: number
  amount: number
  priority: Priority
}

const SAMPLE_GOALS: Goal[] = [
  { id: 0, name: 'Annual lifestyle', type: 'annuity', year: 10, amount: 120_000, priority: 'essential' },
  { id: 1, name: 'Property CAPEX', type: 'lump', year: 5, amount: 300_000, priority: 'important' },
  { id: 2, name: 'Retirement reserve', type: 'lump', year: 10, amount: 1_500_000, priority: 'essential' },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  essential: '#E24B4A',
  important: '#D97706',
  aspirational: '#059669',
}

function buildCashflowData(goals: Goal[], inflationPct: number) {
  if (!goals.length) return []
  const maxYear = Math.max(...goals.map((g) => g.year), 1)
  const inf = (Number(inflationPct) || 0) / 100

  return Array.from({ length: maxYear }, (_, i) => {
    const yr = i + 1
    const entry: Record<string, string | number> = { year: `Yr ${yr}` }
    goals.forEach((g) => {
      const inflated = Math.round(g.amount * (1 + inf) ** yr)
      if (g.type === 'annuity' && yr <= g.year) entry[g.name] = inflated
      else if (g.type === 'lump' && yr === g.year) entry[g.name] = inflated
    })
    return entry
  })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: readonly { dataKey?: unknown; value?: unknown; fill?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => typeof p.value === 'number' && p.value > 0)
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>{label}</div>
      {items.map((p) => (
        <div
          key={String(p.dataKey)}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--text2)', marginBottom: 2 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, display: 'inline-block' }} />
            {String(p.dataKey)}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmt(p.value as number)}</span>
        </div>
      ))}
    </div>
  )
}

function AssumptionCard({
  label,
  value,
  onChange,
  suffix = '%',
  readOnly,
  hint,
}: {
  label: string
  value: number | string
  onChange?: (v: string) => void
  suffix?: string
  readOnly?: boolean
  hint?: string
}) {
  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        flex: 1,
        minWidth: 120,
        opacity: readOnly ? 0.9 : 1,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
        {label}
        {hint ? <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>{hint}</span> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {readOnly ? (
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
        ) : (
          <input
            type="number"
            value={value}
            min={0}
            max={30}
            step={0.1}
            onChange={(e) => onChange?.(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text)',
              padding: '2px 0',
              outline: 'none',
            }}
          />
        )}
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{suffix}</span>
      </div>
    </div>
  )
}

function GaugeBar({ ratio }: { ratio: number }) {
  const pct = Math.min((ratio / 1.3) * 100, 100)
  const status = getStatus(ratio)
  const zones = [
    { pct: (0.8 / 1.3) * 100, color: '#FECACA' },
    { pct: (0.95 / 1.3) * 100, color: '#FDE68A' },
    { pct: (1.1 / 1.3) * 100, color: '#A7F3D0' },
    { pct: 100, color: '#BFDBFE' },
  ]

  return (
    <div style={{ margin: '8px 0 6px' }}>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
        {zones.map((z, i) => {
          const prev = i === 0 ? 0 : zones[i - 1].pct
          return <div key={i} style={{ width: `${z.pct - prev}%`, background: z.color, height: '100%' }} />
        })}
        <div
          style={{
            position: 'absolute',
            left: `calc(${Math.round(pct)}% - 2px)`,
            top: -2,
            width: 4,
            height: 14,
            background: status.accent.startsWith('var') ? '#2563eb' : status.accent,
            borderRadius: 2,
            transition: 'left 0.4s ease',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--text3)',
          marginTop: 4,
          padding: '0 1px',
        }}
      >
        <span>0%</span>
        <span>80%</span>
        <span>95%</span>
        <span>110%</span>
        <span>130%+</span>
      </div>
    </div>
  )
}

export function FundingRatioToolPlaceholder() {
  const [inflation, setInflation] = useState(3)
  const [expReturn, setExpReturn] = useState(6)
  const [portfolioValue, setPortfolioValue] = useState(2_000_000)

  const discountRate = (((1 + expReturn / 100) / (1 + inflation / 100) - 1) * 100).toFixed(2)

  const r = (parseFloat(discountRate) || 0) / 100
  const totalPV = SAMPLE_GOALS.reduce((s, g) => {
    const pv = g.type === 'annuity' ? pvAnnuity(g.amount, r, g.year) : pvLump(g.amount, r, g.year)
    return s + pv
  }, 0)
  const ratio = totalPV > 0 ? portfolioValue / totalPV : 0
  const gap = portfolioValue - totalPV
  const status = getStatus(ratio)

  const chartData = useMemo(() => buildCashflowData(SAMPLE_GOALS, inflation), [inflation])
  const goalNames = SAMPLE_GOALS.map((g) => g.name)

  const sectionLabel: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: 'var(--text3)',
    textTransform: 'uppercase',
    margin: '0 0 10px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, color: 'var(--text)', fontFamily: 'var(--font)' }}>
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Placeholder preview from the funding ratio pattern: assumptions, stacked spending chart, and ratio readout.
        Sample goals are fixed; full goal editor lives in the Temp widget.
      </p>

      <p style={sectionLabel}>Assumptions</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <AssumptionCard label="Inflation rate" value={inflation} onChange={(v) => setInflation(Number(v) || 0)} />
        <AssumptionCard label="Expected return" value={expReturn} onChange={(v) => setExpReturn(Number(v) || 0)} />
        <AssumptionCard label="Real discount rate" value={discountRate} suffix="%" readOnly hint="(auto)" />
      </div>

      <p style={sectionLabel}>Projected spending by year</p>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="28%" barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => fmt(v)}
              tick={{ fontSize: 11, fill: 'var(--text3)' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface2)' }} />
            {goalNames.map((name, i) => {
              const goal = SAMPLE_GOALS.find((g) => g.name === name)
              const color = PRIORITY_COLORS[goal?.priority ?? 'important']
              const opacity = goal?.priority === 'essential' ? 1 : goal?.priority === 'important' ? 0.8 : 0.55
              return (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="a"
                  fill={color}
                  fillOpacity={opacity}
                  radius={i === goalNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '18px 0' }} />
      <p style={sectionLabel}>Current portfolio value</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="number"
          value={portfolioValue}
          min={0}
          step={10_000}
          onChange={(e) => setPortfolioValue(Number(e.target.value))}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text)',
            background: 'var(--surface2)',
            outline: 'none',
            width: 180,
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>vs {fmt(totalPV)} PV of goals</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1,
            color: status.accent.startsWith('var') ? 'var(--accent-bg)' : status.accent,
          }}
        >
          {Math.round(ratio * 100)}%
        </div>
        <div style={{ paddingBottom: 6 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 12,
              fontWeight: 600,
              background: status.badgeBg,
              color: status.text,
              borderRadius: 20,
              padding: '3px 12px',
              marginBottom: 4,
            }}
          >
            {status.label}
          </span>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Funding ratio</div>
        </div>
      </div>

      <GaugeBar ratio={ratio} />

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'PV of goals', value: fmt(totalPV), color: 'var(--text)' },
          { label: 'Portfolio today', value: fmt(portfolioValue), color: 'var(--text)' },
          {
            label: gap >= 0 ? 'Surplus' : 'Shortfall',
            value: `${gap >= 0 ? '+' : ''}${fmt(gap)}`,
            color: gap >= 0 ? '#059669' : '#E24B4A',
          },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              flex: 1,
              minWidth: 100,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
