# Maintenance Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Maintenance events" section to the Services tab for ad-hoc maintenance/repair costs that reduce NOI via OpEx, and surface those events in the Portfolio "Maintenance & Works" panel alongside CapEx.

**Architecture:** A new `MaintenanceEvent` type stored flat on `Property.maintenanceEvents[]` (same pattern as `serviceOneTimeItems`). Its amount is folded into `getMonthData()`'s `totalOpex` for the event's start-date month, so NOI drops automatically everywhere NOI is already computed (Cashflow, Overview, Portfolio rollups) with no changes needed to those tabs' breakdown tables. The Services tab gets a new section cloning the existing "One-time payments" section's UI pattern. The Portfolio "Maintenance & Works" panel merges maintenance events into its existing CapEx-sourced list.

**Tech Stack:** React 19 + TypeScript, Vitest for `src/lib/finance.ts` unit tests (no component-test harness exists in this repo — UI changes are verified manually via the dev server, matching existing project convention).

---

### Task 1: Add the `MaintenanceEvent` type

**Files:**
- Modify: `src/lib/types.ts:82-92` (insert after `ServiceOneTimeItem`), `src/lib/types.ts:194` (insert into `Property`)

- [ ] **Step 1: Add the `MaintenanceEvent` interface**

In `src/lib/types.ts`, insert immediately after the `ServiceOneTimeItem` interface (which ends at line 92, right before `export interface OwnershipEntry`):

```ts
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
```

- [ ] **Step 2: Add the field to `Property`**

In the same file, in the `Property` interface, change:

```ts
  serviceOneTimeItems?: ServiceOneTimeItem[]
```

to:

```ts
  serviceOneTimeItems?: ServiceOneTimeItem[]
  maintenanceEvents?: MaintenanceEvent[]
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: exits with no errors (no other file references `MaintenanceEvent` yet, so this is purely additive).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add MaintenanceEvent type and Property.maintenanceEvents field"
```

---

### Task 2: Wire maintenance events into OpEx/NOI

**Files:**
- Modify: `src/lib/finance.ts:405-407` (insert new function), `src/lib/finance.ts:423-432` (`getMonthData` body)
- Test: `src/lib/finance.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to the end of `src/lib/finance.test.ts` (current file ends at line 262):

```ts
import { sumMaintenanceForMonth } from './finance'
import type { MaintenanceEvent } from './types'

function makeMaintenanceEvent(overrides: Partial<MaintenanceEvent> = {}): MaintenanceEvent {
  return {
    id: 1,
    desc: 'Plumbing repair',
    cat: 'Repair',
    amount: 200,
    date: '2026-03-10',
    ...overrides,
  }
}

describe('sumMaintenanceForMonth', () => {
  it('sums events whose start date falls in the given month and year', () => {
    const p = makeProperty({
      year: 2026,
      maintenanceEvents: [
        makeMaintenanceEvent({ id: 1, amount: 200, date: '2026-03-10' }),
        makeMaintenanceEvent({ id: 2, amount: 50, date: '2026-03-25' }),
        makeMaintenanceEvent({ id: 3, amount: 999, date: '2026-04-01' }), // different month
        makeMaintenanceEvent({ id: 4, amount: 999, date: '2025-03-10' }), // different year
      ],
    })
    expect(sumMaintenanceForMonth(p, 2)).toBe(250) // March = month index 2
  })

  it('returns 0 when there are no maintenance events', () => {
    const p = makeProperty({ year: 2026 })
    expect(sumMaintenanceForMonth(p, 2)).toBe(0)
  })
})

