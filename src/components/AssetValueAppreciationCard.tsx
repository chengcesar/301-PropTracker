import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Property } from '../lib/types'
import { type CurrencyCode, type FxRates, convert } from '../lib/currency'
import { estimatedPropertyValueAtYear } from '../lib/finance'
import { fmtCurrency, fmtCurrencyM } from '../lib/format'
import { KpiInfoIcon } from './KpiInfoIcon'

export type AppreciationViewMode = 'absolute' | 'indexed' | 'aligned' | 'muted' | 'aggregate'

const VIEW_OPTIONS: { key: AppreciationViewMode; label: string; hint: string }[] = [
  { key: 'absolute', label: 'Absolute', hint: 'True values on a shared timeline (mixed scales).' },
  { key: 'indexed', label: 'Indexed to 100', hint: 'Rebase each property to 100 at its first year to compare growth rates.' },
  { key: 'aligned', label: 'Aligned start', hint: 'Only years on or after the latest property start — easier overlap, less history.' },
  { key: 'muted', label: 'Muted background', hint: 'Faint full history with a bold overlay from the aligned start year.' },
  {
    key: 'aggregate',
    label: 'Portfolio total',
    hint: 'Single trendline: combined portfolio value each year (FX-converted sums), rebased to 100 in the first year the total is positive—so you see overall growth as one series (new assets raise the total).',
  },
]

const SERIES_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#ef4444']

const CHART_GRID = '#eceff1'
const CHART_AXIS = '#78909c'

function AppreciationTooltipBody({
  active,
  payload,
  label,
  mode,
  displayCurrency,
}: {
  active?: boolean
  payload?: readonly { dataKey?: unknown; value?: unknown; name?: unknown; color?: string }[]
  label?: string | number
  mode: AppreciationViewMode
  displayCurrency: CurrencyCode
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.dataKey != null && !String(p.dataKey).endsWith('_bg'))
  if (rows.length === 0) return null
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${CHART_GRID}`,
        borderRadius: 12,
        fontSize: 13,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        padding: '10px 12px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>Year {label}</div>
      {rows.map((p, i) => {
        const n = typeof p.value === 'number' ? p.value : Number(p.value)
        const name = String(p.name ?? '')
        const text =
          !Number.isFinite(n)
            ? '—'
            : mode === 'indexed' || mode === 'aggregate'
              ? `${n.toFixed(1)}`
              : fmtCurrency(n, displayCurrency)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i ? 4 : 0 }}>
            <span style={{ width: 10, height: 3, background: p.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: '#546e7a' }}>{name}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{text}</span>
          </div>
        )
      })}
    </div>
  )
}

function chartYearBounds(properties: Property[]): { minY: number; maxY: number } {
  const cy = new Date().getFullYear()
  let minY = Infinity
  let maxY = cy
  for (const p of properties) {
    maxY = Math.max(maxY, p.year, cy)
    const fs = p.factSheet
    if (!fs) continue
    if (fs.purchaseDate) {
      const py = new Date(fs.purchaseDate).getFullYear()
      if (!Number.isNaN(py)) minY = Math.min(minY, py)
    }
    for (const k of Object.keys(fs.priceHistory ?? {})) {
      const y = Number(k)
      if (Number.isFinite(y)) {
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (!Number.isFinite(minY)) minY = cy - 14
  return { minY, maxY }
}

/** First calendar year used for alignment (model → purchase year; appraisal-only → chart min). */
function valueSeriesStartYear(p: Property, chartMinY: number): number | null {
  const fs = p.factSheet
  if (!fs) return null
  const purchasePrice = fs.purchasePrice
  const purchaseDate = fs.purchaseDate
  const purchaseYear = purchaseDate ? new Date(purchaseDate).getFullYear() : NaN
  const canModel =
    purchasePrice != null && purchasePrice > 0 && Boolean(purchaseDate) && !Number.isNaN(purchaseYear)
  if (canModel) return purchaseYear
  if (fs.currentValue != null && fs.currentValue > 0) return chartMinY
  return null
}

function seriesChipStyle(on: boolean, lineColor: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${on ? lineColor : '#e5e7eb'}`,
    background: on ? `${lineColor}14` : '#f9fafb',
    color: on ? 'var(--text)' : 'var(--text3)',
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  }
}

interface Props {
  properties: Property[]
  displayCurrency: CurrencyCode
  fxRates: FxRates
}

