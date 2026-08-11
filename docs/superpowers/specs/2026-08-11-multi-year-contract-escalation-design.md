# Multi-year contract escalation & "Full contract" timeline

Date: 2026-08-11
Status: Approved (design), not yet implemented

## Problem

`Contract.increment` / `Contract.ipcExtra` are stored today but never actually
change rent over time — `monthlyRent` is a single flat number used everywhere
income is computed. For multi-year contracts (e.g. a 10-year lease with an
annual CPI-linked increase) this means:

- Projected income for future years is wrong (flat instead of escalating)
- The "Active contract" summary on the Overview tab has no way to show how
  rent evolves year to year
- There's no way to override a given year's increment when the real CPI
  differs from an estimate

This spec adds a real per-contract-year escalation engine, wires it into
every place actual rent is read, and adds a new "Full contract" multi-year
timeline view (based on user-provided mockups) alongside the existing
single-year coverage bar.

## A. Data model & escalation engine

### New `Contract` fields ([src/lib/types.ts](../../../src/lib/types.ts))

```ts
fixedPct: number          // annual % used when increment === 'fixed'
cpiEstimatePct: number    // estimated CPI % used as the base for 'ipc' and 'ipc+'
yearOverrides?: Record<number, number>  // contract-year index (1-based) -> increment % override
```

`ipcExtra` keeps its existing meaning (the extra % on top of CPI for `'ipc+'`);
only its form label changes ("Fixed extra %").

### Contract-year anchoring

Contract-years are counted from `startDate`'s anniversary, not calendar
Jan 1. A contract starting 2020-07-01 has Year 1 = Jul 2020–Jun 2021,
Year 2 = Jul 2021–Jun 2022, etc. This is what produces the mid-calendar-year
color split in the mockup, and is the anchor for `yearOverrides` keys.

### New functions in [src/lib/finance.ts](../../../src/lib/finance.ts)

- `contractYearIndex(contract, date): number` — 1-based contract-year containing `date`
- `contractYearBounds(contract, yearIndex): { start: Date; end: Date }` — clamped to the contract's actual start/end
- `effectiveIncrementPct(contract, yearIndex): number` — `yearOverrides[yearIndex]` if present, else derived from `increment`:
  - `'fixed'` → `fixedPct`
  - `'ipc'` → `cpiEstimatePct`
  - `'ipc+'` → `cpiEstimatePct + ipcExtra`
  - `'none'` → `0`
- `rentForContractYear(contract, yearIndex): number` — compounds forward from `monthlyRent`: Year 1 = `monthlyRent`; Year N = Year(N-1) × (1 + effectiveIncrementPct(N)/100). An override on year N changes N and compounds into every later year; earlier years are never rewritten.
- `rentOnDate(contract, date): number` — resolves `contractYearIndex(contract, date)` and returns `rentForContractYear` for it. **This is the new source of truth for "what does this contract pay on this date."**

### Migration behavior (explicit decision)

Existing contracts (including seed data) get `fixedPct: 0`, `cpiEstimatePct: 0`,
no `yearOverrides`, applied immediately (no freeze/opt-in step). For existing
`'ipc+'` contracts this means they start compounding by `ipcExtra`% per year
right away (CPI estimate defaults to 0 since no such value was ever captured
before this feature). This was a deliberate choice — accepted risk that some
projected numbers shift on deploy, in exchange for not needing a migration
flag or a "re-save to activate" step.

## B. "Active contract" widget UI

Replaces the plain summary table currently in
[src/components/property/OverviewTab.tsx](../../../src/components/property/OverviewTab.tsx)
(lines ~317-349) and relocates the existing month-coverage bar from
[src/components/property/ContractsTab.tsx](../../../src/components/property/ContractsTab.tsx)
(lines ~70-94) into it as one of two toggle states. The "Contract history"
timeline lower in `ContractsTab.tsx` is unchanged.

**Header:** `ACTIVE CONTRACT` + existing `+ New contract` button, plus a
summary line: date range, `Active` badge, duration in years (computed as
exact elapsed time, matching how the Contract History card already computes
"Total years"/"Total months" — the mockup's top badge showed a rounding
inconsistency vs. its own history card; this spec always uses the exact,
consistent calculation), and total contract value (sum of
`rentForContractYear(y) × 12` across all contract-years).

