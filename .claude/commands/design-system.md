# Design System Skill - Portfolio Tracker App

## Overview

This is a custom-built React financial portfolio tracker. All UI components are hand-crafted with vanilla CSS (no UI framework like Material-UI or Chakra). Styling lives primarily in `src/App.css` (~2600 lines) with Tailwind CSS 4 available for utility classes.

---

## Tech Stack

- **Framework:** React 19 + React Router v7
- **Build:** Vite + @tailwindcss/vite
- **Charts:** Chart.js 4 (via react-chartjs-2) + Recharts 2
- **Auth:** Firebase 12
- **AI:** Anthropic SDK (portfolio analysis)
- **Markdown:** react-markdown + remark-gfm

---

## Project Structure

```
src/
  App.jsx              # Router + route definitions
  App.css              # Master stylesheet (all component styles)
  tailwind.css         # Tailwind theme config (custom fonts)
  config/
    assetTypeConfig.js # Asset type definitions, colors, icons, metadata fields
  components/          # Reusable UI components
    Header.jsx         # Fixed top navbar
    DatePicker.jsx     # Custom calendar picker
    PriceChart.jsx     # Chart.js line chart with gradient fills
    PortfolioTwrChart.tsx      # Recharts time-series performance
    PortfolioInflationChart.tsx # Inflation-adjusted returns
    TransactionForm.jsx        # Buy/sell form
    TransactionTable.jsx       # Scrollable data table
    SymbolAutocomplete.jsx     # Ticker search typeahead
    HoldingLogo.jsx            # Asset thumbnail with initial fallback
    ConfirmDialog.jsx          # Modal confirmation dialog
    CurrencyDropdown.jsx       # Currency selector with flags
    TypeMetadataEditor.jsx     # Dynamic form per asset type
    PortfolioLoadingMessages.jsx
  pages/               # Route-specific page components
    PortfolioPage.jsx  # Main dashboard
    HoldingPage.jsx    # Individual stock/asset detail
    BondDetailPage.jsx # Bond-specific detail
    CdHoldingPage.jsx  # CD-specific detail
    ...
  contexts/
    AuthContext.jsx    # Firebase auth context
  services/            # API integrations (storage, prices, FX, CPI)
  utils/               # Finance calculations, portfolio math
```

---

## Color Palette

### Brand / Action Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Primary blue | `#0539FF` | Logo, active nav states |
| Action blue | `#3b82f6` | Buttons, links, active elements, stock chart fill |
| Action blue hover | `#2563eb` | Button hover states |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Positive / Gain | `#1BC5BD` | Profitable positions, buy markers |
| Negative / Loss | `#b91c1c` | Losses, sell markers |
| Success green | `#22c55e` / `#15803d` | Profit badges, positive changes |
| Warning amber | `#f59e0b` | Benchmark line in charts |
| Error red | `#ef4444` | Alerts, destructive actions |

### Neutral Palette
| Token | Hex | Usage |
|-------|-----|-------|
| Text primary | `#1a1d23` | Headings, primary text |
| Text secondary | `#374151` | Body text |
| Text tertiary | `#6b7280` | Labels, help text |
| Text disabled | `#9ca3af` | Placeholder, disabled |
| Border primary | `#e8ecf2` | Card borders, input borders |
| Border secondary | `#e5e7eb` | Dividers |
| Background light | `#f7f9fc` | Input backgrounds, section fills |
| Background lighter | `#f9fafb` | Subtle backgrounds |
| Background white | `#ffffff` | Cards, page background |

### Asset Type Colors (from `assetTypeConfig.js`)
| Asset Type | Hex | Color Name |
|------------|-----|------------|
| Stocks | `#3b82f6` | Blue |
| Real Estate (equity v2) | `#ec4899` | Pink |
| Cash | `#f59e0b` | Amber |
| Savings account | `#8b5cf6` | Purple |
| Bonds | `#ef4444` | Red |
| Precious metals | `#f97316` | Orange |
| P2P loans | `#06b6d4` | Cyan |
| CD | `#14b8a6` | Teal |
| Simplified Fund | `#6366f1` | Indigo |

---

## Typography

### Font Families
| Font | Stack | Usage |
|------|-------|-------|
| Inter | `'Inter', sans-serif` | Primary body text (weights: 300-700) |
| Averia Serif Libre | `'Averia Serif Libre', serif` | Landing page headings (weights: 300, 400, 700) |
| DM Mono | `'DM Mono', monospace` | Financial figures, data display (weights: 300-500) |
| Fraunces | `'Fraunces', serif` | Report/decorative headers (weights: 300-700) |

Tailwind theme aliases in `tailwind.css`:
```css
--font-heading: 'Fraunces', serif;
--font-data: 'DM Mono', monospace;
```

### Type Scale
| Role | Size | Weight | Extra |
|------|------|--------|-------|
| Page title | 22px | 700 | |
| Section title | 16px | 700 | |
| Fund/holding name | 20px | 700 | |
| Large price display | 36px | 700 | DM Mono font |
| Body text | 14px | 400 | |
| Labels / uppercase | 11-12px | 600 | `text-transform: uppercase; letter-spacing: 0.6-0.8px` |
| Small text | 13px | 500 | |

---

## Layout System

### Page Container
```css
.main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px;
}
```
Header is fixed at 56px height.

### Grid Patterns
- **Summary cards:** `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`
- **Stats row:** `repeat(auto-fit, minmax(100px, 1fr))`
- **Transaction form (mobile):** 2-column grid

### Spacing Scale
Common values: `4px, 6px, 8px, 10px, 12px, 14px, 16px, 20px, 24px, 28px, 32px`

