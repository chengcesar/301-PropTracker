import { useMemo } from 'react'
import { MONTHS_FULL } from '../../lib/constants'
import type { Property } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { calcAnnual, expenseRowsForYear, getMonthData, projectedGpiAnnual, yearMonths } from '../../lib/finance'
import { fmt, fmtCurrencyM } from '../../lib/format'
import { KpiInfoIcon } from '../KpiInfoIcon'

type Props = {
  prop: Property
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

export function CashflowTab({ prop, cx = (n) => n, displayCurrency }: Props) {
  const dc = displayCurrency ?? prop.currency
  const ann = calcAnnual(prop)
  const gpiDen = projectedGpiAnnual(prop)

  const scheduleRows = useMemo(() => {
    let cumulative = 0
    const rows: {
      fullName: string
      i: number
      d: ReturnType<typeof getMonthData>
      mCapex: number
      mTax: number
      net: number
      cumulative: number
    }[] = []
    for (let i = 0; i < 12; i++) {
      const d = getMonthData(prop, i)
      const mCapex = prop.capex.filter((c) => new Date(c.date).getMonth() === i).reduce((a, b) => a + b.amount, 0)
      const mTax = (prop.taxes.items ?? [])
        .filter((t) => {
          if (!t.dueDate) return i === 11 // no date → December fallback
          return new Date(t.dueDate + 'T12:00').getMonth() === i
        })
        .reduce((a, t) => a + (t.amount ?? 0), 0)
      const net = d.noi - mCapex - mTax
      cumulative += net
      rows.push({
        fullName: MONTHS_FULL[i],
        i,
        d,
        mCapex,
        mTax,
        net,
        cumulative,
      })
    }
    return rows
  }, [prop])

  return (
    <div>
      <div className="kpi-row mb24">
        <div className="kpi-card">
          <div className="kpi-label">Year income <KpiInfoIcon tip="Effective Gross Income — actual rent collected this year" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.egi), dc)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Year OPEX <KpiInfoIcon tip="Operating expenses — admin, maintenance, insurance, etc." /></div>
          <div className="kpi-value red">−{fmtCurrencyM(cx(ann.totalOpex), dc)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">NOI <KpiInfoIcon tip="Net Operating Income — income minus operating expenses" /></div>
          <div className="kpi-value purple">{fmtCurrencyM(cx(ann.noi), dc)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Taxes <KpiInfoIcon tip="Annual property and income taxes" /></div>
          <div className="kpi-value red">−{fmtCurrencyM(cx(ann.taxes), dc)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net cashflow <KpiInfoIcon tip="Final cashflow after all income and expenses" /></div>
          <div className="kpi-value green">{fmtCurrencyM(cx(ann.netCf), dc)}</div>
        </div>
      </div>
      <div className="sec-hdr mb12">
        <span className="sec-title">P&amp;L waterfall</span>
      </div>
      <div className="card mb24" style={{ overflow: 'hidden' }}>
        <table className="wf-table">
          <thead>
            <tr>
              <th style={{ width: '220px' }}>Line item</th>
              <th style={{ width: '100px' }} />
              <th>Annual</th>
              <th>Avg/month</th>
              <th>% GPI</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gross potential income</td>
              <td>
                <div className="wf-bar">
                  <div className="wf-bar-fill" style={{ width: '100%', background: '#1A6B47' }} />
                </div>
              </td>
              <td className="pos">{fmt(cx(gpiDen))}</td>
              <td>{fmt(cx(gpiDen / 12))}</td>
              <td>100%</td>
            </tr>
            <tr className="indent">
              <td>− Vacancy &amp; credit loss</td>
              <td>
                <div className="wf-bar">
                  <div
                    className="wf-bar-fill"
                    style={{
                      width: gpiDen ? `${Math.round((ann.vacancy / gpiDen) * 100)}%` : '0%',
                      background: '#9B2020',
                    }}
                  />
                </div>
              </td>
              <td className={ann.vacancy ? 'neg' : 'text3'}>{ann.vacancy ? `−${fmt(cx(ann.vacancy))}` : '—'}</td>
              <td className="text3">—</td>
              <td>{gpiDen ? `${Math.round((ann.vacancy / gpiDen) * 100)}%` : '0%'}</td>
            </tr>
            <tr className="subtotal">
              <td>Effective gross income (EGI)</td>
              <td>
                <div className="wf-bar">
                  <div
                    className="wf-bar-fill"
                    style={{
                      width: gpiDen ? `${Math.round((ann.egi / gpiDen) * 100)}%` : '0%',
                      background: '#1A6B47',
                    }}
                  />
                </div>
              </td>
              <td className="pos">{fmt(cx(ann.egi))}</td>
              <td>{fmt(cx(ann.egi / 12))}</td>
              <td>{gpiDen ? `${Math.round((ann.egi / gpiDen) * 100)}%` : '—'}</td>
            </tr>
            <tr className="section-hdr">
              <td colSpan={5}>Operating expenses</td>
            </tr>
            {expenseRowsForYear(prop).filter((r) => (r.type as string) !== 'auto').map((def) => {
              const ym = yearMonths(prop)
              const total = Object.values(ym).reduce(
                (a, m) => a + (parseFloat(String(m.expenses?.[def.key] ?? '')) || 0),
                0,
              )
              if (!total) return null
              return (
                <tr key={def.key} className="indent">
                  <td>− {def.label}</td>
                  <td>
                    <div className="wf-bar">
                      <div
                        className="wf-bar-fill"
                        style={{
                          width: gpiDen ? `${Math.max(1, Math.round((total / gpiDen) * 100))}%` : '0%',
                          background: '#4A3FA0',
                        }}
                      />
                    </div>
                  </td>
                  <td className="neg">−{fmt(cx(total))}</td>
                  <td>{fmt(cx(total / 12))}</td>
                  <td>{gpiDen ? `${Math.round((total / gpiDen) * 100)}%` : '—'}</td>
                </tr>
              )
            })}
            <tr className="subtotal">
              <td>NOI</td>
              <td>
                <div className="wf-bar">
                  <div
                    className="wf-bar-fill"
                    style={{
                      width: gpiDen ? `${Math.max(0, Math.round((ann.noi / gpiDen) * 100))}%` : '0%',
                      background: ann.noi >= 0 ? '#1A6B47' : '#9B2020',
                    }}
                  />
                </div>
              </td>
              <td className={ann.noi >= 0 ? 'pos' : 'neg'}>{fmt(cx(ann.noi))}</td>
              <td>{fmt(cx(ann.noi / 12))}</td>
              <td>{gpiDen ? `${Math.round((ann.noi / gpiDen) * 100)}%` : '—'}</td>
            </tr>
            <tr className="section-hdr">
              <td colSpan={5}>Below the line</td>
            </tr>
            <tr className="indent">
              <td>− CAPEX</td>
              <td>
                <div className="wf-bar">
                  <div
                    className="wf-bar-fill"
                    style={{
                      width: gpiDen && ann.totalCapex ? `${Math.max(1, Math.round((ann.totalCapex / gpiDen) * 100))}%` : '0%',
                      background: '#8A5A00',
                    }}
                  />
                </div>
              </td>
              <td className={ann.totalCapex ? 'neg' : 'text3'}>{ann.totalCapex ? `−${fmt(cx(ann.totalCapex))}` : '—'}</td>
              <td className="text3">—</td>
              <td>{gpiDen && ann.totalCapex ? `${Math.round((ann.totalCapex / gpiDen) * 100)}%` : '0%'}</td>
            </tr>
            <tr className="indent">
              <td>− Taxes</td>
              <td>
                <div className="wf-bar">
                  <div
                    className="wf-bar-fill"
                    style={{
                      width: gpiDen && ann.taxes ? `${Math.max(1, Math.round((ann.taxes / gpiDen) * 100))}%` : '0%',
                      background: '#9B2020',
                    }}
                  />
                </div>
              </td>
              <td className={ann.taxes ? 'neg' : 'text3'}>{ann.taxes ? `−${fmt(cx(ann.taxes))}` : '—'}</td>
              <td className="text3">—</td>
              <td>{gpiDen && ann.taxes ? `${Math.round((ann.taxes / gpiDen) * 100)}%` : '—'}</td>
            </tr>
            <tr className="total-row">
              <td>Net cashflow</td>
              <td />
              <td>
                {ann.netCf >= 0 ? '+' : ''}
                {fmt(cx(ann.netCf))}
              </td>
              <td>{fmt(cx(ann.netCf / 12))}</td>
              <td>{gpiDen ? `${Math.round((ann.netCf / gpiDen) * 100)}%` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="sec-hdr mb12">
        <span className="sec-title">Monthly schedule</span>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="cf-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Contract</th>
              <th>Status</th>
              <th>Income</th>
              <th>OPEX</th>
              <th>CAPEX</th>
              <th>NOI</th>
              <th>Taxes</th>
              <th>Net CF</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {scheduleRows.map((row) => {
              const { d, mCapex, mTax, net, cumulative, fullName } = row
              return (
                <tr
                  key={row.i}
                  className={!d.contract ? 'no-contract-row' : d.status === 'vacant' ? 'vacant-row' : ''}
                >
                  <td>{fullName}</td>
                  <td className="fs11 text3">{d.contract?.tenant ?? '—'}</td>
                  <td>
                    <span className={`badge ${!d.contract ? 'archived-c' : d.status === 'vacant' ? 'vacant' : 'rented'}`}>
                      {!d.contract ? 'None' : d.status === 'vacant' ? 'Vacant' : 'Rented'}
                    </span>
                  </td>
                  <td className={d.income ? 'pos' : 'text3'}>{d.income ? `+${fmt(cx(d.income))}` : '—'}</td>
                  <td className={d.totalOpex ? 'neg' : 'text3'}>{d.totalOpex ? `−${fmt(cx(d.totalOpex))}` : '—'}</td>
                  <td className={mCapex ? 'neg' : 'text3'}>{mCapex ? `−${fmt(cx(mCapex))}` : '—'}</td>
                  <td className={d.noi > 0 ? 'pos' : d.noi < 0 ? 'neg' : 'text3'}>{d.noi !== 0 ? fmt(cx(d.noi)) : '—'}</td>
                  <td className={mTax ? 'neg' : 'text3'}>{mTax ? `−${fmt(cx(mTax))}` : '—'}</td>
                  <td className={net > 0 ? 'pos' : net < 0 ? 'neg' : 'text3'}>{net !== 0 ? fmt(cx(net)) : '—'}</td>
                  <td className="mono">{fmt(cx(cumulative))}</td>
                </tr>
              )
            })}
            <tr className="total-row">
              <td>Total</td>
              <td />
              <td />
              <td>{fmt(cx(ann.egi))}</td>
              <td>−{fmt(cx(ann.totalOpex))}</td>
              <td>{ann.totalCapex ? `−${fmt(cx(ann.totalCapex))}` : '—'}</td>
              <td>{fmt(cx(ann.noi))}</td>
              <td>{ann.taxes ? `−${fmt(cx(ann.taxes))}` : '—'}</td>
              <td>
                {ann.netCf >= 0 ? '+' : ''}
                {fmt(cx(ann.netCf))}
              </td>
              <td>{fmt(cx(ann.netCf))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
