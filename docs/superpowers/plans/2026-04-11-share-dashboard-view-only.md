# Share Dashboard — View-Only Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a portfolio owner to invite viewers by email; viewers log in and see a filtered read-only subset of the owner's portfolio with no write access.

**Architecture:** A top-level Firestore `shares` collection stores invite records with filter rules. A `SharedViewProvider` loads the owner's properties, applies filters client-side, and wraps children with a read-only `AppStateContext`. A `ReadOnlyContext` signals UI components to hide write actions. All invite management (create/revoke/cancel) is done through a new Sharing settings page; invite links are copied manually.

**Tech Stack:** React 19, React Router v7, Firebase Firestore, TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add `group?` to Property; add Share types |
| Create | `src/lib/shareFilters.ts` | Pure filter evaluation logic |
| Create | `src/services/sharesService.ts` | Firestore CRUD for `shares` collection |
| Create | `src/context/ReadOnlyContext.ts` | Boolean context — components check to hide write actions |
| Create | `src/context/SharedViewProvider.tsx` | Loads owner properties, applies filters, provides read-only AppStateContext |
| Create | `src/pages/SharedPortfolioPage.tsx` | Route wrapper for `/shared/:shareId` |
| Create | `src/pages/InvitePage.tsx` | `/invite/:token` — accept/reject invite flow |
| Create | `src/pages/SharingSettingsPage.tsx` | Owner's sharing management: list, revoke, cancel |
| Create | `src/components/sharing/InviteModal.tsx` | Invite form with filter builder + property count preview |
| Create | `src/components/sharing/InviteLinkScreen.tsx` | Post-generation screen: copy link + mailto |
| Modify | `src/pages/PortfolioPage.tsx` | Add "Shared with me" section; respect ReadOnlyContext |
| Modify | `src/pages/PropertyPage.tsx` | Respect ReadOnlyContext (hide edit-name, pass read-only to tabs) |
| Modify | `src/components/property/OverviewTab.tsx` | Add group field display |
| Modify | `src/components/modals/AddPropertyModal.tsx` | Add group field input |
| Modify | `src/App.tsx` | Add `/invite/:token`, `/shared/:shareId`, `/settings/sharing` routes |
| Modify | `src/components/AuthHeader.jsx` | Add "Sharing" link in user menu |
| Modify | `src/App.css` | Styles for all sharing UI components |
| Create | `firestore.rules` | Security rules for shares + owner properties |

---

## Task 1: Feature branch + Share types

**Files:**
- Create branch: `feat/share-dashboard-view-only`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/share-dashboard-view-only
```

- [ ] **Step 2: Add `group` field to Property interface**

In `src/lib/types.ts`, add `group` as the last optional field of the `Property` interface (after `factSheet`):

```ts
export interface Property {
  id: number
  owner: string
  name: string
  address: string
  neighbourhood: string
  city: string
  postalCode: string
  country: string
  currency: CurrencyCode
  latitude?: number
  longitude?: number
  area: number
  bedrooms: number
  bathrooms: number
  parking: number
  storageUnits: number
  concierge: boolean
  terrace: number
  balcony: number
  floors: number
  year: number
  occupant?: Occupant
  customExpenseCats?: Record<number, string[]>
  hiddenExpenseCats?: Record<number, string[]>
  contracts: Contract[]
  months: Record<number, Record<number, MonthData>>
  capex: CapexItem[]
  taxes: { items: TaxItem[] }
  services?: Record<number, ServiceEntry[]>
  serviceOneTimeItems?: ServiceOneTimeItem[]
  factSheet?: FactSheet
  group?: string
}
```

- [ ] **Step 3: Add Share types at the bottom of `src/lib/types.ts`**

```ts
export type ShareScope = 'portfolio' | 'filtered' | 'properties'
export type ShareStatus = 'pending' | 'active' | 'revoked'
export type ShareFilterField = 'owner' | 'country' | 'city' | 'group'

export interface ShareFilter {
  field: ShareFilterField
  values: string[]
}

