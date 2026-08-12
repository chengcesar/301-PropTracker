# Maintenance events — design

## Problem

The Services tab has a "One-time payments" section for lump fees that hit Cashflow in a
single month. There's no equivalent for ad-hoc maintenance/repair costs (a plumber
callout, a roof patch, etc.) that should reduce NOI via OpEx rather than just Cashflow.
The existing CapEx log is the closest thing but is capital-expenditure framed (no service
provider, no notes) and deliberately sits *below* NOI (in "Below the line"), not inside it.

## Data model

New type in `src/lib/types.ts`, reusing the existing `CAPEX_CATS` categories and
`CapexStatus` values so no new constants are introduced:

```ts
export interface MaintenanceEvent {
  id: number
  desc: string                          // Description *
  provider?: string                     // Service provider
  cat: 'Improvement' | 'Equipment' | 'Repair' | 'Other'
  amount: number
  date: string                          // Start date *
  dateEnd?: string                      // End date
  status?: CapexStatus                  // 'To do' | 'Ongoing' | 'Completed'
  notes?: string
}
```

Stored flat on `Property.maintenanceEvents?: MaintenanceEvent[]` — not year-keyed, same
pattern as `serviceOneTimeItems`. Year scoping happens at read time by filtering on `date`.

## OpEx / NOI wiring

Add `sumMaintenanceForMonth(prop, monthIndex)` to `src/lib/finance.ts`, filtering
`maintenanceEvents` by `date`'s year (`=== prop.year`) and month, mirroring
`sumServiceOneTimeForMonth`. The event's full amount is booked to the month of its
**start date** — no proration across `dateEnd`, per confirmed behavior.

Fold this sum into `getMonthData()`'s `totalOpex` (alongside the existing manual
`expenses` sum), so `noi = income - totalOpex` reflects it automatically for that month.
`calcAnnual()` already aggregates `totalOpex` from `getMonthData()` per month, so the
annual NOI/Cashflow/Overview figures pick it up with no further wiring.

One-time payments remain unchanged: they bypass OpEx/NOI entirely and only subtract at
the `netCf` level. Maintenance events are intentionally different — they reduce NOI.

**Addendum (added after initial implementation):** the original version of this spec
argued maintenance events didn't need their own row in `CashflowTab`'s P&L waterfall or
`OpexCapexTab`'s categorized monthly OpEx table, citing the "extra" one-off month
expenses precedent as justification. A post-implementation review found that precedent
doesn't actually generalize — extras live inside `m.expenses` so `OverviewTab`'s own
`extraKeys` scan picks them up, but maintenance events live in a wholly separate
`prop.maintenanceEvents` array invisible to `expenseRowsForYear` and every view built on
it. Left as-is, `CashflowTab`'s waterfall, `OverviewTab`'s expense grid, and
`OpexCapexTab`'s OPEX-by-month table would all silently stop reconciling with the
NOI/OpEx figures shown elsewhere once a maintenance event exists. Fixed by adding
`sumMaintenanceAnnual(prop)` and an informational `AnnualResult.maintenance` field (not
double-subtracted in `netCf`), and by adding an explicit "Maintenance" row/column to all
three of those views, sourced from the same `sumMaintenanceForMonth`/`sumMaintenanceAnnual`
functions used for the real NOI math — see "Reconciliation" below.

## Reconciliation with existing OpEx breakdown views

- `src/lib/finance.ts`: `sumMaintenanceAnnual(prop)` sums `sumMaintenanceForMonth` across
  all 12 months. `AnnualResult` gained `maintenance: number` — informational only, already
  reflected inside `totalOpex`/`noi`; `netCf`'s formula is unchanged.
- `CashflowTab.tsx`: a `− Maintenance` row (shown when `ann.maintenance > 0`) in the P&L
  waterfall's Operating Expenses section, using the same purple (`#4A3FA0`) as the other
  category rows, positioned just above the NOI subtotal.
- `OverviewTab.tsx`: a read-only `Maintenance` row (`editable: false`, `removable: false`)
  in the monthly expense grid, pushed into `rows` before the totals/grand-total
  computation so both include it; its remove/add row-actions are hidden since it isn't a
  real expense category.
- `OpexCapexTab.tsx`: a `Maintenance` column in the "OPEX by month" table, folded into
  each month's `Total`.

## UI — Services tab

New "Maintenance events" section in `src/components/property/ServicesTab.tsx`, placed
directly below "One-time payments · {year}". Structurally a clone of that section's
existing pattern (no modal, inline toggle form, `editingId` distinguishes add vs. edit):

- Header: `Maintenance events · {prop.year}` + `+ Add event` button (top-right, primary).
- Subtext: "Ad-hoc costs routed to OpEx — reduce NOI."
- Empty state: "No maintenance events" / "Add ad-hoc maintenance costs that reduce NOI
  via OpEx" / "+ Add first event" button.
- Table (shown whenever `maintenanceEvents.length > 0`, same as one-time payments —
  **all** events across all years are listed, not just the selected year; only the total
  row is year-filtered): Description | Provider | Category (badge) | Amount | Start date
  | End date | Status (colored pill, editable inline like one-time payment status) |
  Notes | copy-to-clipboard action column. Edit (✎) / delete (×) buttons per row. Total
  row: `Total ({prop.year})` summing amounts whose `date` falls in the selected year.
- Inline add/edit form (`.contract-grid` + `.field`, same as "New one-time payment"):
  Description* (text), Service provider (text), Category (select, `CAPEX_CATS`, default
  `'Repair'`), Amount in `prop.currency` (text/number), Start date* (date), End date
  (date), Status (select, `CAPEX_STATUSES`, default `'To do'`), Notes (text, full width).
  Required fields to submit: Description + Start date (matches one-time payment's
  provider+date requirement pattern).
- Category badge colors and status pill colors reuse the same visual treatment already
  used for CapEx categories/statuses in `OpexCapexTab.tsx` (badge classes `rented` /
  `override` / `pending` mapped by category and by status), for visual consistency with
  the rest of the app rather than inventing a new color set.

## Portfolio "Maintenance & Works" panel

`src/pages/PortfolioPage.tsx`'s existing panel (built from `capex` only, ~line 2081)
merges in `maintenanceEvents` alongside `capex`:

- `maintenanceItems` useMemo pushes both `capex` and `maintenanceEvents` entries
  (filtered to the current calendar year, same as today), each tagged with
  `source: 'capex' | 'maintenance'` in addition to the existing `propertyId`/
  `propertyName` tags.
- `CapexTodoCard` needs no changes — it only reads `desc`/`cat`/`amount`/`status`/
  `propertyName`, all of which `MaintenanceEvent` already has by construction.
- New `handleMaintenanceStatus(propertyId, id, next)` handler (mirrors
  `handleCapexStatus`), writing to `p.maintenanceEvents` instead of `p.capex`.
- The three `onStatusChange` call sites branch on `c.source` to call the matching
  handler.
- Counts, scorecards, and empty states (`mTodo`/`mOngoing`/`mCompleted`,
  `totalOngoingAmt`) require no changes — they derive from the merged array.

## Out of scope

- No changes to `OpexCapexTab.tsx`'s CapEx log/table itself, or to `CashflowTab.tsx`'s
  KPI cards (only the P&L waterfall gained a reconciliation row — see "Reconciliation"
  above).
- No proration of an event's amount across its `dateEnd` — full amount hits the start
  month only.
- No seed data changes.
