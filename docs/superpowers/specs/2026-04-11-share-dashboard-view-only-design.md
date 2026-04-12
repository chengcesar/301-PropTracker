# Share Dashboard — View-Only Access

**Date:** 2026-04-11  
**Status:** Approved  

---

## Overview

A portfolio manager (owner) can invite external viewers to see a read-only version of their portfolio. Viewers log in with their own PropTracker account and see only the properties the owner has permitted. All write actions (add, edit, delete) are hidden for viewers. Viewers can use filters and navigate all pages normally.

This is designed for property managers who hold properties belonging to multiple real-world owners and want to share per-owner or per-group subsets securely, without exposing other owners' data.

---

## Requirements

- Sharing is email-invite only — viewers must log in (or sign up via invite link)
- Three sharing scopes: full portfolio, filtered view, specific properties
- Filtered view supports multi-dimension AND/OR logic across owner, country, city, and group
- Viewers see all sections (contracts, cashflow, opex/capex, taxes, valuation, fact sheet)
- Viewers see a "Shared with me" section on their own dashboard
- Owner manages all shares from a dedicated Sharing settings page
- Owner can revoke active shares or cancel pending ones at any time — access is removed immediately
- Invite link is generated and the owner copies/sends it manually (no backend email sending)
- No Cloud Functions required

---

## Data Model

### New field on Property

```ts
group?: string   // Free-text tag, e.g. "Group 1", "High Yield". Optional.
```

### New Firestore collection: `shares/{shareId}`

```ts
{
  // Ownership
  ownerUid: string               // PropTracker uid of the portfolio owner
  ownerDisplayName: string       // e.g. "César Cheng"
  ownerPortfolioName: string     // e.g. "César's Portfolio" — shown in viewer's dashboard

  // Grantee
  granteeEmail: string           // Email address the invite was sent to
  granteeUid: string | null      // null until invite accepted; set on acceptance

  // Access scope
  scope: "portfolio" | "filtered" | "properties"

  filters: Array<{               // Used when scope = "filtered"
    field: "owner" | "country" | "city" | "group"
    values: string[]             // OR logic within: property matches if field value is in this list
  }>                             // AND logic across: all filter entries must match

  propertyIds: number[]          // Used when scope = "properties"; list of property.id values

  // Lifecycle
  status: "pending" | "active" | "revoked"
  inviteToken: string            // Unique random token; used in /invite/:token URL
  createdAt: Timestamp
  acceptedAt: Timestamp | null
}
```

**Filter evaluation logic:**
```ts
// scope = "filtered": include property if ALL filter entries match
filters.every(f => f.values.includes(property[f.field]))

// scope = "properties": include property if its id is in the list
propertyIds.includes(property.id)

// scope = "portfolio": include all properties
```

Filter evaluation is done **client-side** after loading all owner properties. This keeps Firestore security rules simple — they only need to allow/deny access to the entire `users/{ownerUid}/properties` collection.

---

## Firestore Security Rules (sketch)

```
// shares collection
match /shares/{shareId} {
  // Owner: full read/write on their own shares
  allow read, write: if request.auth.uid == resource.data.ownerUid;

  // Grantee: can read shares addressed to them (to check status)
  allow read: if request.auth.uid == resource.data.granteeUid;

  // Acceptance: grantee can set their uid + status on a pending share
  // Only the granteeUid, status, acceptedAt fields may be changed
  allow update: if request.auth.token.email == resource.data.granteeEmail
                && resource.data.status == "pending"
                && request.resource.data.diff(resource.data)
                    .affectedKeys().hasOnly(['granteeUid', 'status', 'acceptedAt']);
}

// Owner's properties: allow viewer read if an active share exists
match /users/{ownerUid}/properties/{propertyId} {
  allow read: if request.auth.uid == ownerUid
              || exists share in /shares where
                   share.ownerUid == ownerUid
                && share.granteeUid == request.auth.uid
                && share.status == "active";
}
```