export interface Share {
  id: string
  ownerUid: string
  ownerDisplayName: string
  ownerPortfolioName: string
  granteeEmail: string
  granteeUid: string | null
  scope: ShareScope
  filters: ShareFilter[]
  propertyIds: number[]
  status: ShareStatus
  inviteToken: string
  createdAt: number        // epoch ms — Firestore Timestamp converted on read
  acceptedAt: number | null
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(sharing): add Share types and group field to Property"
```

---

## Task 2: shareFilters.ts — pure filter evaluation

**Files:**
- Create: `src/lib/shareFilters.ts`

- [ ] **Step 1: Create `src/lib/shareFilters.ts`**

```ts
import type { Property } from './types'
import type { ShareFilter, ShareScope } from './types'

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
```

Fix the import — `ShareFilterField` is already exported from `./types`:

```ts
import type { Property, ShareFilter, ShareScope, ShareFilterField } from './types'
```

- [ ] **Step 2: Verify in browser console (manual test)**

Run `npm run dev`, open the browser console, and paste:

```js
// Quick smoke test — paste in browser console after app loads
const props = [
  { id: 1, owner: 'John', country: 'Portugal', city: 'Lisbon', group: 'G1' },
  { id: 2, owner: 'Sarah', country: 'Spain', city: 'Madrid', group: 'G2' },
  { id: 3, owner: 'John', country: 'Spain', city: 'Barcelona', group: 'G1' },
]
// Should return [id:1] — John AND Portugal
const filters = [{ field: 'owner', values: ['John'] }, { field: 'country', values: ['Portugal'] }]
console.log('filtered:', props.filter(p => filters.every(f => f.values.includes(p[f.field]))))
// Expected: [{ id: 1, owner: 'John', country: 'Portugal', ... }]
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shareFilters.ts
git commit -m "feat(sharing): add shareFilters pure utility"
```

---

## Task 3: sharesService.ts — Firestore CRUD

**Files:**
- Create: `src/services/sharesService.ts`

- [ ] **Step 1: Create `src/services/sharesService.ts`**

```ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '../lib/firebase'
import type { Share, ShareScope, ShareFilter } from '../lib/types'

function sharesCol() {
  return collection(firestore!, 'shares')
}

function shareDoc(shareId: string) {
  return doc(firestore!, 'shares', shareId)
}

/** Converts a Firestore share document into a Share object. */
function toShare(id: string, data: Record<string, any>): Share {
  return {
    id,
    ownerUid: data.ownerUid,
    ownerDisplayName: data.ownerDisplayName ?? '',
    ownerPortfolioName: data.ownerPortfolioName ?? '',
    granteeEmail: data.granteeEmail,
    granteeUid: data.granteeUid ?? null,
    scope: data.scope,
    filters: data.filters ?? [],
    propertyIds: data.propertyIds ?? [],
    status: data.status,
    inviteToken: data.inviteToken,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    acceptedAt: data.acceptedAt?.toMillis?.() ?? null,
  }
}

/** Generates a cryptographically random invite token. */
function generateToken(): string {
  const arr = new Uint8Array(18)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type CreateShareInput = {
  ownerUid: string
  ownerDisplayName: string
  ownerPortfolioName: string
  granteeEmail: string
  scope: ShareScope
  filters: ShareFilter[]
  propertyIds: number[]
}

/** Creates a new pending share and returns the generated invite token. */
export async function createShare(input: CreateShareInput): Promise<{ shareId: string; inviteToken: string }> {
  const inviteToken = generateToken()
  const ref = await addDoc(sharesCol(), {
    ...input,
    granteeUid: null,
    status: 'pending',
    inviteToken,
    createdAt: serverTimestamp(),
    acceptedAt: null,
  })
  return { shareId: ref.id, inviteToken }
}

/** Subscribe to all shares owned by the current user (for Sharing settings page). */
export function subscribeOwnerShares(
  ownerUid: string,
  onChange: (shares: Share[]) => void,
): Unsubscribe {
  const q = query(sharesCol(), where('ownerUid', '==', ownerUid))
  return onSnapshot(q, (snap) => {
    const shares = snap.docs
      .map((d) => toShare(d.id, d.data()))
      .filter((s) => s.status !== 'revoked')
      .sort((a, b) => b.createdAt - a.createdAt)
    onChange(shares)
  })
}

/** Subscribe to all active shares granted to the current viewer. */
export function subscribeViewerShares(
  granteeUid: string,
  onChange: (shares: Share[]) => void,
): Unsubscribe {
  const q = query(
    sharesCol(),
    where('granteeUid', '==', granteeUid),
    where('status', '==', 'active'),
  )
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => toShare(d.id, d.data())))
  })
}

/** Look up a share by its invite token (used on /invite/:token). */
export async function getShareByToken(token: string): Promise<Share | null> {
  const q = query(sharesCol(), where('inviteToken', '==', token))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return toShare(d.id, d.data())
}

/** Accept a pending invite — sets granteeUid and marks active. */
export async function acceptShare(shareId: string, granteeUid: string): Promise<void> {
  await updateDoc(shareDoc(shareId), {
    granteeUid,
    status: 'active',
    acceptedAt: serverTimestamp(),
  })
}

/** Owner revokes an active share. */
export async function revokeShare(shareId: string): Promise<void> {
  await updateDoc(shareDoc(shareId), { status: 'revoked' })
}

/** Owner cancels a pending share (before it is accepted). */
export async function cancelShare(shareId: string): Promise<void> {
  await updateDoc(shareDoc(shareId), { status: 'revoked' })
}

