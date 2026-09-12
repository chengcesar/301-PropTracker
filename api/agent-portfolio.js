/**
 * GET /api/agent-portfolio
 * 
 * Returns the authenticated user's portfolio properties and summary KPIs.
 * Auth: Bearer <key> or X-Agent-Key: <key>
 * The key is SHA-256 hashed and matched against users' agentApiKeyHash field.
 */
import crypto from 'crypto'
import { findUserByApiKeyHash, getAdminFirestore } from './_firebaseAdmin.js'
import {
  calcAnnual,
  calcPortfolioTotalsIn,
  convertAnnual,
  projectedGpiAnnual,
  convert,
  activeContract,
  occupancyFilterBucket,
  nonLeaseOccupancyLabel,
  estimatedPropertyValueAtYear,
  vacancyLossMonthCount,
  normalizeCurrencyCode,
  resolveServices,
  resolvedServicesYear,
  capexDepreciationForYear,
} from './_finance.js'
import { getFxRates } from './_fxHelper.js'

function extractApiKey(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }
  const xAgentKey = req.headers['x-agent-key'] || req.headers['X-Agent-Key'] || ''
  if (xAgentKey) {
    return xAgentKey.trim()
  }
  return null
}

function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

export default async function handler(req, res) {
  // CORS headers for potential cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-Agent-Key, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['GET'] })
  }

  const apiKey = extractApiKey(req)
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key. Provide Authorization: Bearer <key> or X-Agent-Key: <key>',
    })
  }

  const keyHash = sha256(apiKey)

  let user
  try {
    user = await findUserByApiKeyHash(keyHash)
  } catch (err) {
    console.error('Error looking up user by API key hash:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    })
  }

  // Fetch all properties for the user
  let properties = []
  try {
    const db = getAdminFirestore()
    const propsRef = db.collection('users').doc(user.uid).collection('properties')
    const snapshot = await propsRef.get()
    properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('Error fetching properties:', err)
    return res.status(500).json({ error: 'Failed to fetch properties' })
  }

  // Determine year (default to current year, allow ?year= override)
  const currentYear = new Date().getFullYear()
  const queryYear = parseInt(req.query.year, 10)
  const year = Number.isFinite(queryYear) && queryYear > 1900 && queryYear < 2100
    ? queryYear
    : currentYear

  // Determine display currency (default to USD, allow ?currency= override)
  const queryCurrency = normalizeCurrencyCode(req.query.currency)
  const displayCurrency = queryCurrency || 'USD'

  // Fetch live FX rates (with fallback to embedded defaults)
  const { rates: fxRates, meta: fxMeta } = await getFxRates()

  // Process each property to include annual KPIs
  const propertyRows = properties.map(prop => {
    // Set the year on the property for calculations
    const py = { ...prop, year }

    // Ensure required arrays exist
    if (!py.contracts) py.contracts = []
    if (!py.capex) py.capex = []
    if (!py.months) py.months = {}
    if (!py.taxes) py.taxes = { items: [] }

    // Calculate annual KPIs
    const annual = calcAnnual(py)
    const annualInDc = convertAnnual(annual, prop.currency || 'USD', displayCurrency, fxRates)
    const gpi = convert(projectedGpiAnnual(py), prop.currency || 'USD', displayCurrency, fxRates)

    // Occupancy status
    const contract = activeContract(py)
    const status = contract ? 'Leased' : occupancyFilterBucket(py) === 'Occupied' ? 'Occupied' : 'Vacant'
    const occupancyLabel = nonLeaseOccupancyLabel(py)

    // Months left on lease
    let monthsLeft = null
    if (contract?.endDate) {
      const end = new Date(contract.endDate)
      const now = new Date()
      monthsLeft = Math.max(0, Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    }

    // Active lease contract fields
    const leaseStart = contract?.startDate || null
    const leaseEnd = contract?.endDate || null
    const tenant = contract?.tenant || null
    const monthlyRent = contract?.monthlyRent != null
      ? convert(contract.monthlyRent, prop.currency || 'USD', displayCurrency, fxRates)
      : null
    const contractStatus = contract?.status || null

    // Value estimation
    const valEst = estimatedPropertyValueAtYear(py, year)
    const estValue = valEst.value != null
      ? convert(valEst.value, prop.currency || 'USD', displayCurrency, fxRates)
      : null

    // Cap rate
    const capRate = estValue && estValue > 0 && Number.isFinite(annualInDc.noi)
      ? (annualInDc.noi / estValue) * 100
      : null

    // Vacancy month rate
    const vacancyMonths = vacancyLossMonthCount(py)
    const vacancyMoRate = vacancyMonths > 0 ? Math.round((vacancyMonths / 12) * 1000) / 10 : 0

    // Margin (Net CF / GPI)
    const margin = gpi > 0 ? (annualInDc.netCf / gpi) * 100 : null

    // Process tax items for this property
    const taxItems = processTaxItems(prop, year, displayCurrency, fxRates)

    // Process services for this property (recurring OpEx line items)
    const services = processServices(py, year, displayCurrency, fxRates)

    // Process CapEx items for this property (depreciation table)
    const capexItems = processCapexItems(py, year, displayCurrency, fxRates)

    return {
      // Identity fields
      id: prop.id,
      name: prop.name || '',
      address: prop.address || '',
      neighbourhood: prop.neighbourhood || '',
      city: prop.city || '',
      country: prop.country || '',
      owner: prop.owner || '',
      equityPct: prop.equityPct ?? prop.factSheet?.owners?.[0]?.equityPct ?? null,
      currency: prop.currency || 'USD',
      area: prop.area ?? null,
      bedrooms: prop.bedrooms ?? null,
      bathrooms: prop.bathrooms ?? null,
      parking: prop.parking ?? null,
      storageUnits: prop.storageUnits ?? null,
      floors: prop.floors ?? null,
      latitude: prop.latitude ?? null,
      longitude: prop.longitude ?? null,

      // Occupancy / status
      status,
      occupancy: occupancyLabel,
      monthsLeft,

      // Active lease contract fields
      leaseStart,
      leaseEnd,
      tenant,
      monthlyRent: monthlyRent != null ? round2(monthlyRent) : null,
      contractStatus,

      // Annual KPIs (in display currency)
      year,
      gpi: round2(gpi),
      vacancy: round2(annualInDc.vacancy),
      egi: round2(annualInDc.egi),
      opex: round2(annualInDc.totalOpex),
      noi: round2(annualInDc.noi),
      capex: round2(annualInDc.totalCapex),
      taxes: round2(annualInDc.taxes),
      net: round2(annualInDc.netCf),
      netAmortized: round2(annualInDc.netCfAmortized),

      // Value & metrics
      estValue: estValue != null ? round2(estValue) : null,
      capRate: capRate != null ? round2(capRate) : null,
      vacancyMoRate,
      margin: margin != null ? round2(margin) : null,

      // Tax line items for the requested year
      taxItems,

      // Service / utility line items (recurring OpEx)
      services,

      // CapEx / depreciation line items
      capexItems,
    }
  })

  // Calculate portfolio totals
  const propertiesWithYear = properties.map(p => ({
    ...p,
    year,
    contracts: p.contracts || [],
    capex: p.capex || [],
    months: p.months || {},
    taxes: p.taxes || { items: [] },
  }))
  const totals = calcPortfolioTotalsIn(propertiesWithYear, displayCurrency, fxRates)

  const response = {
    uid: user.uid,
    email: user.email || null,
    asOf: new Date().toISOString(),
    year,
    currency: displayCurrency,
    properties: propertyRows,
    totals: {
      gpi: round2(totals.gpi),
      egi: round2(totals.egi),
      opex: round2(totals.opex),
      noi: round2(totals.noi),
      capex: round2(totals.capex),
      taxes: round2(totals.taxes),
      net: round2(totals.net),
      netAmortized: round2(totals.netAmortized),
      propertyCount: properties.length,
    },
    meta: {
      displayCurrencyNote: `All monetary values are converted to the display currency using ${fxMeta.fxSource === 'live' ? 'live' : 'fallback'} FX rates.`,
      fxSource: fxMeta.fxSource,
      fxRatesUpdatedAt: fxMeta.fxRatesUpdatedAt,
      fxRateCopPerUsd: fxMeta.fxRateCopPerUsd,
      fxNote: fxMeta.fxNote,
      computedWith: 'Same logic as PortfolioPage (calcAnnual, calcPortfolioTotalsIn)',
      taxItemsNote: 'Per-property taxes and totals.taxes equal sum of taxItems[].amount (impuesto a cargo). Fields type, amountPaid, paidDate, chip, and label are not yet stored in the data model and return null.',
      servicesNote: 'services[] exposes recurring service/utility accounts. annualCost = monthlyCost × 12. opex is computed from actual monthly expense entries + maintenance events — it does NOT equal sum of services[].annualCost. Services act as metadata; actual monthly OpEx may differ. When services are inherited from another year (no entries for requested year), resolvedFromYear indicates the source year.',
      capexItemsNote: 'capexItems[] exposes CapEx line items with depreciation. yearDepreciation is the amount landing in the requested year: for capitalize treatment, sum of 12 months of straight-line depreciation; for expense treatment, full amount if dated in the year. Sum of yearDepreciation should reconcile to property netAmortized capex component. amount is the original cash outlay.',
    },
  }

  return res.status(200).json(response)
}

function round2(n) {
  if (n == null || !Number.isFinite(n)) return n
  return Math.round(n * 100) / 100
}

/**
 * Process tax items for a property, filtering by year and converting currency.
 * Year filtering: if item has dueDate, filter by dueDate's year; otherwise include (year unknown).
 * 
 * @param {Object} prop - The property object
 * @param {number} year - The requested year
 * @param {string} displayCurrency - Target currency for conversion
 * @param {Object} fxRates - FX rates object
 * @returns {Array} Array of processed tax items
 */
function processTaxItems(prop, year, displayCurrency, fxRates) {
  const items = prop.taxes?.items ?? []
  const propCurrency = prop.currency || 'USD'

  return items
    .filter(item => {
      if (!item.dueDate) return true
      const dueDateYear = new Date(item.dueDate + 'T12:00:00').getFullYear()
      return dueDateYear === year
    })
    .map(item => {
      const dueDateYear = item.dueDate
        ? new Date(item.dueDate + 'T12:00:00').getFullYear()
        : null

      const convertedAmount = item.amount != null
        ? convert(item.amount, propCurrency, displayCurrency, fxRates)
        : null

      return {
        propertyId: String(prop.id),
        taxId: item.taxId || String(item.id),
        type: null,
        year: dueDateYear ?? year,
        amount: convertedAmount != null ? round2(convertedAmount) : null,
        amountPaid: null,
        currency: displayCurrency,
        dueDate: item.dueDate || null,
        paidDate: null,
        status: item.status || 'unknown',
        chip: null,
        label: null,
      }
    })
}

/**
 * Process service entries for a property, resolving from the requested year or
 * inheriting from the nearest year with services (same behavior as ServicesTab).
 * 
 * @param {Object} prop - The property object (with year set)
 * @param {number} year - The requested year
 * @param {string} displayCurrency - Target currency for conversion
 * @param {Object} fxRates - FX rates object
 * @returns {Array} Array of processed service items
 */
function processServices(prop, year, displayCurrency, fxRates) {
  const propCurrency = prop.currency || 'USD'
  const services = resolveServices(prop)
  const fromYear = resolvedServicesYear(prop)
  const inherited = fromYear !== null && fromYear !== year

  return services.map(entry => {
    const convertedMonthlyCost = entry.monthlyCost != null
      ? convert(entry.monthlyCost, propCurrency, displayCurrency, fxRates)
      : 0

    return {
      propertyId: String(prop.id),
      serviceId: String(entry.id),
      provider: entry.provider || '',
      type: entry.type || '',
      accountNumber: entry.accountNumber?.trim() || null,
      monthlyCost: round2(convertedMonthlyCost),
      annualCost: round2(convertedMonthlyCost * 12),
      currency: displayCurrency,
      year: year,
      notes: entry.notes?.trim() || null,
      resolvedFromYear: inherited ? fromYear : undefined,
    }
  })
}

/**
 * Process CapEx items for a property, computing year depreciation/expense
 * using the same logic as totalCapexAmortizedForYear.
 * 
 * @param {Object} prop - The property object (with year set)
 * @param {number} year - The requested year
 * @param {string} displayCurrency - Target currency for conversion
 * @param {Object} fxRates - FX rates object
 * @returns {Array} Array of processed capex items
 */
function processCapexItems(prop, year, displayCurrency, fxRates) {
  const propCurrency = prop.currency || 'USD'
  const capexItems = prop.capex || []
  const contracts = prop.contracts || []

  return capexItems.map(item => {
    const convertedAmount = item.amount != null
      ? convert(item.amount, propCurrency, displayCurrency, fxRates)
      : 0

    const yearDep = capexDepreciationForYear(item, contracts, year)
    const convertedYearDep = convert(yearDep, propCurrency, displayCurrency, fxRates)

    return {
      propertyId: String(prop.id),
      capexId: String(item.id),
      desc: item.desc || '',
      provider: item.provider?.trim() || null,
      cat: item.cat || 'Other',
      date: item.date || null,
      dateEnd: item.dateEnd?.trim() || null,
      amount: round2(convertedAmount),
      treatment: item.treatment || 'expense',
      amortizeBasis: item.treatment === 'capitalize' ? (item.amortizeBasis || null) : null,
      amortizeMonths: item.treatment === 'capitalize' && item.amortizeBasis === 'manual' 
        ? (item.amortizeMonths || null) 
        : null,
      contractId: item.treatment === 'capitalize' && item.amortizeBasis === 'contract'
        ? (item.contractId != null ? String(item.contractId) : null)
        : null,
      yearDepreciation: round2(convertedYearDep),
      currency: displayCurrency,
      year: year,
      status: item.status || null,
      recurring: item.recurring ?? false,
    }
  })
}
