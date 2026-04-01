import type { FC } from 'react'

/** Props for `PortfolioReport.jsx` (sample + mapped portfolio rows). */
export interface PortfolioReportProps {
  properties?: unknown[]
  year?: number
  onBack?: () => void
}

declare const PortfolioReport: FC<PortfolioReportProps>
export default PortfolioReport
