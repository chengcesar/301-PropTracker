import type { FactSheet, Property } from './types'

/** Aligned sample valuation series (new users). Years 2016–2025; amounts use comma thousands in source — ÷1000 for app scale. */
const SAMPLE_VALUATION_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const

const SAMPLE_PROPERTY_VALUE_ROWS = [
  [386_993_000, 441_974_000, 539_351_000, 484_511_000, 507_629_000, 510_878_000, 458_390_000, 534_298_000, 522_709_000, 567_352_000],
  [372_087_000, 382_783_000, 438_182_000, 421_641_000, 466_498_000, 469_484_000, 470_803_000, 500_321_000, 488_788_000, 559_119_000],
  [614_491_000, 700_710_000, 681_204_000, 763_409_000, 801_576_000, 806_706_000, 726_738_000, 828_201_000, 800_011_000, 864_754_000],
  [258_496_000, 261_497_000, 248_463_000, 259_484_000, 315_211_000, 317_228_000, 343_705_000, 333_073_000, 336_184_000, 457_499_000],
  [611_713_000, 548_604_000, 486_033_000, 506_862_000, 601_091_000, 604_938_000, 558_120_000, 538_422_000, 540_138_000, 614_540_000],
] as const

function seedPurchaseAndPriceHistory(row: (typeof SAMPLE_PROPERTY_VALUE_ROWS)[number]): {
  purchasePrice: number
  priceHistory: Record<number, number>
} {
  const scale = (raw: number) => Math.round(raw / 1000)
  const purchasePrice = scale(row[0])
  const priceHistory: Record<number, number> = {}
  for (let i = 1; i < SAMPLE_VALUATION_YEARS.length; i++) {
    priceHistory[SAMPLE_VALUATION_YEARS[i]] = scale(row[i])
  }
  return { purchasePrice, priceHistory }
}

const FS_MORTGAGE_OFF: NonNullable<FactSheet['mortgage']> = {
  hasMortgage: false,
  lender: '',
  loanNumber: '',
  originalAmount: null,
  outstandingBalance: null,
  monthlyPayment: null,
  interestRate: null,
  rateType: '',
  termMonths: null,
  startDate: '',
  endDate: '',
}

