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
export const CAPEX_STATUSES = ['To do', 'Ongoing', 'Completed'] as const
export const CAPEX_TREATMENTS = ['capitalize', 'expense'] as const
export const CAPEX_AMORTIZE_BASES = ['manual', 'contract'] as const

export const INCREMENT_OPTS = [
  { value: 'ipc+', label: 'IPC + fixed %' },
  { value: 'ipc', label: 'IPC only' },
  { value: 'fixed', label: 'Fixed %' },
  { value: 'none', label: 'None' },
] as const

export function getYearWindow(center: number): [number, number, number] {
  return [center - 1, center, center + 1]
}

export const PROPERTY_TYPES = ['Apartment', 'House', 'Studio', 'Office', 'Commercial', 'Lot', 'Other'] as const

export type SpatialFieldKey = 'area' | 'bedrooms' | 'bathrooms' | 'parking' | 'storageUnits' | 'terrace' | 'balcony' | 'floors'

export interface SpatialFieldConfig {
  key: SpatialFieldKey
  label: string
  placeholder: string
  suffix?: string
}

const SPATIAL_FIELDS_BY_TYPE: Record<string, SpatialFieldConfig[]> = {
  Apartment: [
    { key: 'area', label: 'Area (m²)', placeholder: '133', suffix: 'm²' },
    { key: 'bedrooms', label: 'Bedrooms', placeholder: '3' },
    { key: 'bathrooms', label: 'Bathrooms', placeholder: '2' },
    { key: 'parking', label: 'Parking', placeholder: '1' },
    { key: 'storageUnits', label: 'Storage units', placeholder: '1' },
    { key: 'terrace', label: 'Terrace (m²)', placeholder: '0', suffix: 'm²' },
    { key: 'balcony', label: 'Balcony (m²)', placeholder: '0', suffix: 'm²' },
  ],
  House: [
    { key: 'area', label: 'Area (m²)', placeholder: '200', suffix: 'm²' },
    { key: 'floors', label: 'Floors', placeholder: '2' },
    { key: 'bedrooms', label: 'Bedrooms', placeholder: '4' },
    { key: 'bathrooms', label: 'Bathrooms', placeholder: '3' },
    { key: 'parking', label: 'Parking', placeholder: '2' },
    { key: 'storageUnits', label: 'Storage units', placeholder: '1' },
    { key: 'terrace', label: 'Terrace (m²)', placeholder: '0', suffix: 'm²' },
  ],
  Studio: [
    { key: 'area', label: 'Area (m²)', placeholder: '35', suffix: 'm²' },
    { key: 'bathrooms', label: 'Bathrooms', placeholder: '1' },
  ],
  Office: [
    { key: 'area', label: 'Area (m²)', placeholder: '150', suffix: 'm²' },
    { key: 'bedrooms', label: 'Units', placeholder: '5' },
    { key: 'bathrooms', label: 'Bathrooms', placeholder: '2' },
    { key: 'parking', label: 'Parking', placeholder: '3' },
    { key: 'storageUnits', label: 'Storage units', placeholder: '1' },
    { key: 'terrace', label: 'Terrace (m²)', placeholder: '0', suffix: 'm²' },
  ],
  Commercial: [
    { key: 'area', label: 'Area (m²)', placeholder: '300', suffix: 'm²' },
    { key: 'bedrooms', label: 'Units', placeholder: '1' },
    { key: 'bathrooms', label: 'Bathrooms', placeholder: '1' },
    { key: 'parking', label: 'Parking', placeholder: '2' },
    { key: 'storageUnits', label: 'Storage units', placeholder: '1' },
  ],
  Lot: [
    { key: 'area', label: 'Area (m²)', placeholder: '500', suffix: 'm²' },
  ],
  Other: [
    { key: 'area', label: 'Area (m²)', placeholder: '133', suffix: 'm²' },
    { key: 'bedrooms', label: 'Bedrooms/Units', placeholder: '3' },
    { key: 'bathrooms', label: 'Bathrooms', placeholder: '2' },
    { key: 'parking', label: 'Parking', placeholder: '1' },
    { key: 'storageUnits', label: 'Storage units', placeholder: '1' },
    { key: 'terrace', label: 'Terrace (m²)', placeholder: '0', suffix: 'm²' },
    { key: 'balcony', label: 'Balcony (m²)', placeholder: '0', suffix: 'm²' },
  ],
}

export function getSpatialFields(propertyType: string): SpatialFieldConfig[] {
  return SPATIAL_FIELDS_BY_TYPE[propertyType] || SPATIAL_FIELDS_BY_TYPE['Other']
}
