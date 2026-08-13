import { MONTHS } from '../../lib/constants'
import type { Property } from '../../lib/types'
import type { CurrencyCode } from '../../lib/currency'
import { expenseRowsForYear, sumMaintenanceForMonth, yearMonths } from '../../lib/finance'
import { fmt } from '../../lib/format'

type Props = {
  prop: Property
  onUpdateProp: (fn: (p: Property) => Property) => void
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

export function OpexCapexTab({ prop, cx = (n) => n }: Props) {
  const ym = yearMonths(prop)
  const rowDefs = expenseRowsForYear(prop)

  return (
    <div>
      <div className="sec-hdr mb12">
        <span className="sec-title">OPEX by month · {prop.year}</span>
      </div>
      <div className="card mb24" style={{ overflow: 'hidden' }}>
        <table className="cf-table">
          <thead>
            <tr>
              <th>Month</th>
              {rowDefs.map((def) => (
                <th key={def.key}>{def.label}</th>
              ))}
              <th>Maintenance</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((name, i) => {
              const exp = ym[i]?.expenses ?? {}
              let total = 0
              const cellValues = rowDefs.map((def) => {
                let val = 0
                const v = exp[def.key]
                val = typeof v === 'number' ? v : 0
                total += val
                return val
              })
              const maintenanceVal = sumMaintenanceForMonth(prop, i)
              total += maintenanceVal
              return (
                <tr key={i} className={!ym[i] ? 'no-contract-row' : ''}>
                  <td>{name}</td>
                  {cellValues.map((v, j) => (
                    <td key={rowDefs[j].key} className={v ? '' : 'text3'}>{v ? fmt(cx(v)) : '—'}</td>
                  ))}
                  <td className={maintenanceVal ? '' : 'text3'}>{maintenanceVal ? fmt(cx(maintenanceVal)) : '—'}</td>
                  <td className="fw5">−{fmt(cx(total))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="sec-hdr mb12">
        <span className="sec-title">CAPEX summary · {prop.year}</span>
        <span className="fs11 text3">See the CapEx tab to log entries</span>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="cf-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th>Items</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const nonRecurring = prop.capex.filter((c) => !c.recurring)
              const recurring = prop.capex.filter((c) => c.recurring)
              const rows: [string, typeof prop.capex][] = [
                ['Non-recurring', nonRecurring],
                ['Recurring', recurring],
              ]
              const total = prop.capex.reduce((a, b) => a + b.amount, 0)
              return (
                <>
                  {rows.map(([label, items]) => (
                    <tr key={label}>
                      <td style={{ textAlign: 'left' }}>{label}</td>
                      <td>{items.length}</td>
                      <td className={items.length ? 'fw5' : 'text3'}>{items.length ? `−${fmt(cx(items.reduce((a, b) => a + b.amount, 0)))}` : '—'}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td style={{ textAlign: 'left' }}>Total</td>
                    <td>{prop.capex.length}</td>
                    <td style={{ fontWeight: 700 }}>{prop.capex.length ? `−${fmt(cx(total))}` : '—'}</td>
                  </tr>
                </>
              )
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}