/** Five sample properties for new accounts. Only the first is mortgaged; the others are owned outright. Valuations align from 2016. */
export function createSeedProperties(): Property[] {
  const now = Date.now()
  const v0 = seedPurchaseAndPriceHistory(SAMPLE_PROPERTY_VALUE_ROWS[0])
  const v1 = seedPurchaseAndPriceHistory(SAMPLE_PROPERTY_VALUE_ROWS[1])
  const v2 = seedPurchaseAndPriceHistory(SAMPLE_PROPERTY_VALUE_ROWS[2])
  const v3 = seedPurchaseAndPriceHistory(SAMPLE_PROPERTY_VALUE_ROWS[3])
  const v4 = seedPurchaseAndPriceHistory(SAMPLE_PROPERTY_VALUE_ROWS[4])
  const purchaseStart = '2016-01-15'
  const mortgageEnd = '2046-01-15'
  const p0 = v0.purchasePrice
  const mDown = Math.round((119_000 / 595_000) * p0)
  const mOrig = p0 - mDown
  const mOutstanding = Math.round((465_000 / 595_000) * p0)

  return [
    // 1 — Downtown apartment, rented
    {
      id: now,
      owner: 'James Rivera',
      name: 'Downtown Loft',
      address: '350 5th Avenue, Apt 12B',
      neighbourhood: 'Midtown',
      postalCode: '',
      city: 'New York',
      country: 'United States',
      currency: 'USD',
      latitude: 40.7484,
      longitude: -73.9856,
      area: 75,
      bedrooms: 2,
      bathrooms: 1,
      parking: 0,
      storageUnits: 1,
      concierge: true,
      terrace: 0,
      balcony: 0,
      floors: 0,
      year: 2026,
      contracts: [
        {
          id: now + 1,
          status: 'active',
          tenant: 'Sarah Johnson',
          contractManager: '',
          monthlyRent: 3200,
          startDate: '2025-06-01',
          endDate: '2026-05-31',
          paymentDay: 1,
          deposit: 2,
          increment: 'fixed',
          ipcExtra: 0,
          adminFee: 250,
          notes: '',
        },
      ],
      months: {
        2026: {
          0: { status: 'rented', incomeOverride: null, expenses: { admin: 250, electricity: 95, water: 60, insurance: 180 } },
          1: { status: 'rented', incomeOverride: null, expenses: { admin: 250, electricity: 110, water: 60, insurance: 180 } },
          2: { status: 'rented', incomeOverride: null, expenses: { admin: 250, electricity: 88, water: 60, insurance: 180 } },
        },
      },
      capex: [
        {
          id: now + 2,
          date: '2025-08-15',
          dateEnd: '2025-09-20',
          desc: 'Kitchen renovation',
          cat: 'Improvement',
          amount: 12500,
        },
      ],
      taxes: { items: [{ id: now + 3, taxId: 'NYC-2026', amount: 4800, dueDate: '2026-07-01', status: 'pending' }] },
      services: {
        2026: [
          { id: now + 4, provider: 'ConEd', type: 'Electricity', accountNumber: '4412-9983', monthlyCost: 95, notes: '' },
          { id: now + 5, provider: 'NYC Water', type: 'Water', accountNumber: 'WB-00214', monthlyCost: 60, notes: '' },
        ],
      },
      factSheet: {
        propertyType: 'Apartment',
        estrato: null,
        yearBuilt: 2015,
        lastRenovation: 2025,
        floor: 12,
        matriculaInmobiliaria: '',
        cedulaCatastral: '',
        chip: '',
        customId: '',
        purchasePrice: v0.purchasePrice,
        purchaseDate: purchaseStart,
        currentValue: null,
        valuationDate: '',
        photos: [],
        contacts: [],
        notes: '',
        appreciationRate: 3.5,
        projectionYears: 15,
        valueEquityView: 'mortgage',
        priceHistory: v0.priceHistory,
        mortgage: {
          hasMortgage: true,
          lender: 'First National Bank',
          loanNumber: 'MTG-88421',
          originalAmount: mOrig,
          downPayment: mDown,
          outstandingBalance: mOutstanding,
          monthlyPayment: null,
          interestRate: 6.625,
          rateType: 'fixed',
          termMonths: 360,
          startDate: purchaseStart,
          endDate: mortgageEnd,
        },
      },
    },

    // 2 — Suburban house, rented
    {
      id: now + 100,
      owner: 'James Rivera',
      name: 'Maple Street House',
      address: '742 Maple Street',
      neighbourhood: 'Oak Park',
      postalCode: '',
      city: 'Austin',
      country: 'United States',
      currency: 'USD',
      latitude: 30.2672,
      longitude: -97.7431,
      area: 140,
      bedrooms: 3,
      bathrooms: 2,
      parking: 2,
      storageUnits: 0,
      concierge: false,
      terrace: 20,
      balcony: 0,
      floors: 0,
      year: 2026,
      contracts: [
        {
          id: now + 101,
          status: 'active',
          tenant: 'Michael Chen',
          contractManager: '',
          monthlyRent: 2400,
          startDate: '2025-09-01',
          endDate: '2026-08-31',
          paymentDay: 1,
          deposit: 2,
          increment: 'none',
          ipcExtra: 0,
          adminFee: 0,
          notes: 'Pet allowed (1 dog)',
        },
      ],
      months: {
        2026: {
          0: { status: 'rented', incomeOverride: null, expenses: { electricity: 145, water: 80, gas: 65, insurance: 120, maintenance: 50 } },
          1: { status: 'rented', incomeOverride: null, expenses: { electricity: 160, water: 80, gas: 70, insurance: 120, maintenance: 50 } },
          2: { status: 'rented', incomeOverride: null, expenses: { electricity: 130, water: 85, gas: 55, insurance: 120, maintenance: 200 } },
        },
      },
      capex: [],
      taxes: { items: [{ id: now + 102, taxId: 'TX-2026-4821', amount: 3200, dueDate: '2026-01-31', status: 'paid' }] },
      services: {
        2026: [
          { id: now + 103, provider: 'Austin Energy', type: 'Electricity', accountNumber: 'AE-55123', monthlyCost: 145, notes: '' },
          { id: now + 104, provider: 'Austin Water', type: 'Water', accountNumber: 'AW-33012', monthlyCost: 80, notes: '' },
          { id: now + 105, provider: 'Texas Gas', type: 'Gas', accountNumber: 'TG-8812', monthlyCost: 65, notes: '' },
        ],
      },
      factSheet: {
        propertyType: 'House',
        estrato: null,
        yearBuilt: 2005,
        lastRenovation: null,
        floor: null,
        matriculaInmobiliaria: '',
        cedulaCatastral: '',
        chip: '',
        customId: '',
        purchasePrice: v1.purchasePrice,
        purchaseDate: purchaseStart,
        currentValue: null,
        valuationDate: '',
        photos: [],
        contacts: [],
        notes: '',
        appreciationRate: 4.5,
        projectionYears: 15,
        valueEquityView: 'history',
        priceHistory: v1.priceHistory,
        mortgage: { ...FS_MORTGAGE_OFF } as NonNullable<FactSheet['mortgage']>,
      },
    },

    // 3 — Beachfront condo, vacant
    {
      id: now + 200,
      owner: 'Laura Kim',
      name: 'Ocean View Condo',
      address: '1200 Coastal Blvd, Unit 8A',
      neighbourhood: 'South Beach',
      postalCode: '',
      city: 'Miami',
      country: 'United States',
      currency: 'USD',
      latitude: 25.7617,
      longitude: -80.1918,
      area: 95,
      bedrooms: 2,
      bathrooms: 2,
      parking: 1,
      storageUnits: 1,
      concierge: true,
      terrace: 0,
      balcony: 12,
      floors: 0,
      year: 2026,
      contracts: [],
      months: {
        2026: {
          0: { status: 'vacant', incomeOverride: null, expenses: { admin: 450, electricity: 70, water: 40, insurance: 310 } },
          1: { status: 'vacant', incomeOverride: null, expenses: { admin: 450, electricity: 65, water: 40, insurance: 310 } },
          2: { status: 'vacant', incomeOverride: null, expenses: { admin: 450, electricity: 75, water: 40, insurance: 310 } },
        },
      },
      capex: [
        { id: now + 201, date: '2026-01-20', desc: 'AC unit replacement', cat: 'Equipment', amount: 4200 },
      ],
      taxes: { items: [{ id: now + 202, taxId: 'FL-2026-0088', amount: 5600, dueDate: '2026-03-31', status: 'pending' }] },
      factSheet: {
        propertyType: 'Apartment',
        estrato: null,
        yearBuilt: 2008,
        lastRenovation: null,
        floor: 8,
        matriculaInmobiliaria: '',
        cedulaCatastral: '',
        chip: '',
        customId: '',
        purchasePrice: v2.purchasePrice,
        purchaseDate: purchaseStart,
        currentValue: null,
        valuationDate: '',
        photos: [],
        contacts: [],
        notes: 'Looking for tenant — target rent $3,800/mo',
        appreciationRate: 5,
        projectionYears: 15,
        valueEquityView: 'history',
        priceHistory: v2.priceHistory,
        mortgage: { ...FS_MORTGAGE_OFF } as NonNullable<FactSheet['mortgage']>,
      },
    },

    // 4 — Studio apartment, rented (London, GBP)
    {
      id: now + 300,
      owner: 'Daniel Osei',
      name: 'Kensington Studio',
      address: '18 Cromwell Road, Flat 3',
      neighbourhood: 'South Kensington',
      postalCode: '',
      city: 'London',
      country: 'United Kingdom',
      currency: 'GBP',
      latitude: 51.4958,
      longitude: -0.1745,
      area: 42,
      bedrooms: 1,
      bathrooms: 1,
      parking: 0,
      storageUnits: 0,
      concierge: false,
      terrace: 0,
      balcony: 0,
      floors: 0,
      year: 2026,
      contracts: [
        {
          id: now + 301,
          status: 'active',
          tenant: 'Emma Williams',
          contractManager: 'Foxtons',
          monthlyRent: 1850,
          startDate: '2025-12-01',
          endDate: '2026-11-30',
          paymentDay: 1,
          deposit: 2,
          increment: 'none',
          ipcExtra: 0,
          adminFee: 150,
          notes: '',
        },
      ],
      months: {
        2026: {
          0: { status: 'rented', incomeOverride: null, expenses: { admin: 150, electricity: 75, water: 35, insurance: 95 } },
          1: { status: 'rented', incomeOverride: null, expenses: { admin: 150, electricity: 80, water: 35, insurance: 95 } },
          2: { status: 'rented', incomeOverride: null, expenses: { admin: 150, electricity: 70, water: 35, insurance: 95 } },
        },
      },
      capex: [],
      taxes: { items: [{ id: now + 302, taxId: 'HMRC-2026', amount: 2100, dueDate: '2026-01-31', status: 'paid' }] },
      services: {
        2026: [
          { id: now + 303, provider: 'British Gas', type: 'Electricity', accountNumber: 'BG-441290', monthlyCost: 75, notes: '' },
          { id: now + 304, provider: 'Thames Water', type: 'Water', accountNumber: 'TW-88234', monthlyCost: 35, notes: '' },
        ],
      },
      factSheet: {
        propertyType: 'Studio',
        estrato: null,
        yearBuilt: 1965,
        lastRenovation: 2022,
        floor: 3,
        matriculaInmobiliaria: '',
        cedulaCatastral: '',
        chip: '',
        customId: '',
        purchasePrice: v3.purchasePrice,
        purchaseDate: purchaseStart,
        currentValue: null,
        valuationDate: '',
        photos: [],
        contacts: [
          { id: now + 305, name: 'Foxtons South Ken', role: 'Property Manager', phone: '+44 20 7590 0000', email: 'southken@foxtons.co.uk' },
        ],
        notes: '',
        appreciationRate: 3.25,
        projectionYears: 12,
        valueEquityView: 'history',
        priceHistory: v3.priceHistory,
        mortgage: { ...FS_MORTGAGE_OFF } as NonNullable<FactSheet['mortgage']>,
      },
    },

    // 5 — Urban duplex, rented
    {
      id: now + 400,
      owner: 'James Rivera',
      name: 'Riverside Duplex',
      address: '892 Wacker Drive, Unit A/B',
      neighbourhood: 'River North',
      postalCode: '',
      city: 'Chicago',
      country: 'United States',
      currency: 'USD',
      latitude: 41.8925,
      longitude: -87.6364,
      area: 165,
      bedrooms: 4,
      bathrooms: 3,
      parking: 1,
      storageUnits: 0,
      concierge: false,
      terrace: 0,
      balcony: 0,
      floors: 2,
      year: 2026,
      contracts: [
        {
          id: now + 401,
          status: 'active',
          tenant: 'Jordan Lee & Avery Park',
          contractManager: '',
          monthlyRent: 4200,
          startDate: '2025-07-01',
          endDate: '2026-06-30',
          paymentDay: 1,
          deposit: 2,
          increment: 'fixed',
          ipcExtra: 0,
          adminFee: 0,
          notes: '',
        },
      ],
      months: {
        2026: {
          0: { status: 'rented', incomeOverride: null, expenses: { electricity: 180, water: 90, gas: 110, insurance: 195, maintenance: 75 } },
          1: { status: 'rented', incomeOverride: null, expenses: { electricity: 195, water: 90, gas: 115, insurance: 195, maintenance: 75 } },
          2: { status: 'rented', incomeOverride: null, expenses: { electricity: 170, water: 95, gas: 105, insurance: 195, maintenance: 75 } },
        },
      },
      capex: [],
      taxes: { items: [{ id: now + 402, taxId: 'IL-COOK-2026', amount: 8900, dueDate: '2026-08-01', status: 'pending' }] },
      services: {
        2026: [
          { id: now + 403, provider: 'ComEd', type: 'Electricity', accountNumber: 'CE-77102', monthlyCost: 180, notes: '' },
          { id: now + 404, provider: 'City Water', type: 'Water', accountNumber: 'CW-22901', monthlyCost: 90, notes: '' },
        ],
      },
      factSheet: {
        propertyType: 'House',
        estrato: null,
        yearBuilt: 2002,
        lastRenovation: 2019,
        floor: null,
        matriculaInmobiliaria: '',
        cedulaCatastral: '',
        chip: '',
        customId: '',
        purchasePrice: v4.purchasePrice,
        purchaseDate: purchaseStart,
        currentValue: null,
        valuationDate: '',
        photos: [],
        contacts: [],
        notes: '',
        appreciationRate: 4,
        projectionYears: 15,
        valueEquityView: 'history',
        priceHistory: v4.priceHistory,
        mortgage: { ...FS_MORTGAGE_OFF } as NonNullable<FactSheet['mortgage']>,
      },
    },
  ]
}
