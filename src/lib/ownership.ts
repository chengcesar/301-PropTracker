import type { FactSheet, OwnershipEntry, Property } from './types'

/**
 * Ownership source of truth: `factSheet.owners[]` (names, ids, equity %).
 * `prop.owner` is a display string derived from it (used by the portfolio table/filters);
 * a property with no structured owners falls back to `prop.owner` alone.
 */
function ownerDisplayString(owners: OwnershipEntry[]): string {
  return owners.length <= 2
    ? owners.map((o) => o.name).filter(Boolean).join(', ')
    : `${owners[0]?.name || ''} +${owners.length - 1}`
}

/** Edit the primary owner's name and/or equity %, keeping `owners[]`, `owner` and `equityPct` in sync. */
export function patchPrimaryOwner(
  p: Property,
  patch: Partial<Pick<OwnershipEntry, 'name' | 'equityPct'>>,
): Property {
  const f = (p.factSheet ?? {}) as FactSheet
  const current: OwnershipEntry[] = f.owners?.length
    ? [...f.owners]
    : p.owner
      ? [{ id: 0, name: p.owner, idNumber: '', equityPct: patch.equityPct ?? 100, notes: '' }]
      : []

  const next: OwnershipEntry[] =
    current.length === 0
      ? [{
          id: Date.now(),
          name: patch.name ?? '',
          idNumber: '',
          equityPct: patch.equityPct !== undefined && Number.isFinite(patch.equityPct) ? patch.equityPct : 100,
          notes: '',
        }]
      : current.map((o, i) => (i === 0 ? { ...o, ...patch } : o))

  const display = ownerDisplayString(next)
  return {
    ...p,
    owner: patch.name !== undefined ? display : display || p.owner,
    equityPct: patch.equityPct !== undefined ? patch.equityPct : p.equityPct,
    factSheet: { ...f, owners: next } as FactSheet,
  } as Property
}

/**
 * Rename the primary owner from a surface that doesn't manage equity (e.g. Overview).
 * With structured owners it updates `owners[0]`; otherwise it only sets `owner`, so no
 * equity % is invented for a property that never had one.
 */
export function renamePrimaryOwner(p: Property, name: string): Property {
  if (p.factSheet?.owners?.length) return patchPrimaryOwner(p, { name })
  return { ...p, owner: name }
}