/** Load a single share by ID (used in SharedViewProvider). */
export async function getShare(shareId: string): Promise<Share | null> {
  const snap = await getDoc(shareDoc(shareId))
  if (!snap.exists()) return null
  return toShare(snap.id, snap.data())
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/sharesService.ts
git commit -m "feat(sharing): add sharesService Firestore CRUD"
```

---

## Task 4: ReadOnlyContext

**Files:**
- Create: `src/context/ReadOnlyContext.ts`

- [ ] **Step 1: Create `src/context/ReadOnlyContext.ts`**

```ts
import { createContext, useContext } from 'react'

export const ReadOnlyContext = createContext<boolean>(false)

/** Returns true when the current view is a shared read-only portfolio. */
export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/ReadOnlyContext.ts
git commit -m "feat(sharing): add ReadOnlyContext"
```

---

## Task 5: SharedViewProvider + SharedPortfolioPage + route wiring

**Files:**
- Create: `src/context/SharedViewProvider.tsx`
- Create: `src/pages/SharedPortfolioPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/context/SharedViewProvider.tsx`**

```tsx
import { useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getShare } from '../services/sharesService'
import { subscribeProperties } from '../services/propertyService'
import { applyShareFilters } from '../lib/shareFilters'
import { AppStateContext, type Selection } from './app-state-context'
import { ReadOnlyContext } from './ReadOnlyContext'
import type { Share } from '../lib/types'

type Props = {
  shareId: string
  children: ReactNode
}

export function SharedViewProvider({ shareId, children }: Props) {
  const { user } = useAuth() as unknown as { user: any }
  const navigate = useNavigate()
  const [share, setShare] = useState<Share | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedIdRaw] = useState<Selection>('portfolio')

  // Load the share and validate the current user is the grantee
  useEffect(() => {
    if (!user) return
    getShare(shareId).then((s) => {
      if (!s) { setError('Share not found.'); setLoading(false); return }
      if (s.status === 'revoked') { setError('Access to this portfolio has been removed.'); setLoading(false); return }
      if (s.granteeUid !== user.uid) { setError('You do not have access to this share.'); setLoading(false); return }
      setShare(s)
    })
  }, [shareId, user])

  // Subscribe to owner's properties once share is loaded
  useEffect(() => {
    if (!share) return
    const unsub = subscribeProperties(share.ownerUid, (props) => {
      const filtered = applyShareFilters(props, share.scope, share.filters, share.propertyIds)
      setProperties(filtered)
      setLoading(false)
    })
    return () => unsub()
  }, [share])

  const setSelectedId = useCallback((id: Selection) => {
    setSelectedIdRaw(id)
  }, [])

  const contextValue = useMemo(() => ({
    properties,
    selectedId,
    setSelectedId,
    updateProperty: () => {}, // no-op — read only
    addProperty: () => {},    // no-op — read only
    removeProperty: () => {}, // no-op — read only
    addPropertyOpen: false,
    setAddPropertyOpen: () => {},
  }), [properties, selectedId, setSelectedId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#6b7280', fontSize: 14 }}>
        Loading shared portfolio…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <p style={{ color: '#374151', fontSize: 15 }}>{error}</p>
        <button className="add-btn" onClick={() => navigate('/')}>Back to my portfolio</button>
      </div>
    )
  }

  return (
    <ReadOnlyContext.Provider value={true}>
      <AppStateContext.Provider value={contextValue}>
        {children}
      </AppStateContext.Provider>
    </ReadOnlyContext.Provider>
  )
}
```

- [ ] **Step 2: Create `src/pages/SharedPortfolioPage.tsx`**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SharedViewProvider } from '../context/SharedViewProvider'
import { PortfolioPage } from './PortfolioPage'
import { PropertyPage } from './PropertyPage'
import AuthHeader from '../components/AuthHeader'
import { useAppState } from '../context/useAppState'
import { useEffect } from 'react'

function SharedContent({ shareLabel }: { shareLabel: string }) {
  const { properties, selectedId, setSelectedId } = useAppState()
  const navigate = useNavigate()
  const activeProp = typeof selectedId === 'number' ? properties.find((p) => p.id === selectedId) : undefined

  useEffect(() => {
    if (typeof selectedId === 'number' && !activeProp) setSelectedId('portfolio')
  }, [selectedId, activeProp, setSelectedId])

  return (
    <>
      <AuthHeader />
      <div className="shared-view-banner">
        <span className="shared-view-badge">👁 View only</span>
        <span className="shared-view-label">{shareLabel}</span>
        <button className="shared-view-back" onClick={() => navigate('/')}>← Back to my portfolio</button>
      </div>
      <div className="app-body">
        {activeProp ? (
          <PropertyPage
            key={activeProp.id}
            prop={activeProp}
            onUpdateProp={() => {}} // no-op
          />
        ) : (
          <PortfolioPage
            properties={properties}
            onSelectProperty={setSelectedId}
          />
        )}
      </div>
    </>
  )
}

export function SharedPortfolioPage() {
  const { shareId } = useParams<{ shareId: string }>()
  const { user } = useAuth() as unknown as { user: any }
  const navigate = useNavigate()

  if (!user) {
    navigate(`/login?redirect=/shared/${shareId}`)
    return null
  }

  return (
    <SharedViewProvider shareId={shareId!}>
      <SharedContent shareLabel="Shared portfolio" />
    </SharedViewProvider>
  )
}
```

- [ ] **Step 3: Add `/shared/:shareId` route in `src/App.tsx`**

Add the import at the top of `src/App.tsx`:

```ts
import { SharedPortfolioPage } from './pages/SharedPortfolioPage'
```

Inside `AppRoutes`, add the new route before the catch-all `/` route:

```tsx
<Route path="/shared/:shareId" element={<SharedPortfolioPage />} />
```

The `AppRoutes` function should look like:

```tsx
function AppRoutes() {
  const { user, loading } = useAuth() as unknown as { user: any; loading: boolean }
  if (loading) return (/* existing loading spinner */)

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminPage />} />
        <Route path="design-system" element={<AdminDesignSystemPage />} />
      </Route>
      <Route path="/shared/:shareId" element={<SharedPortfolioPage />} />
      <Route
        path="/"
        element={
          user ? (
            <AppStateProvider uid={user.uid}>
              <AppContent />
            </AppStateProvider>
          ) : (
            <LandingPage />
          )
        }
      />
    </Routes>
  )
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```

Open `http://localhost:5173/shared/fake-id`. Expected: shows loading briefly then "Share not found." with a back button. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/context/SharedViewProvider.tsx src/pages/SharedPortfolioPage.tsx src/App.tsx
git commit -m "feat(sharing): add SharedViewProvider and /shared/:shareId route"
```

---

## Task 6: InvitePage — `/invite/:token`

**Files:**
- Create: `src/pages/InvitePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/pages/InvitePage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getShareByToken, acceptShare } from '../services/sharesService'

