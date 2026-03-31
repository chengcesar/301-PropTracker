# PropTracker — Project Context

## What Is This?

PropTracker is a **simple real estate portfolio tracker** built out of personal necessity. It was born from the frustration of not having a lightweight, no-nonsense tool to keep track of a private real estate portfolio — so one was built.

It is **not** aimed at real estate professionals or institutional investors. It is aimed at individuals who own a handful of rental or investment properties and need a clean, centralized place to log the data that matters: rent, contracts, expenses, valuation, and key metrics.

The name says it all: **Simple Portfolio Tracking.**

---

## Why It Exists

Existing tools are either too complex (built for professionals), too generic (spreadsheets with no structure), or don't support multi-currency / international portfolios well. This app was created to fill the gap for the ordinary property owner who wants:

- A clean record of their properties and tenants
- To understand if their portfolio is performing well without needing a finance degree
- A place to log the data *now* so it can be analyzed *later*

The foundational goal is to **build a clean, structured dataset** of the portfolio. Analysis tools come on top of that data — but without the data, there's nothing to analyze.

---

## Current Feature Set

### Portfolio Dashboard
- Multi-property view with key KPIs per property (GPI, NOI, cap rate, occupancy)
- Portfolio-level aggregates (total value, total rental income, vacancy)
- Map view with property leaderboard (geo pins + ranked list)
- Multi-currency support with FX conversion
- Filters by country, city, occupancy status, year
- Export to CSV / spreadsheet
- Asset value appreciation card (portfolio-level estimated value over time)

### Per-Property Detail (tabs)
| Tab | What it tracks |
|-----|----------------|
| **Overview** | Monthly income/expense grid, occupancy calendar, annual KPIs (GPI, EGI, NOI, cap rate, vacancy loss) |
| **Contracts** | Tenant contracts with start/end dates, rent, deposit, payment day, increment type (IPC, fixed, etc.) |
| **Cashflow** | Monthly cash in/out, income overrides, rent received confirmation |
| **OPEX / CAPEX** | Operating expenses by category + capital expenditure items (improvements, equipment, repairs) |
| **Taxes** | Tax line items with due dates and paid/pending status |
| **Services** | Recurring service providers (utilities, maintenance) with monthly cost |
| **Value & Equity** | Property value history, mortgage info, equity, amortization, projected appreciation |
| **Fact Sheet** | Static property data: type, size, bedrooms, purchase price/date, legal IDs, photos, documents, ownership structure, contacts |

### Data Model Highlights
- Each property has a full **contract history** (active / archived / draft)
- Monthly data grid: every month can have a status (rented/vacant), income override, expense entries, and a rent-received flag
- CAPEX items are dated and categorized separately from OPEX
- Mortgage tracking: lender, outstanding balance, rate, term, down payment
- Ownership entries: multiple owners with equity % (useful for shared properties)
- **Non-lease occupancy**: owner-occupied, family use, caretaker — tracked separately from rental contracts

---

## Core Philosophy

1. **Simple over powerful** — if a metric needs a finance textbook to understand, it should come with a plain-language explanation
2. **Data first** — the primary job is to make it easy to log the right data; analysis tools are built on top of that foundation
3. **Not for professionals** — designed for property owners managing their own portfolio, not agents or asset managers
4. **International-friendly** — multi-currency, multi-country, supports non-US rental market conventions (e.g. IPC rent increments, Colombian property IDs)
5. **No lock-in** — data stays local (localStorage) or in the user's own Firebase; CSV export always available

---

## Key Metrics the App Tracks

| Metric | Description |
|--------|-------------|
| **GPI** | Gross Potential Income — what the property *could* earn if fully rented |
| **EGI** | Effective Gross Income — actual income after vacancy loss |
| **NOI** | Net Operating Income — EGI minus operating expenses |
| **Cap Rate** | NOI / Property Value — the core yield metric |
| **Vacancy Loss** | Months × rent lost to vacancy |
| **Equity** | Property Value − Outstanding Mortgage |
| **IRR** | Internal rate of return (portfolio-level) |

---

## Future Direction

The roadmap is to layer **analysis tools** on top of the existing data foundation. Key ideas:

- **Portfolio health dashboard** — at-a-glance signals: which properties underperform, which contracts are expiring soon, where vacancy is concentrated
- **Rent increment forecasting** — project future rent based on IPC / CPI + contractual increments
- **Cashflow projection** — multi-year cashflow model per property and portfolio
- **Funding ratio tool** — debt coverage, LTV, portfolio leverage metrics
- **Comparative analysis** — benchmark properties against each other within the portfolio
- **AI-assisted insights** — natural language summaries of portfolio performance, anomaly detection, suggested actions
- **Alert rules** — notify when a contract is expiring, a tax is due, vacancy exceeds a threshold
- **Document vault** — attach contracts, title deeds, invoices to the property record

The guiding constraint for all new features: **keep it simple enough that a non-professional property owner can understand and use it without guidance.**

---

## Tech Stack (brief)

- React 19 + React Router v7 + Vite
- Tailwind CSS 4 + custom hand-crafted CSS design system
- Firebase (auth + Firestore) for multi-device sync
- Chart.js + Recharts for data visualization
- Anthropic SDK for AI analysis features
- All data can run fully client-side (localStorage fallback)
