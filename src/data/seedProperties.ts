import type { Property } from '../lib/types'

/** Initial sample data — matches rental-manager.html */
export function seedProperties(): Property[] {
  return [
    {
      id: 1,
      owner: '',
      name: 'Apto 102',
      address: 'Calle 78 #5-32',
      neighbourhood: 'Chicó',
      city: 'Bogotá',
      country: 'Colombia',
      currency: 'COP',
      type: '2-bed',
      ref: 'AAA0093HHNN',
      year: 2026,
      contracts: [
        {
          id: 101,
          status: 'archived',
          tenant: 'Carlos Mejía',
          contractManager: '',
          monthlyRent: 1650000,
          startDate: '2025-02-01',
          endDate: '2025-12-31',
          paymentDay: 2,
          deposit: 2,
          increment: 'ipc+',
          ipcExtra: 1,
          adminFee: 1200000,
          notes: 'First tenant. Left on good terms.',
        },
        {
          id: 102,
          status: 'active',
          tenant: 'Empresa S.A.S.',
          contractManager: '',
          monthlyRent: 1808629,
          startDate: '2026-02-01',
          endDate: '2027-01-31',
          paymentDay: 2,
          deposit: 2,
          increment: 'ipc+',
          ipcExtra: 1,
          adminFee: 1320099,
          notes: '',
        },
      ],
      months: {
        2026: {
          0: {
            status: 'rented',
            incomeOverride: null,
            expenses: {
              electricity: 247140,
              water: 175000,
              gas: 0,
              cleaning: 0,
              maintenance: 0,
            },
          },
          1: {
            status: 'rented',
            incomeOverride: null,
            expenses: {
              electricity: 279000,
              water: 175000,
              gas: 0,
              cleaning: 0,
              maintenance: 0,
            },
          },
          2: {
            status: 'rented',
            incomeOverride: null,
            expenses: {
              electricity: 300000,
              water: 199000,
              gas: 0,
              cleaning: 0,
              maintenance: 0,
            },
          },
          3: {
            status: 'rented',
            incomeOverride: null,
            expenses: {
              electricity: 300000,
              water: 0,
              gas: 0,
              cleaning: 0,
              maintenance: 0,
            },
          },
        },
      },
      capex: [
        {
          id: 1,
          date: '2026-03-15',
          desc: 'Bathroom fixtures replacement',
          cat: 'Improvement',
          amount: 2400000,
        },
      ],
      taxes: {
        items: [
          { id: 1001, taxId: 'CL 78 5 32 - AP 102', amount: 3472000, dueDate: '2025-04-25', status: 'paid' },
          { id: 1002, taxId: 'CL 78 5 32 - GS 19', amount: 233000, dueDate: '2025-04-25', status: 'paid' },
          { id: 1003, taxId: 'CL 78 5 32 - GS 18', amount: 225000, dueDate: '2025-04-25', status: 'paid' },
          { id: 1004, taxId: 'CL 78 5 32 - DP 14', amount: 36000, dueDate: '2025-04-25', status: 'paid' },
        ],

      },
    },
    {
      id: 2,
      owner: '',
      name: 'Apto 103',
      address: 'Calle 78 #5-32',
      neighbourhood: 'Chicó',
      city: 'Bogotá',
      country: 'Colombia',
      currency: 'COP',
      type: '2-bed',
      ref: 'AAA0093HH0E',
      year: 2026,
      contracts: [
        {
          id: 201,
          status: 'active',
          tenant: 'Juan Pérez',
          contractManager: '',
          monthlyRent: 2360100,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          paymentDay: 1,
          deposit: 1,
          increment: 'ipc+',
          ipcExtra: 1,
          adminFee: 2360100,
          notes: '',
        },
      ],
      months: {
        2026: {
          0: {
            status: 'rented',
            incomeOverride: null,
            expenses: { electricity: 0, water: 0, gas: 0, cleaning: 0, maintenance: 0 },
          },
        },
      },
      capex: [],
      taxes: {
        items: [
          { id: 2001, taxId: 'CL 78 5 32 - AP 103', amount: 6674000, dueDate: '2025-04-25', status: 'paid' },
        ],

      },
    },
  ]
}
