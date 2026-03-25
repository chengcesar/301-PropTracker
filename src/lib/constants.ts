export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const EXPENSE_CATS = [
  { key: 'admin', label: 'Admin / mgmt', type: 'auto' as const },
  { key: 'electricity', label: 'Electricity', type: 'manual' as const },
  { key: 'water', label: 'Water', type: 'manual' as const },
  { key: 'gas', label: 'Gas', type: 'manual' as const },
  { key: 'cleaning', label: 'Cleaning', type: 'manual' as const },
  { key: 'maintenance', label: 'Maintenance', type: 'manual' as const },
]

export const CAPEX_CATS = ['Improvement', 'Equipment', 'Repair', 'Other'] as const

export const INCREMENT_OPTS = [
  { value: 'ipc+', label: 'IPC + fixed %' },
  { value: 'ipc', label: 'IPC only' },
  { value: 'fixed', label: 'Fixed %' },
  { value: 'none', label: 'None' },
] as const

export const YEAR_OPTIONS = [2025, 2026, 2027] as const
