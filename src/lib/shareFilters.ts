import type { Property, ShareFilter, ShareScope, ShareFilterField } from './types'

/**
 * Returns the subset of properties a viewer can see given a share's scope.
 *
 * - "portfolio"  → all properties
 * - "properties" → only those whose id is in propertyIds
 * - "filtered"   → AND across filter entries; OR within each entry's values
 */
export function applyShareFilters(
  properties: Property[],
  scope: ShareScope,
  filters: ShareFilter[],
  propertyIds: number[],
): Property[] {
  if (scope === 'portfolio') return properties
  if (scope === 'properties') return properties.filter((p) => propertyIds.includes(p.id))
  // "filtered"
  return properties.filter((p) =>
    filters.every((f) => {
      const value = p[f.field as keyof Property] as string | undefined
      if (value === undefined || value === '') return false
      return f.values.includes(value)
    }),
  )
}

/**
 * Returns all unique values present in the portfolio for a given filter field.
 * Used to populate the multi-select options in the invite modal.
 */
export function filterFieldValues(
  properties: Property[],
  field: ShareFilterField,
): string[] {
  const seen = new Set<string>()
  for (const p of properties) {
    const value = p[field as keyof Property] as string | undefined
    if (value && value.trim()) seen.add(value.trim())
  }
  return [...seen].sort()
}