### Responsive Breakpoint
Single breakpoint at **768px** (max-width):
- Stacks layouts vertically
- Summary grid becomes 2 columns
- Tables get horizontal scroll with sticky first column
- Transaction form becomes 2-column grid
- Dropdowns center-fixed on screen
- Hide `.user-email`, show `.user-avatar`
- Hide `.price-full`, show `.price-compact`

---

## Component Patterns

### Cards
All cards share this base pattern:
```css
background: #fff;
border: 1px solid #e8ecf2;
border-radius: 16px;
padding: 28px; /* or 20px-24px for smaller cards */
```
Classes: `.chart-card`, `.holdings-card`, `.txn-card`, `.summary-card`

### Buttons
| Class | Style | Usage |
|-------|-------|-------|
| `.add-btn` | Blue bg, white text | Primary CTA |
| `.btn-save` | Blue bg | Save/confirm actions |
| `.btn-danger` | Red bg | Destructive actions |
| `.filter-bar-btn` | Light bg, border | Secondary/filter actions |
| `.settings-btn` | Icon-only, transparent | Settings/gear buttons |

Common button traits:
- `border-radius: 10px` (or 8px for smaller)
- `font-weight: 600`
- `transition: background 0.15s ease`
- Active state: `transform: scale(0.98)`

### Form Inputs
```css
/* Standard input styling */
background: #f7f9fc;
border: 1px solid #e8ecf2;
border-radius: 10px;
padding: 10px 14px;
font-size: 15px;
/* Focus state */
border-color: #3b82f6;
box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
```
Fields use `.field` class with flex column layout and 6px gap.

### Tables
- Sticky header with white background
- Row hover: `background: #f9fafb`
- Horizontal scroll on mobile with sticky first column
- Alternating row styling via borders

### Modals / Dialogs
- Overlay: `rgba(0,0,0,0.18)` with blur backdrop
- Container: white, `border-radius: 18px`, `max-width: 370px`
- Animation: `toastSlideUp` on open

### Dropdowns
- White background, `border-radius: 12px`
- Box shadow: `0 8px 32px rgba(0,0,0,0.12)`
- Animation: `selectSlideIn` (translateY -6px to 0)
- Click-outside to close (useRef + useEffect)

---

## Chart Styling

### Chart.js (PriceChart)
- **Area fill:** Gradient from `rgba(59,130,246,0.18)` to transparent
- **Line:** `#3b82f6`, 2px width
- **Buy markers:** `#1BC5BD` (teal dots)
- **Sell markers:** `#b91c1c` (red dots)
- **Grid:** `#f3f4f6`
- **Tooltip:** White bg, `#3b82f6` border, rounded

### Recharts (TWR/Inflation Charts)
- **Portfolio line:** Asset type color from config
- **Benchmark line:** `#f59e0b` (amber)
- **Inflation line:** Varies by metric
- **Legend:** Center on desktop, start on mobile

### Gradient Helper
```javascript
makeGradientBg({ r: 59, g: 130, b: 246 }) // Creates vertical gradient for area charts
```

---

## Animations & Transitions

### Standard Transition
```css
transition: all 0.15s ease; /* Most common */
transition: background 0.2s; /* Button hover */
```

### Keyframe Animations
| Name | Usage | Effect |
|------|-------|--------|
| `shimmer` | Loading skeletons | Horizontal gradient sweep |
| `selectSlideIn` | Dropdown appearance | Fade + translateY(-6px) to 0 |
| `toastFadeIn` | Toast notifications | Opacity 0 to 1 |
| `toastSlideUp` | Modal/toast entrance | Opacity + translateY(12px) + scale(0.97) to normal |

### Transform Patterns
- Button active: `scale(0.98)`
- Dropdown chevron open: `rotate(180deg)`
- Date picker centering: `translateY(-50%)`

---

## Asset Type Configuration

Each asset type in `src/config/assetTypeConfig.js` defines:
```javascript
{
  icon: '📈',           // Emoji icon
  displayName: 'Stocks', // UI label
  color: '#3b82f6',     // Theme color for charts/badges
  fields: [             // Metadata fields for TypeMetadataEditor
    {
      key: 'fieldName',
      label: 'Display Label',
      type: 'text' | 'number' | 'date' | 'select' | 'toggle' | 'currency' | 'currency-dropdown',
      options: [],       // For select type
      suffix: 'm²',     // For number type
      placeholder: '',
    }
  ]
}
```

---

## State Management

- **Global:** React Context API (`AuthContext` for Firebase auth)
- **Local:** `useState` / `useEffect` / `useCallback` / `useMemo` / `useRef`
- **No Redux, Zustand, or external state library**
- **Data persistence:** localStorage + Firebase Firestore via `src/services/storage.js`

---

## Key Conventions

1. **No UI framework** - all components are custom-built
2. **Single CSS file** - `App.css` contains all styles (no CSS modules)
3. **Class-based styling** - BEM-ish naming (e.g., `.chart-card`, `.holdings-card`, `.filter-bar-btn`)
4. **Desktop-first responsive** - styles are desktop by default, mobile overrides at 768px
5. **Consistent border-radius** - 16px for cards, 10-12px for inputs/buttons, 18px for modals
6. **Consistent border color** - `#e8ecf2` throughout
7. **Blue as action color** - `#3b82f6` for interactive elements
8. **DM Mono for numbers** - financial figures use monospace font
9. **Emoji icons** for asset types (not icon libraries)
10. **Click-outside pattern** - dropdowns/menus close via `useRef` + document click listener
