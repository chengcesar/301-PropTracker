import { describe, expect, it } from 'vitest'
import { patchPrimaryOwner, renamePrimaryOwner } from './ownership'
import type { Property } from './types'

const base = (o: Partial<Property> = {}) => ({ owner: '', equityPct: null, factSheet: {}, ...o }) as unknown as Property

describe('renamePrimaryOwner', () => {
  it('only sets owner (no invented equity) when there are no structured owners', () => {
    const p = renamePrimaryOwner(base({ owner: 'Old' }), 'New')
    expect(p.owner).toBe('New')
    expect(p.equityPct).toBeNull()
    expect(p.factSheet?.owners).toBeUndefined()
  })

  it('updates owners[0] and the derived owner string when structured owners exist', () => {
    const p = renamePrimaryOwner(
      base({
        owner: 'A, B',
        factSheet: { owners: [{ id: 1, name: 'A', idNumber: '', equityPct: 60, notes: '' }, { id: 2, name: 'B', idNumber: '', equityPct: 40, notes: '' }] },
      } as Partial<Property>),
      'Z',
    )
    expect(p.factSheet?.owners?.[0]).toMatchObject({ name: 'Z', equityPct: 60 })
    expect(p.owner).toBe('Z, B')
  })

  it('clears owner when the name is emptied', () => {
    const p = renamePrimaryOwner(
      base({ owner: 'A', factSheet: { owners: [{ id: 1, name: 'A', idNumber: '', equityPct: 100, notes: '' }] } } as Partial<Property>),
      '',
    )
    expect(p.owner).toBe('')
  })
})

describe('patchPrimaryOwner', () => {
  it('syncs equityPct to the property and primary owner', () => {
    const p = patchPrimaryOwner(base({ owner: 'A' }), { equityPct: 50 })
    expect(p.equityPct).toBe(50)
    expect(p.factSheet?.owners?.[0].equityPct).toBe(50)
  })
})

// Mirrors api/agent-portfolio.js: equityPct: prop.equityPct ?? prop.factSheet?.owners?.[0]?.equityPct ?? null
const apiEquityPct = (p: Property) => p.equityPct ?? p.factSheet?.owners?.[0]?.equityPct ?? null

describe('agent-portfolio equityPct resolution', () => {
  it('reports 30 after setting 30% on Value & Equity, for both new and structured properties', () => {
    expect(apiEquityPct(patchPrimaryOwner(base({ owner: 'A' }), { equityPct: 30 }))).toBe(30)
    const structured = base({ owner: 'A', factSheet: { owners: [{ id: 1, name: 'A', idNumber: '', equityPct: 100, notes: '' }] } } as Partial<Property>)
    expect(apiEquityPct(patchPrimaryOwner(structured, { equityPct: 30 }))).toBe(30)
  })

  it('keeps 30 when the owner is renamed afterwards (Overview or Value & Equity)', () => {
    const p30 = patchPrimaryOwner(base({ owner: 'A' }), { equityPct: 30 })
    expect(apiEquityPct(renamePrimaryOwner(p30, 'B'))).toBe(30)
    expect(apiEquityPct(patchPrimaryOwner(p30, { name: 'C' }))).toBe(30)
  })

  it('stays null for a property that never had equity set and is only renamed', () => {
    expect(apiEquityPct(renamePrimaryOwner(base({ owner: 'A' }), 'B'))).toBeNull()
  })
})
