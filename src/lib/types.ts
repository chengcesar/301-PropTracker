/**
 * Shared domain types — align with PROPFLOW_CONTEXT.md when migrating
 * the rental-manager.html prototype.
 */

import type { CurrencyCode } from './currency'

export type ContractStatus = 'active' | 'archived' | 'draft'

export type IncrementType = 'ipc+' | 'ipc' | 'fixed' | 'none'

export interface Contract {
  id: number
  status: ContractStatus
  tenant: string
  contractManager: string
  monthlyRent: number
  startDate: string
  endDate: string
  paymentDay: number
  deposit: number
  increment: IncrementType
  ipcExtra: number
  /** Annual % increase used when increment === 'fixed' */
  fixedPct: number
  /** Estimated CPI % used as the base for increment === 'ipc' | 'ipc+' (manually entered — not fetched) */
  cpiEstimatePct: number
  /** Contract-year index (1-based, anchored to startDate's anniversary) -> increment % override for that year only */
  yearOverrides?: Record<number, number>
  adminFee: number
  notes: string
}

export interface MonthData {
  status: 'rented' | 'vacant'
  incomeOverride: number | null
  /** User-confirmed rent payment received (does not change projected income). */
  rentReceived?: boolean
  expenses: Record<string, number | { label: string; amount: number }>
}

export type CapexStatus = 'To do' | 'Ongoing' | 'Completed'

export interface CapexItem {
  id: number
  date: string
  dateEnd?: string
  desc: string
  cat: 'Improvement' | 'Equipment' | 'Repair' | 'Other'
  amount: number
  status?: CapexStatus
}

export type OccupantRelation = 'Owner' | 'Family' | 'Caretaker' | 'Other'

export interface Occupant {
  name: string
  relation: OccupantRelation
  since?: string
  notes?: string
}

export type TaxStatus = 'paid' | 'pending'

export interface TaxItem {
  id: number
  taxId: string
  amount: number
  dueDate: string
  status: TaxStatus
}

export interface ServiceEntry {
  id: number
  provider: string
  type: string
  accountNumber: string
  monthlyCost: number
  notes: string
}

/** One-off utility / service payments (broker fee, annual insurance, etc.) — allocated by paymentDate. */
export interface ServiceOneTimeItem {
  id: number
  provider: string
  type: string
  accountNumber?: string
  amount: number
  paymentDate: string
  notes?: string
  status?: TaxStatus
}

/** Ad-hoc maintenance/repair cost routed to OpEx (reduces NOI) — distinct from CapEx (below-the-line) and one-time payments (netCf-only). */
export interface MaintenanceEvent {
  id: number
  desc: string
  provider?: string
  cat: 'Improvement' | 'Equipment' | 'Repair' | 'Other'
  amount: number
  date: string
  dateEnd?: string
  status?: CapexStatus
  notes?: string
}

export interface OwnershipEntry {
  id: number
  name: string
  idNumber: string
  equityPct: number
  notes: string
}

export interface MortgageInfo {
  hasMortgage: boolean
  lender: string
  loanNumber: string
  originalAmount: number | null
  /** Cash down at purchase — mortgage setup / valuation */
  downPayment?: number | null
  outstandingBalance: number | null
  monthlyPayment: number | null
  interestRate: number | null
  rateType: 'fixed' | 'variable' | ''
  termMonths: number | null
  startDate: string
  endDate: string
}

export interface FactSheet {
  propertyType: string
  estrato: number | null
  yearBuilt: number | null
  lastRenovation: number | null
  floor: number | null
  matriculaInmobiliaria: string
  cedulaCatastral: string
  chip: string
  customId: string
  purchasePrice: number | null
  purchaseDate: string
  /** Manual appraisal fallback when purchase + appreciation model is unavailable; modeled value is edited in Value & Equity. */
  currentValue: number | null
  valuationDate: string
  photos: string[]
  documents?: string[]
  owners?: OwnershipEntry[]
  mortgage?: MortgageInfo
  contacts: PropertyContact[]
  notes: string
  /** Year → local-currency value overrides entered by the user */
  priceHistory?: Record<number, number>
  /**
   * Imputed monthly rent for months with no lease in the selected year — used only for
   * projected GPI display. Contract months still use contract rent; unset = no imputation.
   */
  potentialMonthlyRent?: number | null
  /** Default annual appreciation % used for projections (e.g. 5 = 5%) */
  appreciationRate?: number
  /** How many years beyond the current year to project */
  projectionYears?: number
  /** Value & Equity tab: amortization charts vs price-history focus */
  valueEquityView?: 'mortgage' | 'history'
}

export interface PropertyContact {
  id: number
  name: string
  role: string
  phone: string
  email: string
  bankInstitution?: string
  accountDetails?: string
}

export interface Property {
  id: number
  owner: string
  name: string
  address: string
  neighbourhood: string
  city: string
  postalCode: string
  country: string
  currency: CurrencyCode
  latitude?: number
  longitude?: number
  area: number
  bedrooms: number
  bathrooms: number
  parking: number
  storageUnits: number
  concierge: boolean
  terrace: number
  balcony: number
  floors: number
  year: number
  occupant?: Occupant
  customExpenseCats?: Record<number, string[]>
  hiddenExpenseCats?: Record<number, string[]>
  contracts: Contract[]
  months: Record<number, Record<number, MonthData>>
  capex: CapexItem[]
  taxes: { items: TaxItem[] }
  services?: Record<number, ServiceEntry[]>
  serviceOneTimeItems?: ServiceOneTimeItem[]
  maintenanceEvents?: MaintenanceEvent[]
  factSheet?: FactSheet
  group?: string
}

export type ShareScope = 'portfolio' | 'filtered' | 'properties'
export type ShareStatus = 'pending' | 'active' | 'revoked'
export type ShareFilterField = 'owner' | 'country' | 'city' | 'group'

export interface ShareFilter {
  field: ShareFilterField
  values: string[]
}

export interface Share {
  id: string
  ownerUid: string
  ownerDisplayName: string
  ownerPortfolioName: string
  granteeEmail: string
  granteeUid: string | null
  scope: ShareScope
  filters: ShareFilter[]
  propertyIds: number[]
  status: ShareStatus
  inviteToken: string
  createdAt: number        // epoch ms — Firestore Timestamp converted on read
  acceptedAt: number | null
}