describe('getMonthData includes maintenance events in totalOpex/noi', () => {
  it('reduces NOI by the maintenance amount booked to its start month', () => {
    const c = makeContract({
      monthlyRent: 1000, increment: 'none',
      startDate: '2020-01-01', endDate: '2030-12-31',
    })
    const p = makeProperty({
      year: 2026,
      contracts: [c],
      maintenanceEvents: [makeMaintenanceEvent({ amount: 300, date: '2026-06-15' })],
    })
    const june = getMonthData(p, 5) // June = month index 5
    expect(june.totalOpex).toBe(300)
    expect(june.noi).toBe(1000 - 300)

    const july = getMonthData(p, 6) // no maintenance event this month
    expect(july.totalOpex).toBe(0)
    expect(july.noi).toBe(1000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/finance.test.ts`
Expected: FAIL — `sumMaintenanceForMonth` is not exported from `./finance`.

- [ ] **Step 3: Implement `sumMaintenanceForMonth` and wire it into `getMonthData`**

In `src/lib/finance.ts`, insert this function right before `export function getMonthData` (currently at line 407, directly after the blank line following `calcPortfolioProjectedGpiIn`):

```ts
/**
 * Sum of `maintenanceEvents` attributed to calendar month `monthIndex` (0–11)
 * when the event's start `date` falls in `prop.year`. Missing `date` contributes 0.
 */
export function sumMaintenanceForMonth(prop: Property, monthIndex: number): number {
  let sum = 0
  for (const item of prop.maintenanceEvents ?? []) {
    if (!item.date?.trim()) continue
    const d = new Date(item.date + 'T12:00')
    if (d.getFullYear() !== prop.year) continue
    if (d.getMonth() !== monthIndex) continue
    sum += item.amount ?? 0
  }
  return sum
}

```

Then, inside `getMonthData`, change:

```ts
  const autoExp: Record<string, number> = {}
  const manExp = { ...m.expenses }
  const manualSum = sumNumericExpenseValues(manExp as Record<string, unknown>)
  const totalOpex = manualSum
  return {
```

to:

```ts
  const autoExp: Record<string, number> = {}
  const manExp = { ...m.expenses }
  const manualSum = sumNumericExpenseValues(manExp as Record<string, unknown>)
  const maintenance = sumMaintenanceForMonth(prop, mIdx)
  const totalOpex = manualSum + maintenance
  return {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/finance.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): fold maintenance events into OpEx/NOI for their start month"
```

---

### Task 3: ServicesTab — add the Maintenance events section (state, handlers, and render)

**Files:**
- Modify: `src/components/property/ServicesTab.tsx:1-2` (imports), `src/components/property/ServicesTab.tsx:303` (insert state/handlers block before `return`), `src/components/property/ServicesTab.tsx:682-683` (insert render block)

Note: state/handlers and JSX are done as one task, not two — with `noUnusedLocals: true` in `tsconfig.app.json`, adding the handlers without the JSX that uses them would fail `tsc -b` with "declared but never read" errors.

- [ ] **Step 1: Extend imports**

Change:

```tsx
import type { Property, ServiceEntry, ServiceOneTimeItem, TaxStatus } from '../../lib/types'
```

to:

```tsx
import type { CapexStatus, MaintenanceEvent, Property, ServiceEntry, ServiceOneTimeItem, TaxStatus } from '../../lib/types'
```

and add a new import line right after the existing `fmt, parseNum` import (currently `import { fmt, parseNum } from '../../lib/format'`):

```tsx
import { CAPEX_CATS, CAPEX_STATUSES } from '../../lib/constants'
```

- [ ] **Step 2: Add maintenance-events state and handlers**

Insert this block immediately after the existing `handleCopy` callback closes (the block ending `}, [services, totalMonthlyCost, cx])` at line 303) and before `return (` at line 305:

```tsx
  const maintenanceItems = prop.maintenanceEvents ?? []
  const maintenanceYearTotal = maintenanceItems.reduce((a, it) => {
    if (!it.date?.trim()) return a
    const d = new Date(it.date + 'T12:00')
    if (d.getFullYear() !== prop.year) return a
    return a + (it.amount ?? 0)
  }, 0)

  const [showMaintForm, setShowMaintForm] = useState(false)
  const [editingMaintId, setEditingMaintId] = useState<number | null>(null)
  const [copiedMaint, setCopiedMaint] = useState(false)
  const [formMaint, setFormMaint] = useState({
    desc: '',
    provider: '',
    cat: 'Repair' as (typeof CAPEX_CATS)[number],
    amount: '',
    date: '',
    dateEnd: '',
    status: 'To do' as CapexStatus,
    notes: '',
  })

  const setMaint = <K extends keyof typeof formMaint>(k: K, v: (typeof formMaint)[K]) => {
    setFormMaint((p) => ({ ...p, [k]: v }))
  }

  const resetMaintForm = () => {
    setFormMaint({ desc: '', provider: '', cat: 'Repair', amount: '', date: '', dateEnd: '', status: 'To do', notes: '' })
    setShowMaintForm(false)
    setEditingMaintId(null)
  }

  const addMaintenance = () => {
    if (!formMaint.desc.trim() || !formMaint.date.trim()) return
    const item: MaintenanceEvent = {
      id: Date.now(),
      desc: formMaint.desc.trim(),
      provider: formMaint.provider.trim() || undefined,
      cat: formMaint.cat,
      amount: parseNum(formMaint.amount),
      date: formMaint.date,
      dateEnd: formMaint.dateEnd.trim() || undefined,
      status: formMaint.status,
      notes: formMaint.notes.trim() || undefined,
    }
    onUpdateProp((p) => ({
      ...p,
      maintenanceEvents: [...(p.maintenanceEvents ?? []), item],
    }))
    resetMaintForm()
  }

  const startEditMaintenance = (it: MaintenanceEvent) => {
    setEditingMaintId(it.id)
    setFormMaint({
      desc: it.desc,
      provider: it.provider ?? '',
      cat: it.cat,
      amount: it.amount ? String(it.amount) : '',
      date: it.date,
      dateEnd: it.dateEnd ?? '',
      status: it.status ?? 'To do',
      notes: it.notes ?? '',
    })
    setShowMaintForm(true)
  }

  const saveEditMaintenance = () => {
    if (!formMaint.desc.trim() || !formMaint.date.trim() || editingMaintId === null) return
    onUpdateProp((p) => ({
      ...p,
      maintenanceEvents: (p.maintenanceEvents ?? []).map((it) =>
        it.id === editingMaintId
          ? {
              ...it,
              desc: formMaint.desc.trim(),
              provider: formMaint.provider.trim() || undefined,
              cat: formMaint.cat,
              amount: parseNum(formMaint.amount),
              date: formMaint.date,
              dateEnd: formMaint.dateEnd.trim() || undefined,
              status: formMaint.status,
              notes: formMaint.notes.trim() || undefined,
            }
          : it,
      ),
    }))
    resetMaintForm()
  }

  const removeMaintenance = (id: number) => {
    onUpdateProp((p) => ({
      ...p,
      maintenanceEvents: (p.maintenanceEvents ?? []).filter((it) => it.id !== id),
    }))
  }

  const handleCopyMaintenance = useCallback(() => {
    const headers = ['Description', 'Provider', 'Category', 'Amount', 'Start date', 'End date', 'Status', 'Notes']
    const rows = maintenanceItems.map((it) =>
      [
        it.desc || '—',
        it.provider || '—',
        it.cat,
        it.amount ? fmt(cx(it.amount)) : '—',
        formatPayCell(it.date),
        it.dateEnd ? formatPayCell(it.dateEnd) : '—',
        it.status ?? 'To do',
        it.notes || '—',
      ].join('\t'),
    )
    const totalAll = maintenanceItems.reduce((a, it) => a + (it.amount ?? 0), 0)
    rows.push(['Total (all)', '', '', totalAll ? fmt(cx(totalAll)) : '—', '', '', '', ''].join('\t'))
    navigator.clipboard.writeText([headers.join('\t'), ...rows].join('\n'))
    setCopiedMaint(true)
    setTimeout(() => setCopiedMaint(false), 2000)
  }, [maintenanceItems, cx])
```

Note: this block calls `formatPayCell`, which is already defined earlier in the component (line 264) — safe to reference since this block runs after it in the function body.

- [ ] **Step 3: Insert the section JSX**

In `src/components/property/ServicesTab.tsx`, find:

```tsx
            <div className="flex gap8 mt12">
              <button
                type="button"
                className="primary"
                style={{ fontSize: 12, padding: '6px 16px' }}
                onClick={editingOtId ? saveEditOt : addOneTime}
              >
                {editingOtId ? 'Save changes' : 'Add payment'}
              </button>
              <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={resetOtForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

Replace it with (this inserts the new section between the one-time-payment form's `)}` and the component's closing `</div>`):

```tsx
            <div className="flex gap8 mt12">
              <button
                type="button"
                className="primary"
                style={{ fontSize: 12, padding: '6px 16px' }}
                onClick={editingOtId ? saveEditOt : addOneTime}
              >
                {editingOtId ? 'Save changes' : 'Add payment'}
              </button>
              <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={resetOtForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sec-hdr mb12 mt24">
        <span className="sec-title">Maintenance events · {prop.year}</span>
        <button
          type="button"
          className="primary"
          style={{ fontSize: 12, padding: '5px 14px' }}
          onClick={() => setShowMaintForm(true)}
        >
          + Add event
        </button>
      </div>
      <div className="fs12 text3 mb12" style={{ maxWidth: 640 }}>
        Ad-hoc costs routed to OpEx — reduce NOI.
      </div>

      {maintenanceItems.length === 0 && !showMaintForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-title">No maintenance events</div>
              <div className="fs12 text3 mt4">Add ad-hoc maintenance costs that reduce NOI via OpEx</div>
              <button type="button" className="primary mt12" onClick={() => setShowMaintForm(true)}>
                + Add first event
              </button>
            </div>
          </div>
        </div>
      )}

      {maintenanceItems.length > 0 && (
        <div className="card mb24" style={{ overflow: 'hidden' }}>
          <table className="cf-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Description</th>
                <th style={{ textAlign: 'left' }}>Provider</th>
                <th style={{ textAlign: 'left' }}>Category</th>
                <th>Amount</th>
                <th>Start date</th>
                <th>End date</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'left' }}>Notes</th>
                <th style={{ width: 64, textAlign: 'center' }}>
                  <button
                    className="ghost"
                    style={{ padding: 0, border: 'none', background: 'transparent', margin: '0 auto', display: 'block' }}
                    title={copiedMaint ? 'Copied!' : 'Copy table'}
                    onClick={handleCopyMaintenance}
                  >
                    {copiedMaint ? <IconCheck /> : <IconCopy />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {maintenanceItems.map((it) => {
                const status = it.status ?? 'To do'
                return (
                  <tr key={it.id}>
                    <td style={{ textAlign: 'left', fontWeight: 500 }}>{it.desc}</td>
                    <td style={{ textAlign: 'left' }}>{it.provider || '—'}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span
                        className={`badge ${
                          it.cat === 'Improvement' ? 'rented' : it.cat === 'Equipment' ? 'override' : it.cat === 'Repair' ? 'pending' : ''
                        }`}
                      >
                        {it.cat}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{it.amount ? fmt(cx(it.amount)) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatPayCell(it.date)}</td>
                    <td style={{ textAlign: 'right' }}>{it.dateEnd ? formatPayCell(it.dateEnd) : '—'}</td>
                    <td style={{ textAlign: 'left' }}>
                      <span className={`badge ${status === 'Completed' ? 'rented' : status === 'Ongoing' ? 'override' : 'pending'}`}>
                        {status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 12 }}>{it.notes || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: '4px 8px', fontSize: 13 }}
                        onClick={() => startEditMaintenance(it)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button type="button" className="ghost danger" style={{ padding: '4px 8px' }} onClick={() => removeMaintenance(it.id)} title="Delete">
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr className="total-row">
                <td style={{ textAlign: 'left' }}>Total ({prop.year})</td>
                <td />
                <td />
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{maintenanceYearTotal ? fmt(cx(maintenanceYearTotal)) : '—'}</td>
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showMaintForm && (
        <div className="card mb24">
          <div className="card-inner">
            <div className="sec-title mb12">{editingMaintId ? 'Edit maintenance event' : 'New maintenance event'}</div>
            <div className="contract-grid">
              <div className="field">
                <label>Description *</label>
                <input type="text" placeholder="Describe the maintenance work..." value={formMaint.desc} onChange={(e) => setMaint('desc', e.target.value)} />
              </div>
              <div className="field">
                <label>Service provider</label>
                <input type="text" placeholder="Contractor, company..." value={formMaint.provider} onChange={(e) => setMaint('provider', e.target.value)} />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={formMaint.cat} onChange={(e) => setMaint('cat', e.target.value as (typeof CAPEX_CATS)[number])}>
                  {CAPEX_CATS.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Amount ({prop.currency})</label>
                <input type="text" placeholder="0" value={formMaint.amount} onChange={(e) => setMaint('amount', e.target.value)} />
              </div>
              <div className="field">
                <label>Start date *</label>
                <input type="date" value={formMaint.date} onChange={(e) => setMaint('date', e.target.value)} />
              </div>
              <div className="field">
                <label>End date</label>
                <input type="date" value={formMaint.dateEnd} onChange={(e) => setMaint('dateEnd', e.target.value)} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={formMaint.status} onChange={(e) => setMaint('status', e.target.value as CapexStatus)}>
                  {CAPEX_STATUSES.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Notes</label>
                <input type="text" value={formMaint.notes} onChange={(e) => setMaint('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex gap8 mt12">
              <button
                type="button"
                className="primary"
                style={{ fontSize: 12, padding: '6px 16px' }}
                onClick={editingMaintId ? saveEditMaintenance : addMaintenance}
              >
                {editingMaintId ? 'Save changes' : 'Add event'}
              </button>
              <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={resetMaintForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`

In the browser: open any property → Services tab. Confirm:
- A "Maintenance events" section appears below "One-time payments", with an empty state and "+ Add first event" button.
- Clicking "+ Add event" (or "+ Add first event") shows the inline form with fields Description, Service provider, Category (defaulting to "Repair"), Amount, Start date, End date, Status (defaulting to "To do"), Notes.
- Filling Description + Start date and clicking "Add event" adds a row to the table, updates the "Total ({year})" row, and resets/hides the form.
- The ✎ button re-opens the form pre-filled for editing; saving updates the row. The × button removes the row.
- The copy-icon button copies a tab-separated table to the clipboard (paste into a text editor to confirm).
- Switch to the Overview or Cashflow tab for the same month as the event's start date and confirm NOI/OPEX for that month decreased by the event's amount compared to before adding it.

- [ ] **Step 6: Commit**

```bash
git add src/components/property/ServicesTab.tsx
git commit -m "feat(services): add Maintenance events section to Services tab"
```

---

### Task 4: Portfolio "Maintenance & Works" panel — include maintenance events

**Files:**
- Modify: `src/pages/PortfolioPage.tsx:4` (import), `src/pages/PortfolioPage.tsx:2080-2092` (`maintenanceItems`), `src/pages/PortfolioPage.tsx:1763-1768` (status handler), `src/pages/PortfolioPage.tsx:3997,4010,4023` (`onStatusChange` call sites)

- [ ] **Step 1: Extend the type import**

Change:

```tsx
import type { CapexItem, CapexStatus, Contract, Property } from '../lib/types'
```

to:

```tsx
import type { CapexItem, CapexStatus, Contract, MaintenanceEvent, Property } from '../lib/types'
```

- [ ] **Step 2: Merge maintenance events into `maintenanceItems`**

Change:

```tsx
  // Maintenance panel — current-year CAPEX items from all filtered properties
  const maintenanceItems = useMemo(() => {
    const calYear = new Date().getFullYear()
    const out: Array<CapexItem & { propertyId: number; propertyName: string }> = []
    for (const p of filteredProperties) {
      for (const c of (p.capex ?? [])) {
        if (new Date(c.date).getFullYear() === calYear) {
          out.push({ ...c, propertyId: p.id, propertyName: p.name })
        }
      }
    }
    return out
  }, [filteredProperties])
```

to:

```tsx
  // Maintenance panel — current-year CAPEX + maintenance events from all filtered properties
  const maintenanceItems = useMemo(() => {
    const calYear = new Date().getFullYear()
    const out: Array<CapexItem & { propertyId: number; propertyName: string; source: 'capex' | 'maintenance' }> = []
    for (const p of filteredProperties) {
      for (const c of (p.capex ?? [])) {
        if (new Date(c.date).getFullYear() === calYear) {
          out.push({ ...c, propertyId: p.id, propertyName: p.name, source: 'capex' })
        }
      }
      for (const c of (p.maintenanceEvents ?? [])) {
        if (new Date(c.date).getFullYear() === calYear) {
          out.push({ ...c, propertyId: p.id, propertyName: p.name, source: 'maintenance' })
        }
      }
    }
    return out
  }, [filteredProperties])
```

(`MaintenanceEvent` is structurally identical to `CapexItem` in the fields this panel reads — `id, date, dateEnd?, desc, cat, amount, status?` — so this typechecks without a cast.)

- [ ] **Step 3: Add the maintenance status handler**

Change:

```tsx
  function handleCapexStatus(propertyId: number, capexId: number, next: CapexStatus) {
    updateProperty(propertyId, p => ({
      ...p,
      capex: p.capex.map(c => c.id === capexId ? { ...c, status: next } : c),
    }))
  }
```

to:

```tsx
  function handleCapexStatus(propertyId: number, capexId: number, next: CapexStatus) {
    updateProperty(propertyId, p => ({
      ...p,
      capex: p.capex.map(c => c.id === capexId ? { ...c, status: next } : c),
    }))
  }

  function handleMaintenanceStatus(propertyId: number, eventId: number, next: CapexStatus) {
    updateProperty(propertyId, p => ({
      ...p,
      maintenanceEvents: (p.maintenanceEvents ?? []).map(c => c.id === eventId ? { ...c, status: next } : c),
    }))
  }
```

- [ ] **Step 4: Branch the `onStatusChange` call sites on `source`**

There are three identical occurrences of this line (inside the `mTodo.map`, `mOngoing.map`, and `mCompleted.map` blocks, at lines 3997, 4010, and 4023):

```tsx
                      onStatusChange={next => handleCapexStatus(c.propertyId, c.id, next)}
```

Replace **all three** occurrences with:

```tsx
                      onStatusChange={next => c.source === 'capex' ? handleCapexStatus(c.propertyId, c.id, next) : handleMaintenanceStatus(c.propertyId, c.id, next)}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`

In the browser: add a maintenance event dated in the current calendar year to a property (via its Services tab), then open the Portfolio page. Confirm:
- The item count and the new item appear in the "Maintenance & Works" panel's "To Do" section (or "Ongoing"/"Completed" if you set that status).
- Clicking the card's status-advance control moves it between To Do → Ongoing → Completed, and the scorecards/counts update.
- The existing CapEx items in the same panel still behave exactly as before (unaffected).

- [ ] **Step 7: Commit**

```bash
git add src/pages/PortfolioPage.tsx
git commit -m "feat(portfolio): include maintenance events in Maintenance & Works panel"
```

---

### Task 5: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `sumMaintenanceForMonth` / `getMonthData` tests from Task 2.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: builds successfully (`tsc -b && vite build`), no type errors.

- [ ] **Step 4: End-to-end manual walkthrough**

Run: `npm run dev`. In the browser:
1. Open a property with an active contract for the current year → Services tab.
2. Add a maintenance event with a start date in a month that currently has income, amount e.g. 300, category "Repair", status "To do".
3. Go to the Overview tab (or Cashflow tab) and confirm that month's OPEX increased by 300 and NOI decreased by 300 compared to before.
4. Go back to Services tab, edit the event's amount to 500, confirm the Overview/Cashflow numbers update accordingly.
5. Delete the event, confirm the numbers revert.
6. Re-add an event, then open the Portfolio page and confirm it shows up in "Maintenance & Works" (if the event's start date is in the current real-world year) and that toggling its status there works.
7. Confirm the pre-existing "One-time payments" section and CapEx log still work exactly as before (unaffected by these changes).