type State = 'loading' | 'accepting' | 'success' | 'already-active' | 'revoked' | 'not-found' | 'wrong-email'

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { user, loading: authLoading } = useAuth() as unknown as { user: any; loading: boolean }
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<State>('loading')
  const [shareId, setShareId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // Redirect to login, then back to this invite
      navigate(`/login?redirect=/invite/${token}`)
      return
    }

    async function process() {
      const share = await getShareByToken(token!)
      if (!share) { setState('not-found'); return }
      if (share.status === 'revoked') { setState('revoked'); return }
      if (share.status === 'active' && share.granteeUid === user.uid) {
        setShareId(share.id)
        setState('already-active')
        return
      }
      if (share.granteeEmail.toLowerCase() !== user.email?.toLowerCase()) {
        setState('wrong-email')
        return
      }
      setState('accepting')
      await acceptShare(share.id, user.uid)
      setShareId(share.id)
      setState('success')
    }

    process()
  }, [token, user, authLoading, navigate])

  useEffect(() => {
    if ((state === 'success' || state === 'already-active') && shareId) {
      const timer = setTimeout(() => navigate(`/shared/${shareId}`), 1500)
      return () => clearTimeout(timer)
    }
  }, [state, shareId, navigate])

  const messages: Record<State, string> = {
    loading: 'Checking invite…',
    accepting: 'Accepting invite…',
    success: '✓ Access granted! Redirecting…',
    'already-active': 'You already have access. Redirecting…',
    revoked: 'This invite is no longer valid. Ask the owner to send a new one.',
    'not-found': 'This invite link is invalid.',
    'wrong-email': `This invite was sent to a different email address. Please sign in with the correct account.`,
  }

  const isError = state === 'revoked' || state === 'not-found' || state === 'wrong-email'
  const isSuccess = state === 'success' || state === 'already-active'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          {isSuccess ? '✓' : isError ? '✗' : '⏳'}
        </div>
        <p style={{ fontSize: 15, color: isError ? '#ef4444' : '#374151', lineHeight: 1.5 }}>
          {messages[state]}
        </p>
        {isError && (
          <button
            className="add-btn"
            style={{ marginTop: 20 }}
            onClick={() => navigate('/')}
          >
            Back to my portfolio
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `/invite/:token` route in `src/App.tsx`**

Add import:

```ts
import { InvitePage } from './pages/InvitePage'
```

Add route (before `/shared/:shareId`):

```tsx
<Route path="/invite/:token" element={<InvitePage />} />
```

- [ ] **Step 3: Handle login redirect**

In `src/pages/LoginPage.jsx` (the existing page), after a successful login, redirect to the `redirect` query param if present. Check what the existing LoginPage does on success — it likely navigates to `/`. Find the success handler and add:

```js
const params = new URLSearchParams(window.location.search)
const redirect = params.get('redirect')
navigate(redirect || '/')
```

Locate the `useNavigate()` call and the login success callback in `src/pages/LoginPage.jsx`. Replace any hardcoded `navigate('/')` with the above pattern.

- [ ] **Step 4: Verify**

Run `npm run dev`. Open `http://localhost:5173/invite/bad-token`. Expected: shows "✗ This invite link is invalid." with a back button.

- [ ] **Step 5: Commit**

```bash
git add src/pages/InvitePage.tsx src/App.tsx src/pages/LoginPage.jsx
git commit -m "feat(sharing): add /invite/:token accept flow"
```

---

## Task 7: SharingSettingsPage

**Files:**
- Create: `src/pages/SharingSettingsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/pages/SharingSettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeOwnerShares, revokeShare, cancelShare } from '../services/sharesService'
import type { Share } from '../lib/types'
import AuthHeader from '../components/AuthHeader'
import { InviteModal } from '../components/sharing/InviteModal'

function StatusBadge({ status }: { status: 'pending' | 'active' }) {
  const styles: Record<string, React.CSSProperties> = {
    active: { background: '#d1fae5', color: '#065f46' },
    pending: { background: '#fef3c7', color: '#92400e' },
  }
  return (
    <span style={{ ...styles[status], borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function shareLabel(share: Share): string {
  if (share.scope === 'portfolio') return 'Full portfolio access'
  if (share.scope === 'properties') return `${share.propertyIds.length} specific propert${share.propertyIds.length === 1 ? 'y' : 'ies'}`
  if (share.filters.length === 0) return 'Filtered view (no filters set)'
  return share.filters
    .map((f) => `${f.field.charAt(0).toUpperCase() + f.field.slice(1)} = ${f.values.join(', ')}`)
    .join(' · ')
}

function initials(email: string): string {
  return email[0].toUpperCase()
}

export function SharingSettingsPage() {
  const { user } = useAuth() as unknown as { user: any }
  const [shares, setShares] = useState<Share[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    return subscribeOwnerShares(user.uid, setShares)
  }, [user])

  const activeShares = shares.filter((s) => s.status === 'active')
  const pendingShares = shares.filter((s) => s.status === 'pending')

  async function handleRevoke(shareId: string) {
    await revokeShare(shareId)
  }

  async function handleCancel(shareId: string) {
    await cancelShare(shareId)
  }

  return (
    <>
      <AuthHeader />
      <div className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1d23', margin: 0 }}>Sharing &amp; Access</h1>
            <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Control who can view your portfolio</p>
          </div>
          <button className="add-btn" onClick={() => setInviteOpen(true)}>+ Invite viewer</button>
        </div>

        {activeShares.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div className="sharing-section-label">ACTIVE ({activeShares.length})</div>
            <div className="sharing-list">
              {activeShares.map((s) => (
                <div key={s.id} className="sharing-row">
                  <div className="sharing-avatar">{initials(s.granteeEmail)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sharing-email">{s.granteeEmail}</div>
                    <div className="sharing-scope">{shareLabel(s)}</div>
                  </div>
                  <StatusBadge status="active" />
                  <button className="sharing-btn-danger" onClick={() => handleRevoke(s.id)}>Revoke</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {pendingShares.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div className="sharing-section-label">PENDING ({pendingShares.length})</div>
            <div className="sharing-list">
              {pendingShares.map((s) => (
                <div key={s.id} className="sharing-row">
                  <div className="sharing-avatar" style={{ background: '#fef3c7', color: '#92400e' }}>{initials(s.granteeEmail)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sharing-email">{s.granteeEmail}</div>
                    <div className="sharing-scope">{shareLabel(s)} · Invite not yet accepted</div>
                  </div>
                  <StatusBadge status="pending" />
                  <button
                    className="sharing-btn-secondary"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${s.inviteToken}`)}
                  >
                    Copy link
                  </button>
                  <button className="sharing-btn-danger" onClick={() => handleCancel(s.id)}>Cancel</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {shares.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280', fontSize: 14 }}>
            No active shares. Click "Invite viewer" to share your portfolio.
          </div>
        )}
      </div>

      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} />
      )}
    </>
  )
}
```

- [ ] **Step 2: Add `/settings/sharing` route in `src/App.tsx`**

Add import:

```ts
import { SharingSettingsPage } from './pages/SharingSettingsPage'
```

Add route (before `/shared/:shareId`):

```tsx
<Route path="/settings/sharing" element={user ? <SharingSettingsPage /> : <Navigate to="/login" />} />
```

- [ ] **Step 3: Commit (SharingSettingsPage will compile once InviteModal is added in Task 8)**

```bash
git add src/pages/SharingSettingsPage.tsx src/App.tsx
git commit -m "feat(sharing): add SharingSettingsPage and /settings/sharing route"
```

---

## Task 8: InviteModal + InviteLinkScreen

**Files:**
- Create: `src/components/sharing/InviteModal.tsx`
- Create: `src/components/sharing/InviteLinkScreen.tsx`

- [ ] **Step 1: Create `src/components/sharing/` directory and `InviteLinkScreen.tsx`**

```tsx
// src/components/sharing/InviteLinkScreen.tsx
type Props = {
  inviteToken: string
  granteeEmail: string
  onClose: () => void
}