---

## Routes

| Route | Description |
|-------|-------------|
| `/invite/:token` | Invite acceptance page — handles login redirect and share activation |
| `/settings` (Sharing tab) | Owner manages all active and pending shares |

---

## Invite Flow

### Owner side
1. Opens Sharing settings page → clicks **+ Invite viewer**
2. Fills invite modal: email address, scope, filters (if filtered view)
3. Live preview shows how many properties match the current filters
4. Clicks **Generate invite link**
5. App creates `shares` doc with `status: "pending"` and a random `inviteToken`
6. Modal shows the invite link with **Copy link** and **Open in email client** (mailto:) buttons
7. Owner sends the link manually to the viewer

### Viewer side (happy path)
1. Viewer clicks `/invite/{token}`
2. If not logged in → redirected to `/login?redirect=/invite/{token}` → login or sign up → redirected back
3. App looks up `shares` where `inviteToken == token`
4. Validates `granteeEmail == currentUser.email`
5. Sets `granteeUid`, `status: "active"`, `acceptedAt`
6. Redirected to portfolio dashboard
7. "Shared with me" section now shows the owner's portfolio card

### Edge cases

| Scenario | Behaviour |
|----------|-----------|
| Token not found | "This invite link is invalid." |
| Status = revoked or cancelled | "This invite is no longer valid. Ask the owner to send a new one." |
| Email mismatch (signed in as wrong account) | "This invite was sent to **{email}**. Please sign in with that address." |
| Viewer accepts same link twice | Idempotent — already active, redirect to dashboard silently |
| Owner revokes while viewer is browsing | Next data fetch blocked by security rule → app shows "Access to this portfolio has been removed" and redirects to viewer's own dashboard |
| Owner's account deleted | Share remains but properties collection gone — viewer sees 0 properties with empty state message |

---

## UI Components

### 1. Sharing Settings Page (`/settings` → Sharing tab)
- Page title: **Sharing & Access**
- Subtitle: "Control who can view your portfolio"
- **+ Invite viewer** button (top right) → opens invite modal
- Two sections: **Active** and **Pending** (with counts)
- Each share row shows: avatar initial, email, scope/filter summary, status badge
  - Active shares: **Revoke** button (red text)
  - Pending shares: **Copy link** button + **Cancel** button

### 2. Invite Modal
- Email address input
- Scope selector: **Filtered view** / **Full portfolio** / **Pick properties**
- Filter builder (visible when scope = "filtered"):
  - Each filter row: dimension dropdown (Owner / Country / City / Group) + multi-value tag input
  - **+ Add filter** button to add another AND dimension
- Live preview: "Viewer will see **N properties** matching: …"
- **Generate invite link** button

### 3. Invite Link Screen (shown after generation)
- Confirmation heading + invite email reminder
- Monospace display of the full invite URL
- **Copy link** button
- **Open in email client** button (mailto: with subject + body pre-filled)

### 4. "Shared with me" Section (viewer's own dashboard)
- Appears below the viewer's own portfolio content
- Section label: **SHARED WITH ME**
- Cards per share: owner name, property count, filter summary, **"view only"** badge
- Clicking a card loads the shared portfolio in read-only mode

### 5. Read-only Mode (when viewing a shared portfolio)
- Header shows: portfolio owner's name + **👁 View only** badge + active filter summary
- **← Back to my portfolio** button in the top right
- All add / edit / delete / settings buttons are hidden
- All filters and page navigation (tabs, property detail, etc.) work normally
- If access is revoked mid-session: show an inline alert and redirect to own dashboard

---

## What Is Not Changing

- No Cloud Functions or backend email sending
- No changes to existing property CRUD flows
- No changes to existing Firebase auth
- Existing users see no difference unless they are invited to a share
- Plan/entitlement system is unchanged — sharing is available to all plans

---

## Open Questions

_None — all decisions confirmed during design review._
