# PropTracker Agent API

A read-only API that exposes portfolio data for external agents like Grok Bot.

## Overview

The Agent API allows authenticated external services to fetch a user's complete portfolio data, including:

- All properties with identity and metadata
- Annual financial KPIs (GPI, EGI, NOI, OpEx, CapEx, taxes, net cash flow)
- Portfolio totals aggregated in a display currency
- Occupancy status and lease information

## Authentication

### API Key Generation

1. Log in to PropTracker
2. Click your avatar/account menu in the header
3. Select **Connect Grok Bot**
4. Click **Generate Key** to create a new API key
5. **Copy the key immediately** — it's shown only once
6. Store it securely (e.g., in Grok Bot's secrets)

### API Key Management

- **Rotate**: Generates a new key, invalidating the previous one
- **Revoke**: Removes access entirely; no key is active

### Using the API Key

Include the key in one of these headers:

```
Authorization: Bearer <your-api-key>
```

or

```
X-Agent-Key: <your-api-key>
```

## Endpoint

### GET /api/agent-portfolio

Returns the authenticated user's portfolio properties and summary KPIs.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `year` | number | Current year | The fiscal year for KPI calculations |
| `currency` | string | `USD` | Display currency for all monetary values. Supported: `USD`, `EUR`, `GBP`, `CHF`, `COP`, `PEN` |

#### Example Request

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-app.vercel.app/api/agent-portfolio?year=2026&currency=USD"
```

#### Response Shape

```json
{
  "uid": "user-firebase-uid",
  "email": "user@example.com",
  "asOf": "2026-09-11T17:30:00.000Z",
  "year": 2026,
  "currency": "USD",
  "properties": [
    {
      "id": "property-id",
      "name": "Apto 101",
      "address": "Calle 123 #45-67",
      "neighbourhood": "Centro",
      "city": "Bogotá",
      "country": "Colombia",
      "owner": "John Doe",
      "equityPct": 100,
      "currency": "COP",
      "area": 72,
      "bedrooms": 2,
      "bathrooms": 1,
      "parking": 1,
      "storageUnits": 0,
      "floors": 1,
      "latitude": 4.6097,
      "longitude": -74.0817,
      "status": "Leased",
      "occupancy": "Leased",
      "monthsLeft": 8,
      "leaseStart": "2024-06-01",
      "leaseEnd": "2027-05-31",
      "tenant": "María García",
      "monthlyRent": 1200.00,
      "contractStatus": "active",
      "year": 2026,
      "gpi": 14400.00,
      "vacancy": 0.00,
      "egi": 14400.00,
      "opex": 2800.00,
      "noi": 11600.00,
      "capex": 0.00,
      "taxes": 1400.00,
      "net": 10200.00,
      "netAmortized": 10200.00,
      "estValue": 185000.00,
      "capRate": 6.27,
      "vacancyMoRate": 0,
      "margin": 70.83,
      "taxItems": [
        {
          "propertyId": "1",
          "taxId": "CL 78 5 32 - AP 102",
          "type": null,
          "year": 2026,
          "amount": 1400.00,
          "amountPaid": null,
          "currency": "USD",
          "dueDate": "2026-03-31",
          "paidDate": null,
          "status": "paid",
          "chip": null,
          "label": null
        }
      ],
      "services": [
        {
          "propertyId": "1",
          "serviceId": "1694023456789",
          "provider": "ETB",
          "type": "Internet",
          "accountNumber": "12634590",
          "monthlyCost": 45.00,
          "annualCost": 540.00,
          "currency": "USD",
          "year": 2026,
          "notes": "Fibra 300 Mbps"
        }
      ],
      "capexItems": [
        {
          "propertyId": "1",
          "capexId": "1694023456800",
          "desc": "Kitchen renovation",
          "provider": "ABC Contractors",
          "cat": "Improvement",
          "date": "2025-06-15",
          "dateEnd": "2025-08-01",
          "amount": 15000.00,
          "treatment": "capitalize",
          "amortizeBasis": "contract",
          "amortizeMonths": null,
          "contractId": "1",
          "yearDepreciation": 5000.00,
          "currency": "USD",
          "year": 2026,
          "status": "Completed",
          "recurring": false
        }
      ]
    }
  ],
  "totals": {
    "gpi": 42000.00,
    "egi": 40000.00,
    "opex": 8500.00,
    "noi": 31500.00,
    "capex": 4200.00,
    "taxes": 4600.00,
    "net": 22700.00,
    "netAmortized": 23500.00,
    "propertyCount": 3
  },
  "meta": {
    "displayCurrencyNote": "All monetary values are converted to the display currency using live FX rates.",
    "fxSource": "live",
    "fxRatesUpdatedAt": "2026-09-12",
    "fxRateCopPerUsd": 3105.8,
    "fxNote": "Live rates from exchangerate-api.com",
    "computedWith": "Same logic as PortfolioPage (calcAnnual, calcPortfolioTotalsIn)",
    "taxItemsNote": "Per-property taxes and totals.taxes equal sum of taxItems[].amount (impuesto a cargo). Fields type, amountPaid, paidDate, chip, and label are not yet stored in the data model and return null.",
    "servicesNote": "services[] exposes recurring service/utility accounts. annualCost = monthlyCost × 12. opex is computed from actual monthly expense entries + maintenance events — it does NOT equal sum of services[].annualCost. Services act as metadata; actual monthly OpEx may differ. When services are inherited from another year (no entries for requested year), resolvedFromYear indicates the source year.",
    "capexItemsNote": "capexItems[] exposes CapEx line items with depreciation. yearDepreciation is the amount landing in the requested year: for capitalize treatment, sum of 12 months of straight-line depreciation; for expense treatment, full amount if dated in the year. Sum of yearDepreciation should reconcile to property netAmortized capex component. amount is the original cash outlay."
  }
}
```

#### Property Fields

| Field | Description |
|-------|-------------|
| `id` | Unique property identifier |
| `name` | Property name |
| `address`, `neighbourhood`, `city`, `country` | Location details |
| `owner` | Property owner name |
| `equityPct` | Owner's equity share (ownership %) — resolves from `prop.equityPct` or primary `factSheet.owners[].equityPct` |
| `currency` | Property's functional currency |
| `area` | Area in square meters |
| `bedrooms`, `bathrooms`, `parking`, `storageUnits`, `floors` | Property attributes |
| `latitude`, `longitude` | Geo coordinates (if available) |
| `status` | `Leased`, `Vacant`, or `Occupied` |
| `occupancy` | Detailed occupancy label |
| `monthsLeft` | Months remaining on active lease (null if no lease) |
| `leaseStart` | Active lease start date (ISO date string, null if no active lease) |
| `leaseEnd` | Active lease end date (ISO date string, null if no active lease) |
| `tenant` | Tenant name from active lease (null if no active lease or empty) |
| `monthlyRent` | Monthly rent from active lease, converted to display currency (null if no active lease) |
| `contractStatus` | Active lease contract status (`active`, null if no lease) |
| `gpi` | Gross Potential Income — full-year potential rent |
| `vacancy` | Vacancy loss (GPI - EGI) |
| `egi` | Effective Gross Income — actual rent collected |
| `opex` | Total operating expenses |
| `noi` | Net Operating Income (EGI - OpEx) |
| `capex` | Capital expenditures for the year |
| `taxes` | Property taxes (sum of taxItems amounts — see Tax Line Items) |
| `net` | Net cash flow (NOI - CapEx - Taxes - One-time payments) |
| `taxItems` | Array of tax line items for the requested year (see below) |
| `services` | Array of recurring service/utility line items (see Services Line Items) |
| `capexItems` | Array of CapEx / depreciation line items (see CapEx Line Items) |
| `netAmortized` | Net CF using amortized CapEx (book view) |
| `estValue` | Estimated property value |
| `capRate` | Capitalization rate (NOI / Value × 100) |
| `vacancyMoRate` | Vacancy month rate (% of months with vacancy) |
| `margin` | Net CF / GPI × 100 |

#### Active Lease Fields

Each property includes fields from its **active** lease contract (the same contract used to compute `monthsLeft` and `status`). These fields are `null` when the property has no active lease.

**Field Mapping from Data Model (Contract):**

| API Field | Source | Notes |
|-----------|--------|-------|
| `leaseStart` | `Contract.startDate` | ISO date string (e.g. `"2024-06-01"`) |
| `leaseEnd` | `Contract.endDate` | ISO date string; same value used to compute `monthsLeft` |
| `tenant` | `Contract.tenant` | Tenant name; `null` if empty or no active lease |
| `monthlyRent` | `Contract.monthlyRent` | Converted to display currency (via `?currency=` param) |
| `contractStatus` | `Contract.status` | Always `"active"` for active contracts; `null` if no lease |

**Example property with active lease:**

```json
{
  "id": "property-id",
  "name": "Apto 101",
  "status": "Leased",
  "monthsLeft": 8,
  "leaseStart": "2024-06-01",
  "leaseEnd": "2027-05-31",
  "tenant": "María García",
  "monthlyRent": 1200.00,
  "contractStatus": "active"
}
```

**Example property without active lease:**

```json
{
  "id": "property-id",
  "name": "Casa Verde",
  "status": "Vacant",
  "monthsLeft": null,
  "leaseStart": null,
  "leaseEnd": null,
  "tenant": null,
  "monthlyRent": null,
  "contractStatus": null
}
```

**Notes:**
- The active contract is determined by the `activeContract()` helper, which finds the contract with `status: 'active'` covering the current date.
- `monthlyRent` is converted to the display currency using the same FX rates as other monetary fields.
- Full contract arrays are not exposed in v1 to maintain privacy and limit response size.

#### Portfolio Totals

Aggregated values across all properties, converted to the display currency:

| Field | Description |
|-------|-------------|
| `gpi` | Sum of all properties' GPI |
| `egi` | Sum of all properties' EGI |
| `opex` | Total operating expenses |
| `noi` | Total NOI |
| `capex` | Total CapEx |
| `taxes` | Total taxes |
| `net` | Total net cash flow |
| `netAmortized` | Total net CF (amortized) |
| `propertyCount` | Number of properties |

#### Tax Line Items

Each property includes a `taxItems` array with individual tax line items for the requested year (filtered by `dueDate` year when available).

**Example taxItems array:**

```json
{
  "taxItems": [
    {
      "propertyId": "1",
      "taxId": "CL 78 5 32 - AP 102",
      "type": null,
      "year": 2026,
      "amount": 815.42,
      "amountPaid": null,
      "currency": "USD",
      "dueDate": "2026-03-31",
      "paidDate": null,
      "status": "paid",
      "chip": null,
      "label": null
    },
    {
      "propertyId": "1",
      "taxId": "CL 78 5 32 - PARK 1",
      "type": null,
      "year": 2026,
      "amount": 112.50,
      "amountPaid": null,
      "currency": "USD",
      "dueDate": "2026-03-31",
      "paidDate": null,
      "status": "pending",
      "chip": null,
      "label": null
    }
  ]
}
```

**Example curl with tax items:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-app.vercel.app/api/agent-portfolio?year=2026&currency=COP"
```

**Tax Item Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `propertyId` | string | Property ID this tax item belongs to |
| `taxId` | string | Stable identifier (from data or derived from item id) |
| `type` | null | Tax type (e.g. "predial") — *not yet stored* |
| `year` | number | Tax year (from dueDate or query parameter) |
| `amount` | number \| null | Impuesto a cargo (tax liability), converted to display currency |
| `amountPaid` | null | Amount paid — *not yet stored* |
| `currency` | string | Display currency (matches query parameter) |
| `dueDate` | string \| null | ISO date when tax is due |
| `paidDate` | null | Payment date — *not yet stored* |
| `status` | string | `paid`, `pending`, or `unknown` |
| `chip` | null | Catastro CHIP code — *not yet stored per-item* |
| `label` | null | Free-text notes — *not yet stored* |

**Field Mapping from Data Model (TaxItem):**

| API Field | Source | Notes |
|-----------|--------|-------|
| `propertyId` | `property.id` | Converted to string |
| `taxId` | `TaxItem.taxId` | Falls back to `String(TaxItem.id)` if empty |
| `type` | — | Not in data model, returns null |
| `year` | `TaxItem.dueDate` | Extracted from dueDate; falls back to query year |
| `amount` | `TaxItem.amount` | Converted to display currency |
| `amountPaid` | — | Not in data model, returns null |
| `dueDate` | `TaxItem.dueDate` | ISO date string |
| `paidDate` | — | Not in data model, returns null |
| `status` | `TaxItem.status` | `paid` or `pending`; defaults to `unknown` |
| `chip` | — | Not stored per-item (factSheet.chip exists at property level) |
| `label` | — | Not in data model, returns null |

**Tax Totals Note:**

The per-property `taxes` field and `totals.taxes` equal the sum of `taxItems[].amount` (impuesto a cargo — tax liability amounts), **not** `amountPaid`. This matches the behavior in PortfolioPage's `calcAnnual()` which sums `prop.taxes.items[].amount`.

**Year Filtering:**

Tax items are filtered by the `?year=` query parameter:
- Items with a `dueDate` are included only if the dueDate's year matches the requested year
- Items without a `dueDate` are always included (year is unknown)

#### Services Line Items

Each property includes a `services` array with recurring service/utility accounts. Services use the same year-scoping behavior as the UI: if no services exist for the requested year, they are inherited from the nearest year with service entries.

**Example services array:**

```json
{
  "services": [
    {
      "propertyId": "1",
      "serviceId": "1694023456789",
      "provider": "ETB",
      "type": "Internet",
      "accountNumber": "12634590",
      "monthlyCost": 45.00,
      "annualCost": 540.00,
      "currency": "USD",
      "year": 2026,
      "notes": "Fibra 300 Mbps"
    },
    {
      "propertyId": "1",
      "serviceId": "1694023456790",
      "provider": "EPM",
      "type": "Electricity",
      "accountNumber": null,
      "monthlyCost": 85.00,
      "annualCost": 1020.00,
      "currency": "USD",
      "year": 2026,
      "notes": null,
      "resolvedFromYear": 2025
    }
  ]
}
```

**Example curl with services:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-app.vercel.app/api/agent-portfolio?year=2026&currency=USD"
```

**Service Item Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `propertyId` | string | Property ID this service belongs to |
| `serviceId` | string | Stable identifier (from `ServiceEntry.id`) |
| `provider` | string | Service provider name (e.g. "ETB", "EPM") |
| `type` | string | Service category (e.g. "Internet", "Electricity", "Water", "Admin") |
| `accountNumber` | string \| null | Account number, null if empty |
| `monthlyCost` | number | Monthly cost, converted to display currency |
| `annualCost` | number | Annual cost (`monthlyCost × 12`), converted to display currency |
| `currency` | string | Display currency (matches query parameter) |
| `year` | number | Requested year |
| `notes` | string \| null | Free-text notes, null if empty |
| `resolvedFromYear` | number \| undefined | Present only when services are inherited from a different year |

**Field Mapping from Data Model (ServiceEntry):**

| API Field | Source | Notes |
|-----------|--------|-------|
| `propertyId` | `property.id` | Converted to string |
| `serviceId` | `ServiceEntry.id` | Converted to string |
| `provider` | `ServiceEntry.provider` | Provider/company name |
| `type` | `ServiceEntry.type` | Category as stored |
| `accountNumber` | `ServiceEntry.accountNumber` | Null if empty |
| `monthlyCost` | `ServiceEntry.monthlyCost` | Converted to display currency |
| `annualCost` | `ServiceEntry.monthlyCost × 12` | Simple annualization |
| `notes` | `ServiceEntry.notes` | Null if empty |
| `resolvedFromYear` | — | Computed: present when services inherited from another year |

**Services vs OpEx Note:**

The `services[]` array exposes recurring service/utility account metadata. **Important**: the per-property `opex` field is computed from actual monthly expense entries plus maintenance events — it does **NOT** equal the sum of `services[].annualCost`. Services act as templates/metadata; actual monthly OpEx may differ based on manual expense entries in each month.

**Year Resolution:**

Services use the same inheritance behavior as the ServicesTab UI:
1. If the property has services for the requested year, those are returned
2. Otherwise, services are inherited from the nearest year with entries
3. When inherited, the `resolvedFromYear` field indicates the source year
4. If no services exist at all, `services` is an empty array

#### CapEx Line Items

Each property includes a `capexItems` array with capital expenditure details and depreciation for the requested year.

**Example capexItems array:**

```json
{
  "capexItems": [
    {
      "propertyId": "1",
      "capexId": "1694023456800",
      "desc": "Kitchen renovation",
      "provider": "ABC Contractors",
      "cat": "Improvement",
      "date": "2025-06-15",
      "dateEnd": "2025-08-01",
      "amount": 15000.00,
      "treatment": "capitalize",
      "amortizeBasis": "contract",
      "amortizeMonths": null,
      "contractId": "1",
      "yearDepreciation": 5000.00,
      "currency": "USD",
      "year": 2026,
      "status": "Completed",
      "recurring": false
    },
    {
      "propertyId": "1",
      "capexId": "1694023456801",
      "desc": "Emergency plumbing repair",
      "provider": null,
      "cat": "Repair",
      "date": "2026-03-10",
      "dateEnd": null,
      "amount": 800.00,
      "treatment": "expense",
      "amortizeBasis": null,
      "amortizeMonths": null,
      "contractId": null,
      "yearDepreciation": 800.00,
      "currency": "USD",
      "year": 2026,
      "status": "Completed",
      "recurring": false
    }
  ]
}
```

**Example curl with capexItems:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-app.vercel.app/api/agent-portfolio?year=2026&currency=USD"
```

**CapEx Item Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `propertyId` | string | Property ID this item belongs to |
| `capexId` | string | Stable identifier from `CapexItem.id` |
| `desc` | string | Description of the capital expenditure |
| `provider` | string \| null | Service provider / contractor name |
| `cat` | string | Category: `Improvement`, `Equipment`, `Repair`, or `Other` |
| `date` | string \| null | Start date (ISO date string) |
| `dateEnd` | string \| null | End date if multi-day project |
| `amount` | number | Original cash outlay, converted to display currency |
| `treatment` | string | `capitalize` (depreciate) or `expense` (immediate) |
| `amortizeBasis` | string \| null | `manual` or `contract` (only when treatment = capitalize) |
| `amortizeMonths` | number \| null | Manual depreciation months (only when amortizeBasis = manual) |
| `contractId` | string \| null | Linked contract ID (only when amortizeBasis = contract) |
| `yearDepreciation` | number | Depreciation/expense landing in requested year (see below) |
| `currency` | string | Display currency |
| `year` | number | Requested year |
| `status` | string \| null | `To do`, `Ongoing`, or `Completed` |
| `recurring` | boolean | Whether this is a recurring capital reserve item |

**Field Mapping from Data Model (CapexItem):**

| API Field | Source | Notes |
|-----------|--------|-------|
| `propertyId` | `property.id` | Converted to string |
| `capexId` | `CapexItem.id` | Converted to string |
| `desc` | `CapexItem.desc` | Description |
| `provider` | `CapexItem.provider` | Null if empty |
| `cat` | `CapexItem.cat` | Category |
| `date` | `CapexItem.date` | ISO date string |
| `dateEnd` | `CapexItem.dateEnd` | Null if not set |
| `amount` | `CapexItem.amount` | Converted to display currency |
| `treatment` | `CapexItem.treatment` | Defaults to `expense` if unset |
| `amortizeBasis` | `CapexItem.amortizeBasis` | Only for capitalized items |
| `amortizeMonths` | `CapexItem.amortizeMonths` | Only for manual basis |
| `contractId` | `CapexItem.contractId` | Only for contract basis |
| `yearDepreciation` | computed | See depreciation logic below |
| `status` | `CapexItem.status` | Null if not set |
| `recurring` | `CapexItem.recurring` | Defaults to false |

**yearDepreciation Calculation:**

The `yearDepreciation` field represents the amount of this CapEx item that lands in the requested year:

- **`treatment = capitalize`**: Sum of 12 months of straight-line depreciation for the year. Monthly depreciation = `amount / totalMonths`. For `amortizeBasis = manual`, totalMonths comes from `amortizeMonths`. For `amortizeBasis = contract`, totalMonths is computed from the linked contract's duration.

- **`treatment = expense`** (or unset): Full `amount` if the item's `date` falls within the requested year; otherwise 0.

**Reconciliation Note:**

The sum of `capexItems[].yearDepreciation` across all items for a property should equal the amortized CapEx component used to compute `netAmortized`. The aggregate `capex` field is the cash-basis total (items dated in the year), while `netAmortized` uses the depreciation/amortization view.

## FX Rates

The API fetches live exchange rates from [exchangerate-api.com](https://www.exchangerate-api.com) for currency conversions. This ensures accurate translations when requesting data in a different currency (e.g., `?currency=USD` for COP-denominated properties).

### Behavior

1. **Default (live)**: Fetches current rates from exchangerate-api.com
2. **Fallback**: On fetch failure, uses embedded fallback rates (dated 2026-03-25)
3. **Caching**: Rates are cached in-memory for ~1 hour per serverless instance

### Meta Fields

The response `meta` object includes FX rate information:

| Field | Description |
|-------|-------------|
| `fxSource` | `"live"` if rates were fetched successfully; `"fallback"` if using embedded rates |
| `fxRatesUpdatedAt` | ISO date of the FX rates (from API or fallback) |
| `fxRateCopPerUsd` | COP per 1 USD rate (useful for agents working with Colombian properties) |
| `fxNote` | Human-readable status message |

### Example (live rates)

```json
{
  "meta": {
    "fxSource": "live",
    "fxRatesUpdatedAt": "2026-09-12",
    "fxRateCopPerUsd": 3105.8,
    "fxNote": "Live rates from exchangerate-api.com"
  }
}
```

### Example (fallback rates)

```json
{
  "meta": {
    "fxSource": "fallback",
    "fxRatesUpdatedAt": "2026-03-25",
    "fxRateCopPerUsd": 4255,
    "fxNote": "Fallback to embedded rates (fetch failed: Network error)"
  }
}
```

### Verifying FX Rate Status

```bash
# Check that live rates are being used
curl -H "Authorization: Bearer YOUR_KEY" \
  "https://your-app.vercel.app/api/agent-portfolio?currency=USD" \
  | jq '.meta | {fxSource, fxRatesUpdatedAt, fxRateCopPerUsd}'

# Compare COP vs USD requests (COP totals should be identical)
curl -H "Authorization: Bearer YOUR_KEY" \
  "https://your-app.vercel.app/api/agent-portfolio?currency=COP" | jq '.totals'
curl -H "Authorization: Bearer YOUR_KEY" \
  "https://your-app.vercel.app/api/agent-portfolio?currency=USD" | jq '.totals'
```

### Future Enhancements

- Firestore-based manual FX rate overrides (for admin control)
- Frontend live FX fetch in `currency.ts`

## Error Responses

| Status | Description |
|--------|-------------|
| `401` | Missing or invalid API key |
| `405` | Method not allowed (only GET is supported) |
| `500` | Server error |

```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

## Environment Setup (Vercel)

### Required Environment Variables

Add these to your Vercel project settings:

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON string of your Firebase service account credentials |

### Getting Firebase Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate new private key**
5. Download the JSON file
6. Copy the entire JSON content as a single string
7. Paste it as the value for `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel

**Important**: Never expose this JSON in client-side code or commit it to git.

## Security Notes

- API keys are stored as SHA-256 hashes — the raw key is never persisted
- The API is read-only; no mutations are possible
- Keys can be rotated or revoked at any time through the UI
- CORS is enabled for cross-origin requests

## Testing Locally

For local development, you can test the API with curl:

```bash
# After generating a key in the UI
curl -H "Authorization: Bearer YOUR_KEY" \
  "http://localhost:5173/api/agent-portfolio"
```

Note: Local testing requires the Vite dev server to proxy `/api` routes or a separate API server setup.