export function InviteLinkScreen({ inviteToken, granteeEmail, onClose }: Props) {
  const link = `${window.location.origin}/invite/${inviteToken}`
  const subject = encodeURIComponent('You have been invited to view a portfolio on PropTracker')
  const body = encodeURIComponent(`Hi,\n\nYou have been invited to view a portfolio on PropTracker. Click the link below to accept:\n\n${link}\n\nThis link is personal — please do not share it.`)
  const mailtoHref = `mailto:${granteeEmail}?subject=${subject}&body=${body}`

  function copyLink() {
    navigator.clipboard.writeText(link)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1d23', margin: 0 }}>Invite link created</h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Share this link with {granteeEmail}</p>
        </div>
        <div className="invite-link-box">{link}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn-save" style={{ flex: 1 }} onClick={copyLink}>Copy link</button>
          <a href={mailtoHref} className="filter-bar-btn" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Open in email ✉
          </a>
        </div>
        <button className="filter-bar-btn" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/sharing/InviteModal.tsx`**

```tsx
import { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useAppState } from '../../context/useAppState'
import { createShare } from '../../services/sharesService'
import { applyShareFilters, filterFieldValues } from '../../lib/shareFilters'
import { InviteLinkScreen } from './InviteLinkScreen'
import type { ShareScope, ShareFilter, ShareFilterField } from '../../lib/types'

const FILTER_FIELD_LABELS: Record<ShareFilterField, string> = {
  owner: 'Owner',
  country: 'Country',
  city: 'City',
  group: 'Group',
}

const ALL_FILTER_FIELDS: ShareFilterField[] = ['owner', 'country', 'city', 'group']

type Props = {
  onClose: () => void
}

export function InviteModal({ onClose }: Props) {
  const { user } = useAuth() as unknown as { user: any }
  const { properties } = useAppState()
  const [email, setEmail] = useState('')
  const [scope, setScope] = useState<ShareScope>('filtered')
  const [filters, setFilters] = useState<ShareFilter[]>([{ field: 'owner', values: [] }])
  const [saving, setSaving] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)

  // Preview: how many properties will the viewer see
  const previewCount = useMemo(() => {
    return applyShareFilters(properties, scope, filters, []).length
  }, [properties, scope, filters])

  function addFilter() {
    const usedFields = new Set(filters.map((f) => f.field))
    const nextField = ALL_FILTER_FIELDS.find((f) => !usedFields.has(f)) ?? 'owner'
    setFilters((prev) => [...prev, { field: nextField, values: [] }])
  }

  function removeFilter(idx: number) {
    setFilters((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateFilterField(idx: number, field: ShareFilterField) {
    setFilters((prev) => prev.map((f, i) => i === idx ? { field, values: [] } : f))
  }

  function toggleFilterValue(idx: number, value: string) {
    setFilters((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f
        const next = f.values.includes(value)
          ? f.values.filter((v) => v !== value)
          : [...f.values, value]
        return { ...f, values: next }
      }),
    )
  }

  async function handleSubmit() {
    if (!email.trim() || !user) return
    setSaving(true)
    try {
      const { inviteToken: token } = await createShare({
        ownerUid: user.uid,
        ownerDisplayName: user.displayName || user.email,
        ownerPortfolioName: `${user.displayName || user.email.split('@')[0]}'s Portfolio`,
        granteeEmail: email.trim().toLowerCase(),
        scope,
        filters: scope === 'filtered' ? filters.filter((f) => f.values.length > 0) : [],
        propertyIds: [],
      })
      setInviteToken(token)
    } finally {
      setSaving(false)
    }
  }

  if (inviteToken) {
    return <InviteLinkScreen inviteToken={inviteToken} granteeEmail={email} onClose={onClose} />
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1d23', marginTop: 0, marginBottom: 20 }}>Invite viewer</h2>

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-label">EMAIL ADDRESS</label>
          <input
            type="email"
            className="input"
            placeholder="viewer@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-label">ACCESS SCOPE</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['filtered', 'portfolio'] as ShareScope[]).map((s) => (
              <button
                key={s}
                type="button"
                className={scope === s ? 'add-btn' : 'filter-bar-btn'}
                style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => setScope(s)}
              >
                {s === 'filtered' ? 'Filtered view' : 'Full portfolio'}
              </button>
            ))}
          </div>
        </div>

        {scope === 'filtered' && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">FILTERS <span style={{ fontWeight: 400, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>(all must match)</span></label>
            {filters.map((filter, idx) => {
              const availableValues = filterFieldValues(properties, filter.field)
              return (
                <div key={idx} className="filter-builder-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <select
                      className="input"
                      style={{ flex: 1, padding: '5px 8px', fontSize: 13 }}
                      value={filter.field}
                      onChange={(e) => updateFilterField(idx, e.target.value as ShareFilterField)}
                    >
                      {ALL_FILTER_FIELDS.map((f) => (
                        <option key={f} value={f}>{FILTER_FIELD_LABELS[f]}</option>
                      ))}
                    </select>
                    <span style={{ color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>is any of</span>
                    {filters.length > 1 && (
                      <button type="button" className="filter-bar-btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => removeFilter(idx)}>✕</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {availableValues.map((v) => (
                      <button
                        key={v}
                        type="button"
                        style={{
                          borderRadius: 5, padding: '3px 9px', fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
                          background: filter.values.includes(v) ? '#dbeafe' : '#f7f9fc',
                          color: filter.values.includes(v) ? '#1d4ed8' : '#6b7280',
                          outline: filter.values.includes(v) ? '1px solid #bfdbfe' : '1px solid #e8ecf2',
                        }}
                        onClick={() => toggleFilterValue(idx, v)}
                      >
                        {v}
                      </button>
                    ))}
                    {availableValues.length === 0 && (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>No values found for this field</span>
                    )}
                  </div>
                </div>
              )
            })}
            {filters.length < ALL_FILTER_FIELDS.length && (
              <button type="button" className="filter-bar-btn" style={{ width: '100%', marginTop: 6 }} onClick={addFilter}>
                + Add filter
              </button>
            )}
          </div>
        )}

        {scope === 'filtered' && (
          <div className="invite-preview-banner">
            Viewer will see <strong>{previewCount} propert{previewCount === 1 ? 'y' : 'ies'}</strong> matching current filters
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="filter-bar-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-save"
            style={{ flex: 2 }}
            disabled={!email.trim() || saving}
            onClick={handleSubmit}
          >
            {saving ? 'Creating…' : 'Generate invite link'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Open `/settings/sharing`, click **+ Invite viewer**. Expected: invite modal opens with scope picker and filter builder. Filters auto-populate from your properties' owner/country/city values.

- [ ] **Step 4: Commit**

```bash
git add src/components/sharing/InviteModal.tsx src/components/sharing/InviteLinkScreen.tsx
git commit -m "feat(sharing): add InviteModal and InviteLinkScreen components"
```

---

## Task 9: "Shared with me" section on PortfolioPage

**Files:**
- Modify: `src/pages/PortfolioPage.tsx`

- [ ] **Step 1: Add a `SharedWithMeSection` component inside `PortfolioPage.tsx`**

Add this near the top of `src/pages/PortfolioPage.tsx`, after the imports:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeViewerShares } from '../services/sharesService'
import { useAuth } from '../contexts/AuthContext'
import type { Share } from '../lib/types'

function SharedWithMeSection() {
  const { user } = useAuth() as unknown as { user: any }
  const [shares, setShares] = useState<Share[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    return subscribeViewerShares(user.uid, setShares)
  }, [user])

  if (shares.length === 0) return null

  return (
    <div className="shared-with-me-section">
      <div className="sharing-section-label">SHARED WITH ME</div>
      <div className="shared-with-me-cards">
        {shares.map((s) => (
          <button
            key={s.id}
            className="shared-with-me-card"
            onClick={() => navigate(`/shared/${s.id}`)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span className="shared-with-me-name">{s.ownerPortfolioName}</span>
              <span className="shared-view-badge">view only</span>
            </div>
            <div className="shared-with-me-meta">
              {s.scope === 'portfolio' ? 'Full portfolio access' : s.filters.map((f) => `${f.field} = ${f.values.join(', ')}`).join(' · ')}
            </div>
            <div style={{ color: '#3b82f6', fontSize: 12, fontWeight: 600, marginTop: 8 }}>Open →</div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Render `SharedWithMeSection` at the bottom of the `PortfolioPage` return**

Find the closing `</div>` of the outermost wrapper in `PortfolioPage` and add `<SharedWithMeSection />` just before it:

```tsx
      {/* existing portfolio content */}
      <SharedWithMeSection />
    </div>
  )
```

- [ ] **Step 3: Add `useNavigate` import to `PortfolioPage.tsx`**

`PortfolioPage.tsx` already imports from `react-router-dom` — add `useNavigate` if not already there.

- [ ] **Step 4: Verify**

Run `npm run dev`. Log in as a user who has an active share. Expected: "SHARED WITH ME" section appears at the bottom of the portfolio dashboard with portfolio cards.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PortfolioPage.tsx
git commit -m "feat(sharing): add SharedWithMeSection to PortfolioPage"
```

---

## Task 10: Read-only mode — hide write actions

**Files:**
- Modify: `src/pages/PortfolioPage.tsx`
- Modify: `src/pages/PropertyPage.tsx`

- [ ] **Step 1: Import and use `useReadOnly` in `PortfolioPage.tsx`**

Add import:

```tsx
import { useReadOnly } from '../context/ReadOnlyContext'
```

At the top of the `PortfolioPage` function body, add:

```tsx
const readOnly = useReadOnly()
```

Find every place that renders the "Add property" button or property edit/delete icons and wrap with `{!readOnly && ...}`. For example:

```tsx
{!readOnly && onAddProperty && (
  <button className="add-btn" onClick={onAddProperty}>+ Add property</button>
)}
```

And the property row edit/delete dots menu:

```tsx
{!readOnly && (
  <div className="property-actions">
    {/* existing edit/delete/copy buttons */}
  </div>
)}
```

- [ ] **Step 2: Import and use `useReadOnly` in `PropertyPage.tsx`**

Add import:

```tsx
import { useReadOnly } from '../context/ReadOnlyContext'
```

At the top of `PropertyPage` function body:

```tsx
const readOnly = useReadOnly()
```

Hide the inline edit-name pencil button:

```tsx
{!readOnly && (
  <button className="ghost" onClick={startEditName}>✏</button>
)}
```

If the component renders the name as an editable input when `editingName` is true, also short-circuit that:

```tsx
const startEditName = () => {
  if (readOnly) return
  setNameDraft(prop.name)
  setEditingName(true)
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Navigate to `/shared/fake-id`. Expected: "Share not found" error. To test properly, create a real share in Firestore (or run the invite flow end-to-end) and navigate to `/shared/{shareId}`. Expected: portfolio loads in read-only mode with no add/edit/delete buttons visible.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PortfolioPage.tsx src/pages/PropertyPage.tsx
git commit -m "feat(sharing): hide write actions in read-only mode"
```

---

## Task 11: `group` field on property forms

**Files:**
- Modify: `src/components/modals/AddPropertyModal.tsx`
- Modify: `src/components/property/OverviewTab.tsx`

- [ ] **Step 1: Add `group` input to `AddPropertyModal.tsx`**

Find where the property object is built before calling `onSave`. Add a `group` state variable:

```tsx
const [group, setGroup] = useState('')
```

Add an input field in the form, alongside the `owner` field:

```tsx
<div className="field">
  <label className="field-label">GROUP (optional)</label>
  <input
    type="text"
    className="input"
    placeholder="e.g. Group 1, High Yield"
    value={group}
    onChange={(e) => setGroup(e.target.value)}
  />
</div>
```

When building the property object for `onSave`, include `group`:

```tsx
group: group.trim() || undefined,
```

- [ ] **Step 2: Display and edit `group` in `OverviewTab.tsx`**

Read the existing `OverviewTab` component to find where property metadata fields (owner, city, country, etc.) are displayed and edited. Add `group` as an additional field with the same edit pattern used for `owner`.

The pattern in `OverviewTab` is typically an inline edit row. Add:

```tsx
<div className="overview-field">
  <span className="overview-field-label">Group</span>
  <EditableText
    value={prop.group ?? ''}
    onSave={(v) => onUpdateProp((p) => ({ ...p, group: v.trim() || undefined }))}
    placeholder="Add group tag…"
  />
</div>
```

*(Use whatever the existing inline-edit pattern is in that file — replicate it exactly for consistency.)*

- [ ] **Step 3: Verify**

Run `npm run dev`. Open any property → Overview tab. Expected: "Group" field appears. Edit it, save, reload — value persists.

- [ ] **Step 4: Commit**

```bash
git add src/components/modals/AddPropertyModal.tsx src/components/property/OverviewTab.tsx
git commit -m "feat(sharing): add group field to property forms and overview"
```

---

## Task 12: CSS for sharing UI

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add sharing styles to `src/App.css`**

Append to the end of `src/App.css`:

```css
/* ===================== SHARING UI ===================== */

/* Shared view banner (top of shared portfolio page) */
.shared-view-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f0f7ff;
  border-bottom: 1px solid #bfdbfe;
  padding: 10px 24px;
  font-size: 13px;
  position: sticky;
  top: 56px;
  z-index: 10;
}
.shared-view-badge {
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.shared-view-label {
  color: #374151;
  flex: 1;
}
.shared-view-back {
  background: none;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #1d4ed8;
  cursor: pointer;
  white-space: nowrap;
}
.shared-view-back:hover { background: #dbeafe; }

/* Sharing settings page */
.sharing-section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.sharing-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sharing-row {
  background: #fff;
  border: 1px solid #e8ecf2;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.sharing-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #dbeafe;
  color: #1d4ed8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}
.sharing-email {
  font-weight: 600;
  color: #1a1d23;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sharing-scope {
  color: #6b7280;
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sharing-btn-danger {
  background: none;
  border: 1px solid #e8ecf2;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #ef4444;
  cursor: pointer;
  white-space: nowrap;
}
.sharing-btn-danger:hover { border-color: #ef4444; background: #fef2f2; }
.sharing-btn-secondary {
  background: none;
  border: 1px solid #e8ecf2;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
}
.sharing-btn-secondary:hover { background: #f7f9fc; }

/* Invite modal filter builder */
.filter-builder-row {
  background: #f7f9fc;
  border: 1px solid #e8ecf2;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 6px;
}
.invite-preview-banner {
  background: #f0f7ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: #1e40af;
}
.invite-link-box {
  background: #f7f9fc;
  border: 1px solid #e8ecf2;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
  word-break: break-all;
  margin-bottom: 12px;
}

/* "Shared with me" section on portfolio page */
.shared-with-me-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e8ecf2;
}
.shared-with-me-cards {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.shared-with-me-card {
  background: #fff;
  border: 1px solid #e8ecf2;
  border-radius: 14px;
  padding: 16px 20px;
  min-width: 220px;
  cursor: pointer;
  text-align: left;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.shared-with-me-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 2px 8px rgba(59,130,246,0.08);
}
.shared-with-me-name {
  font-weight: 700;
  color: #1a1d23;
  font-size: 14px;
}
.shared-with-me-meta {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
}

@media (max-width: 768px) {
  .shared-view-banner {
    flex-wrap: wrap;
    gap: 8px;
  }
  .shared-with-me-cards {
    flex-direction: column;
  }
  .sharing-row {
    flex-wrap: wrap;
  }
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Open `/settings/sharing`. Expected: clean layout with section labels, share rows, and proper button styles.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat(sharing): add CSS for sharing UI components"
```

---

## Task 13: Navigation — Sharing link in AuthHeader

**Files:**
- Modify: `src/components/AuthHeader.jsx`

- [ ] **Step 1: Add Sharing settings link to the user menu in `AuthHeader.jsx`**

Find where the user dropdown menu is rendered — it shows items like "Change Password", "Delete Account", etc. Add a "Sharing & Access" link before those items using React Router's `Link`:

```jsx
import { Link } from 'react-router-dom'

// Inside the dropdown menu, add:
<Link
  to="/settings/sharing"
  className="menu-item"
  onClick={() => setMenuOpen(false)}
  style={{ display: 'block', padding: '8px 16px', fontSize: 14, color: '#374151', textDecoration: 'none' }}
>
  🔗 Sharing &amp; Access
</Link>
```

*(Use whatever className/style the existing menu items use — replicate the pattern exactly.)*

- [ ] **Step 2: Verify**

Run `npm run dev`. Click the user avatar in the top right. Expected: "Sharing & Access" item appears in the dropdown. Clicking it navigates to `/settings/sharing`.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthHeader.jsx
git commit -m "feat(sharing): add Sharing & Access link to user menu"
```

---

## Task 14: Firestore security rules

**Files:**
- Create: `firestore.rules`

- [ ] **Step 1: Create `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Users ────────────────────────────────────────────────────────────────
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      // Properties: owner full access; viewers with active share can read
      match /properties/{propertyId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;

        allow read: if request.auth != null
          && exists(/databases/$(database)/documents/shares/$(request.auth.uid + '_' + uid))
          == false  // NOTE: token-based lookup below
          && getShareForViewer(request.auth.uid, uid) == true;
      }
    }

    // ── Shares ────────────────────────────────────────────────────────────────
    match /shares/{shareId} {
      // Owner: full read/write on their own shares
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.ownerUid;

      // Grantee: read their own shares (to check status)
      allow read: if request.auth != null
        && request.auth.uid == resource.data.granteeUid;

      // Acceptance: grantee can accept a pending share addressed to their email
      allow update: if request.auth != null
        && request.auth.token.email == resource.data.granteeEmail
        && resource.data.status == 'pending'
        && request.resource.data.diff(resource.data)
            .affectedKeys().hasOnly(['granteeUid', 'status', 'acceptedAt']);

      // Grantee can also read pending shares (for the /invite/:token flow)
      // where granteeUid is still null — match by email instead
      allow read: if request.auth != null
        && request.auth.token.email == resource.data.granteeEmail;
    }
  }
}
```

**Note on the properties read rule:** The Firestore rule above uses a simplified check. The correct approach is a collection group query helper or a denormalized viewer list. The simplest production-safe version:

For `users/{uid}/properties/{propertyId}`, the read rule should use:

```
allow read: if request.auth != null && (
  request.auth.uid == uid
  || exists(
       /databases/$(database)/documents/shares/$(shareId)
     ) // <-- this needs a known shareId
);
```

Because Firestore security rules cannot query within rules, the recommended production pattern is:
1. Keep the client-side filter as the primary data-scoping mechanism
2. Verify the share exists client-side before subscribing to properties
3. Set the Firestore rule to: allow read on `users/{uid}/properties` if the viewer's UID appears in a denormalized `viewers` array on the user doc

**Alternative simpler rule (recommended for v1):** Add a `viewers` array to the user doc that lists all active granteeUids. Update this array when shares are accepted/revoked using the `updateDoc` call in `acceptShare` and `revokeShare`.

Update `src/services/sharesService.ts` `acceptShare` to also update the owner's user doc:

```ts
import { arrayUnion, arrayRemove } from 'firebase/firestore'

export async function acceptShare(shareId: string, granteeUid: string): Promise<void> {
  const share = await getShare(shareId)
  if (!share) return
  await Promise.all([
    updateDoc(shareDoc(shareId), {
      granteeUid,
      status: 'active',
      acceptedAt: serverTimestamp(),
    }),
    // Denormalize viewer uid onto owner's user doc for security rules
    updateDoc(doc(firestore!, 'users', share.ownerUid), {
      viewers: arrayUnion(granteeUid),
    }),
  ])
}

export async function revokeShare(shareId: string): Promise<void> {
  const share = await getShare(shareId)
  if (!share || !share.granteeUid) return
  await Promise.all([
    updateDoc(shareDoc(shareId), { status: 'revoked' }),
    updateDoc(doc(firestore!, 'users', share.ownerUid), {
      viewers: arrayRemove(share.granteeUid),
    }),
  ])
}
```

Then the Firestore rule for properties becomes:

```
match /users/{uid}/properties/{propertyId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
  allow read: if request.auth != null
    && request.auth.uid in get(/databases/$(database)/documents/users/$(uid)).data.viewers;
}
```

- [ ] **Step 2: Deploy rules via Firebase console**

Go to Firebase Console → Firestore → Rules → paste the rules → Publish.

Or if Firebase CLI is configured:

```bash
firebase deploy --only firestore:rules
```

- [ ] **Step 3: Update `sharesService.ts` with the denormalized `viewers` pattern**

Apply the `arrayUnion`/`arrayRemove` changes to `acceptShare`, `revokeShare`, and `cancelShare` as described above.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules src/services/sharesService.ts
git commit -m "feat(sharing): add Firestore security rules with denormalized viewers"
```

---

## Task 15: Final integration check + PR

- [ ] **Step 1: Full end-to-end test**

Run `npm run dev`. Follow this flow:
1. Log in as the portfolio owner.
2. Open user menu → Sharing & Access.
3. Click **+ Invite viewer**. Set scope to "Filtered", pick owner = one of your owners. Note how many properties are previewed.
4. Click **Generate invite link**. Copy the link.
5. Open the link in an incognito window. Log in as a different user.
6. Expected: `InvitePage` shows "Accepting invite…" then "✓ Access granted!" then redirects to `/shared/{shareId}`.
7. Shared portfolio shows the correct filtered properties, "👁 View only" banner, and no add/edit/delete buttons.
8. Back on the owner's dashboard: Sharing settings shows the share as "Active".
9. Click **Revoke** on the owner's settings page.
10. Refresh the viewer's shared page. Expected: "Access to this portfolio has been removed."
11. Back on the portfolio page, check "SHARED WITH ME" appears at the bottom for the viewer account.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: exits 0 with no TypeScript or build errors.

- [ ] **Step 3: Open pull request**

```bash
git push -u origin feat/share-dashboard-view-only
```

Then open a PR from `feat/share-dashboard-view-only` → `main` on GitHub.

---

## Self-Review Notes

- **Spec coverage:** All spec sections have corresponding tasks: data model (T1-T3), invite flow (T6), sharing settings (T7), invite modal (T8), shared-with-me (T9), read-only mode (T10), group field (T11), Firestore rules (T14).
- **No placeholders:** All code blocks are complete. Task 11 references "use whatever the existing inline-edit pattern is" — this is intentional guidance since the exact pattern in `OverviewTab.tsx` must be matched, not replaced.
- **Type consistency:** `Share`, `ShareFilter`, `ShareScope`, `ShareFilterField`, `ShareStatus` defined in T1 and used consistently in T2-T8.
- **Branch:** Starts in T1, PR in T15.