**Toggle (top-right):** `[current year]` | `Full contract`, defaulting to
current year.

- **Current-year state:** unchanged from today's Coverage bar — Jan–Dec
  strip, "Covered / No contract" legend, "X/12 months covered" — just moved
  here from the top of the Contracts tab.
- **Full contract state (new):** one row per calendar year the contract
  touches, from `startDate`'s year to `endDate`'s year inclusive:
  - Row label: `{calendarYear}  Year {N}`, where
    `N = contractYearIndex(contract, min(Dec 31 of that year, contract.endDate))`
  - 12-segment month bar. Months outside `[startDate, endDate]` render blank
    (existing no-contract grey style). Months inside render in two tones
    split at the anniversary month within that calendar year: the earlier
    segment shows the earlier contract-year's rent, the later segment shows
    the later contract-year's rent (segments look identical when that
    year's increment is 0%, as in the reference screenshot).
  - Row styling: past calendar years muted/grey, current calendar year gets
    a green highlight border, future calendar years get a purple border.
  - Right side: `Increment %` input seeded with `effectiveIncrementPct` for
    the row's later contract-year (the one in the row label), a
    `+X% default` hint showing what the type-based calculation would give
    absent an override, and `= $(rentForContractYear × 12) / yr`. Editing
    writes to `yearOverrides[N]` and immediately recomputes that year and
    every later row/total.
  - All rows are editable, including past years (lets a user correct an
    estimate to match realized CPI after the fact).

## C. Contract form changes

[src/components/modals/ContractForm.tsx](../../../src/components/modals/ContractForm.tsx),
`ContractFormState`, `NewContractModal.tsx`, `EditContractModal.tsx` all gain
`fixedPct`/`cpiEstimatePct` in form state and save paths (same pattern as
existing `ipcExtra` plumbing).

Annual increment field behavior:

| `increment` | Inputs shown |
|---|---|
| `'fixed'` | **Fixed %** (`fixedPct`) — currently shows nothing; this is new |
| `'ipc'` (CPI only) | **CPI (estimate) %** (`cpiEstimatePct`) — new |
| `'ipc+'` (CPI + %) | **CPI (estimate) %** (`cpiEstimatePct`) and **Fixed extra %** (`ipcExtra`, relabeled from "% over IPC") |
| `'none'` | nothing, as today |

Terminology note: the reference mockups use "CPI" in the UI; the existing
app and `INCREMENT_OPTS` labels use "IPC" (Índice de Precios al Consumidor).
This spec keeps the existing "IPC" terminology for consistency with the rest
of the app rather than introducing a second term — field *names* in code use
`cpi*` since that's the more universally-understood identifier, but
user-facing labels stay "IPC" to match `INCREMENT_OPTS`.

## D. Rent read-sites switching to `rentOnDate`

| File | Line(s) | Change |
|---|---|---|
| `src/lib/finance.ts` | 231, 242, 275 | GPI projection / vacancy-fallback / month-rent helpers resolve escalated rent for the specific month instead of raw `monthlyRent` |
| `src/components/property/OverviewTab.tsx` | 781 (income table), 86 (override comparison) | Per-month base uses escalated rent; override comparison checks against the escalated value |
| `src/pages/PortfolioPage.tsx` | 2042, 2066, 2164 | Portfolio-wide income aggregation and leaderboard active-contract lookup use escalated rent for the relevant month/year |
| `src/components/PropertyLeaderboardMap.tsx` | 234 | Escalated rent for "today" |
| `src/components/modals/MonthModal.tsx` | 37, 118 | Income calc and placeholder reflect that month's escalated rent |

**Left untouched (show the base signed rent intentionally):**
- `ContractsTab.tsx:145` — "Contract history" card shows rent as originally
  signed, not escalated (it's a record of deal terms)
- `AddPropertyModal.tsx`, `NewContractModal.tsx`, `EditContractModal.tsx`
  form inputs — these edit the base `monthlyRent`, unaffected

Existing per-month `incomeOverride` still wins over computed rent everywhere,
exactly as today — only its fallback value changes (escalated rent instead
of flat `monthlyRent`).

## Out of scope

- Fetching real CPI data from an external index — `cpiEstimatePct` is always
  a manually-entered value, matching how `ipcExtra` already works today.
- Changing anything in the `kadana-com/` directory (an untracked, byte-
  identical duplicate of this repo — not the running app).
