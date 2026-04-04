# Tech stack and data layer — developer context

This document summarizes **what the app is built with** and **how data is stored and accessed**, so you can reason about **performance, cost, and schema changes** without spelunking the whole repo. For product/domain background, see `PROJECT_CONTEXT.md` and `PROPFLOW_CONTEXT.md`.

---

## Application stack

| Layer | Technology | Notes |
|--------|-------------|--------|
| UI | **React 19** | Mix of `.tsx` and `.jsx` |
| Routing | **react-router-dom** v7 | |
| Build / dev | **Vite** 8, **TypeScript** 5.9 | `npm run dev` / `build` |
| Styling | **Tailwind CSS** 4 (`@tailwindcss/vite`) | Follow project design system (`skills/design-system.md` / `CLAUDE.md`) |
| Charts | **Recharts** | |
| Maps | **react-map-gl**, **mapbox-gl**, **maplibre-gl**, **deck.gl**, **supercluster** | Map providers are separate from persistence |
| AI (optional) | **@anthropic-ai/sdk** | API key via `VITE_ANTHROPIC_API_KEY` (see `.env.example`) |

---

## Backend and persistence (there is no separate SQL server)

The app is a **client-rendered SPA** that talks **directly to Firebase** from the browser using the **Firebase JS SDK** (`firebase` v12).

| Firebase product | Role in this repo |
|------------------|-------------------|
| **Firebase Authentication** | Sign-in; user identity drives Firestore paths |
| **Cloud Firestore** | Primary database for users and properties |
| **Firebase Storage** | Photos/files (`src/lib/photoStorage.ts`) |

**Configuration:** `src/lib/firebase.ts` reads `VITE_FIREBASE_*` from `.env` (see `.env.example`). Firestore is initialized with `initializeFirestore(..., { ignoreUndefinedProperties: true })` so sparse nested fields (e.g. `occupant.notes`) do not break writes.

There are **no Prisma/Drizzle/TypeORM layers** and **no Cloud Functions** in this repository—the data model is enforced in app code and (must be) in **Firestore security rules** in the Firebase console.

---

## Firestore layout (actual paths used in code)

```
users/{uid}                    ← user profile doc (roles, prefs, counters, etc.)
users/{uid}/properties/{id}    ← one document per property (large structured object)
```

- Property document IDs are **strings** of a numeric `id` (see `propertyService.ts`).
- The in-app `Property` shape and nested types live in `src/lib/types.ts`.

---

## How the app reads and writes data

| Operation | Where | Pattern |
|-----------|--------|---------|
| Subscribe to all properties for the signed-in user | `src/services/propertyService.ts` | `onSnapshot` on `users/{uid}/properties` — **full subcollection stream** |
| Save one property | `propertyService.ts` | `setDoc` **whole document** |
| Delete one property | `propertyService.ts` | `deleteDoc` |
| Load user profile / admin flag | `src/contexts/AuthContext.jsx` | `getDoc` / `setDoc` / `updateDoc` on `users/{uid}` |
| Admin: list all users and their properties | `src/pages/AdminPage.tsx` | `getDocs(users)` then **nested** `getDocs(users/{id}/properties)` per user |

Implications:

- The main UX path **downloads every property document** for the user whenever the listener runs or documents change.
- Admin tooling can trigger **N+1 reads** (one properties read per user), which does not scale linearly with user count.

---

## Optimizing database management (Firestore-specific)

These recommendations apply **because** the stack is **Firestore from the client**, not because a generic SQL tuning guide says so.

### 1. Document size and shape

- Firestore documents are capped at **1 MiB**. Property docs embed **months**, **contracts**, **capex**, etc. If users accumulate many years of monthly data, watch **document size** and **write bandwidth** (each `setDoc` sends the full document).
- **Mitigation ideas:** split time-series or heavy blobs into **subcollections** (e.g. `properties/{id}/months/{year}`), or archive old years to separate docs; use Storage for large binary assets, not inline fields.

### 2. Reads vs real-time listeners

- `onSnapshot` on the whole `properties` collection is simple and accurate but charges **reads** on initial attach and on **each document change**. For large portfolios, consider:
  - **Pagination** / windowed queries (`limit`, `startAfter`) if the UI can tolerate it.
  - **Detaching** listeners when views are unmounted (already using Firebase `Unsubscribe`—ensure all call sites dispose).
  - Replacing live listeners with **explicit `getDocs`** where freshness is not critical.

### 3. Queries and indexes

- Current code mostly loads **entire collections** without `where` / `orderBy`. Complex filtering is done **in memory** after fetch.
- If you add server-side filters or sorts, plan **composite indexes** in the Firebase console (build errors will link to the index creator).

### 4. Writes

- Prefer **`updateDoc` with dot paths** or **`FieldValue` mutations** for small field changes instead of rewriting a multi-megabyte document—*if* you refactor to a flatter or sharded schema.
- For multi-document consistency, use **batched writes** or **transactions** (not yet central in this codebase).

### 5. Security and admin access

- Treat **security rules** as part of the schema: they determine what a client can read/write.
- Admin pages that traverse all users must be **authenticated admin only** at the rules layer; client-side checks are not enough.

### 6. Cost and operations visibility

- Use **Firebase console → Usage** and **Cloud Monitoring** for read/write/listener patterns.
- Very large exports or analytics may belong in **BigQuery export** (optional Firebase extension) rather than widening client queries.

### 7. No migration framework on-site

- Schema evolution is **application-defined**. Coordinate changes across:
  - `src/lib/types.ts`
  - serializers/helpers (e.g. `rehydrateNumericKeys` in `propertyService.ts`)
  - any one-off migration scripts (you would add these; none are standard in-repo today)

---

## Quick file map for data work

| File | Purpose |
|------|---------|
| `src/lib/firebase.ts` | App initialization, Auth, Firestore, Storage accessors |
| `src/services/propertyService.ts` | Property CRUD + realtime subscription + Firestore key rehydration |
| `src/contexts/AuthContext.jsx` | User doc lifecycle, role/admin helpers |
| `src/pages/AdminPage.tsx` | Cross-user Firestore reads (admin) |
| `src/lib/photoStorage.ts` | Storage uploads/paths |
| `src/lib/types.ts` | Domain types for property graph |

---

## Summary

**PropTracker (propflow)** is a **Vite + React** SPA using **Firebase Auth, Firestore, and Storage**. The database is **Firestore**, not PostgreSQL/MySQL; “optimization” means **document sizing, read patterns, listeners, indexes, security rules, and batching**— not traditional connection pooling or SQL explain plans. Use this doc as the bridge between generic product context and concrete code paths when changing how portfolio data is stored or fetched.
