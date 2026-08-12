import { useState } from 'react'
import type { Contract, Property } from '../../lib/types'
import { contractDurationMonths, contractDurationYears, incrementSummary } from '../../lib/finance'
import { type CurrencyCode } from '../../lib/currency'
import { fmtCurrency } from '../../lib/format'

type Props = {
  prop: Property
  contract: Contract
  cx?: (n: number) => number
  displayCurrency?: CurrencyCode
}

const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
)
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 4" /></svg>
)

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ActiveContractSummaryCard({ prop, contract, cx = (n) => n, displayCurrency }: Props) {
  const [copied, setCopied] = useState(false)
  const currency = displayCurrency ?? prop.currency

  const rows: [string, string][] = [
    ['Tenant', contract.tenant || '—'],
    ['Monthly rent', fmtCurrency(cx(contract.monthlyRent), currency)],
    ['Start date', formatDate(contract.startDate)],
    ['End date', formatDate(contract.endDate)],
    ['Annual increment', incrementSummary(contract)],
    ['Contract manager', contract.contractManager || '—'],
    ['Deposit', `${contract.deposit} months`],
    ['Admin / mgmt fee', fmtCurrency(cx(contract.adminFee), currency)],
    ['Total years', `${contractDurationYears(contract)} yrs`],
    ['Total months', `${contractDurationMonths(contract)} mos.`],
    ['Contract ID', String(contract.id)],
  ]

  const handleCopy = () => {
    navigator.clipboard.writeText(rows.map(([label, value]) => `${label}\t${value}`).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card">
      <div className="card-inner">
        <div className="flex align-center" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="fw6" style={{ fontSize: '14px' }}>Active contract</div>
          <button
            type="button"
            className="ghost"
            style={{ padding: 4, border: 'none', background: 'transparent' }}
            title={copied ? 'Copied!' : 'Copy contract details'}
            onClick={handleCopy}
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 8 }}>
          <table className="contract-detail-table">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="cdt-label">{label}</td>
                  <td className="cdt-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
