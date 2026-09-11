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
      "margin": 70.83
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
    "displayCurrencyNote": "All monetary values are converted to the display currency using embedded FX rates.",
    "fxRatesUpdatedAt": "2026-03-25",
    "computedWith": "Same logic as PortfolioPage (calcAnnual, calcPortfolioTotalsIn)"
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
| `currency` | Property's functional currency |
| `area` | Area in square meters |
| `bedrooms`, `bathrooms`, `parking`, `storageUnits`, `floors` | Property attributes |
| `latitude`, `longitude` | Geo coordinates (if available) |
| `status` | `Leased`, `Vacant`, or `Occupied` |
| `occupancy` | Detailed occupancy label |
| `monthsLeft` | Months remaining on active lease (null if no lease) |
| `gpi` | Gross Potential Income — full-year potential rent |
| `vacancy` | Vacancy loss (GPI - EGI) |
| `egi` | Effective Gross Income — actual rent collected |
| `opex` | Total operating expenses |
| `noi` | Net Operating Income (EGI - OpEx) |
| `capex` | Capital expenditures for the year |
| `taxes` | Property taxes |
| `net` | Net cash flow (NOI - CapEx - Taxes - One-time payments) |
| `netAmortized` | Net CF using amortized CapEx (book view) |
| `estValue` | Estimated property value |
| `capRate` | Capitalization rate (NOI / Value × 100) |
| `vacancyMoRate` | Vacancy month rate (% of months with vacancy) |
| `margin` | Net CF / GPI × 100 |

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