export function AssetValueAppreciationCard({ properties, displayCurrency, fxRates }: Props) {
  const [mode, setMode] = useState<AppreciationViewMode>('indexed')
  /** Property IDs excluded from the chart (chips off). */
  const [excludedIds, setExcludedIds] = useState<Set<number>>(() => new Set())

  const togglePropertySeries = useCallback((id: number) => {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const { chipList, seriesList, chartRows, commonStartYear, yLabel, emptyReason, chartBlockedReason, isAggregate } = useMemo(() => {
    const { minY, maxY } = chartYearBounds(properties)
    const years: number[] = []
    for (let y = minY; y <= maxY; y++) years.push(y)

    type Entry = { id: number; name: string; color: string; startYear: number; byYear: Map<number, number> }
    const entriesAll: Entry[] = []
    let colorIdx = 0

    for (const p of properties) {
      const startYear = valueSeriesStartYear(p, minY)
      if (startYear == null) continue
      const byYear = new Map<number, number>()
      for (const y of years) {
        const est = estimatedPropertyValueAtYear(p, y)
        if (est.value != null && est.value > 0) {
          byYear.set(y, convert(est.value, p.currency, displayCurrency, fxRates))
        }
      }
      if (byYear.size === 0) continue
      entriesAll.push({
        id: p.id,
        name: p.name,
        color: SERIES_COLORS[colorIdx % SERIES_COLORS.length],
        startYear,
        byYear,
      })
      colorIdx++
    }

    const chipList = entriesAll.map((e) => ({ id: e.id, name: e.name, color: e.color }))

    if (entriesAll.length === 0) {
      return {
        chipList: [] as { id: number; name: string; color: string }[],
        seriesList: [] as Entry[],
        chartRows: [] as Record<string, number | null>[],
        commonStartYear: minY,
        yLabel: '',
        emptyReason: 'Add purchase details or a current appraisal under Value & Equity / Fact sheet to see value trends.',
        chartBlockedReason: null as string | null,
        isAggregate: false,
      }
    }

    const entries = entriesAll.filter((e) => !excludedIds.has(e.id))

    if (entries.length === 0) {
      return {
        chipList,
        seriesList: [] as Entry[],
        chartRows: [] as Record<string, number | null>[],
        commonStartYear: minY,
        yLabel: '',
        emptyReason: null as string | null,
        chartBlockedReason: 'Turn on at least one property to show the chart.',
        isAggregate: false,
      }
    }

    const commonStart = Math.max(...entries.map(e => e.startYear))

    type Row = Record<string, number | null> & { year: number }

    if (mode === 'aggregate') {
      const sumAt = (y: number): number | null => {
        let sum = 0
        let any = false
        for (const e of entries) {
          const v = e.byYear.get(y)
          if (v != null) {
            sum += v
            any = true
          }
        }
        return any ? sum : null
      }

      let baseYear: number | null = null
      let baseSum: number | null = null
      for (const y of years) {
        const s = sumAt(y)
        if (s != null && s > 0) {
          baseYear = y
          baseSum = s
          break
        }
      }

      const aggRows: Row[] =
        baseYear == null || baseSum == null || baseSum <= 0
          ? years.map((y) => ({ year: y, combined: null as number | null }))
          : years.map((y) => {
              if (y < baseYear) return { year: y, combined: null }
              const s = sumAt(y)
              if (s == null) return { year: y, combined: null }
              return { year: y, combined: (s / baseSum) * 100 }
            })

      return {
        chipList,
        seriesList: entries,
        chartRows: aggRows,
        commonStartYear: baseYear ?? commonStart,
        yLabel: 'Portfolio index (start = 100)',
        emptyReason: null as string | null,
        chartBlockedReason: null as string | null,
        isAggregate: true,
      }
    }

    let rows: Row[] = years.map((year) => {
      const row: Row = { year }
      for (const e of entries) {
        const v = e.byYear.get(year)
        row[`v${e.id}`] = v !== undefined ? v : null
      }
      return row
    })

    const yLabel =
      mode === 'indexed'
        ? 'Index (start = 100)'
        : `Value (${displayCurrency})`

    if (mode === 'indexed') {
      rows = rows.map((row) => {
        const next: Row = { year: row.year }
        for (const e of entries) {
          const raw = row[`v${e.id}`] as number | null
          if (raw == null) {
            next[`v${e.id}`] = null
            continue
          }
          let base: number | null = null
          for (const y of years) {
            const vv = e.byYear.get(y)
            if (vv != null) {
              base = vv
              break
            }
          }
          next[`v${e.id}`] = base != null && base > 0 ? (raw / base) * 100 : null
        }
        return next
      })
    }

    if (mode === 'muted') {
      const nextRows: Row[] = rows.map((row) => {
        const r: Row = { year: row.year }
        for (const e of entries) {
          const abs = e.byYear.get(row.year)
          const val = abs !== undefined ? abs : null
          r[`v${e.id}_bg`] = val
          r[`v${e.id}_fg`] = row.year >= commonStart ? val : null
        }
        return r
      })
      return {
        chipList,
        seriesList: entries,
        chartRows: nextRows,
        commonStartYear: commonStart,
        yLabel: `Value (${displayCurrency})`,
        emptyReason: null as string | null,
        chartBlockedReason: null as string | null,
        isAggregate: false,
      }
    }

    if (mode === 'aligned') {
      rows = rows.filter((r) => r.year >= commonStart)
    }

    return {
      chipList,
      seriesList: entries,
      chartRows: rows,
      commonStartYear: commonStart,
      yLabel,
      emptyReason: null as string | null,
      chartBlockedReason: null as string | null,
      isAggregate: false,
    }
  }, [properties, displayCurrency, fxRates, mode, excludedIds])

  const footnote = VIEW_OPTIONS.find((o) => o.key === mode)?.hint ?? ''

  return (
    <div
      className="lb-panel ava-appreciation-panel"
      style={{ marginTop: 24, height: 'auto', minHeight: 0, display: 'block', padding: '20px 24px 24px' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>Asset value appreciation</div>
          <KpiInfoIcon
            multiline
            tip={`Estimated values use the same rules as the portfolio table (purchase + appreciation + price history, or manual appraisal). Amounts are converted to ${displayCurrency} using your FX rates (header).`}
          />
        </div>
      </div>

      <div className="ava-tabs" role="tablist" aria-label="Comparison mode">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={mode === opt.key}
            className={`ava-tab${mode === opt.key ? ' active' : ''}`}
            onClick={() => setMode(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {emptyReason ? (
        <div style={{ fontSize: 14, color: 'var(--text2)', padding: '24px 0' }}>{emptyReason}</div>
      ) : (
        <>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.45 }}>{footnote}</p>
          {chipList.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  marginBottom: 8,
                }}
              >
                Show on chart
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label="Toggle property series">
                {chipList.map((c) => {
                  const on = !excludedIds.has(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      style={seriesChipStyle(on, c.color)}
                      onClick={() => togglePropertySeries(c.id)}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: on ? c.color : '#d1d5db',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>
                        {c.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {chartBlockedReason ? (
            <div style={{ fontSize: 14, color: 'var(--text2)', padding: '16px 0 8px' }}>{chartBlockedReason}</div>
          ) : (
            <>
              {mode === 'aligned' && (
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text3)' }}>
                  Showing years ≥ {commonStartYear} (latest series start among properties above).
                </p>
              )}
              {mode === 'muted' && (
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text3)' }}>
                  Solid lines from {commonStartYear}; dashed lines show earlier history where modeled.
                </p>
              )}
              {mode === 'aggregate' && (
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text3)' }}>
                  Index starts at {commonStartYear}, when the combined total first goes positive ({displayCurrency}-converted sums).
                </p>
              )}
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 6" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: CHART_AXIS }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={{ stroke: CHART_GRID }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: CHART_AXIS }}
                      width={64}
                      axisLine={false}
                      tickLine={{ stroke: CHART_GRID }}
                      tickFormatter={(v) => {
                        const n = Number(v)
                        if (!Number.isFinite(n)) return ''
                        if (mode === 'indexed' || mode === 'aggregate') return n >= 100 ? `${Math.round(n)}` : `${n.toFixed(1)}`
                        return fmtCurrencyM(n, displayCurrency)
                      }}
                      label={{
                        value: yLabel,
                        angle: -90,
                        position: 'insideLeft',
                        style: { fill: CHART_AXIS, fontSize: 11 },
                      }}
                    />
                    <Tooltip
                      content={(props) => (
                        <AppreciationTooltipBody {...props} mode={mode} displayCurrency={displayCurrency} />
                      )}
                    />
                    <Legend iconType="line" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span style={{ color: '#546e7a', fontWeight: 500 }}>{v}</span>} />
                    {mode === 'muted'
                      ? seriesList.flatMap((e) => [
                          <Line
                            key={`${e.id}-bg`}
                            type="monotone"
                            dataKey={`v${e.id}_bg`}
                            stroke={e.color}
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            strokeOpacity={0.4}
                            dot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                            legendType="none"
                          />,
                          <Line
                            key={`${e.id}-fg`}
                            type="monotone"
                            dataKey={`v${e.id}_fg`}
                            name={e.name}
                            stroke={e.color}
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                          />,
                        ])
                      : isAggregate
                        ? (
                            <Line
                              type="monotone"
                              dataKey="combined"
                              name="Portfolio total"
                              stroke="#2563eb"
                              strokeWidth={2.5}
                              dot={false}
                              connectNulls
                              isAnimationActive={false}
                            />
                          )
                        : seriesList.map((e) => (
                            <Line
                              key={e.id}
                              type="monotone"
                              dataKey={`v${e.id}`}
                              name={e.name}
                              stroke={e.color}
                              strokeWidth={2}
                              dot={false}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
