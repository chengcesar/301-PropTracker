import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth as _getAuth, type Auth } from 'firebase/auth'
import { initializeFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function configIsComplete(): boolean {
  return Object.values(firebaseConfig).every(
    (v) => typeof v === 'string' && v.length > 0,
  )
}

export const isConfigured: boolean = configIsComplete()

let app: FirebaseApp | undefined
let _auth: Auth | undefined
let db: Firestore | undefined
let storage: FirebaseStorage | undefined

function getApp(): FirebaseApp | null {
  if (!isConfigured) return null
  if (!app) app = initializeApp(firebaseConfig)
  return app
}

// Eagerly initialize if configured (needed by AuthContext)
if (isConfigured) {
  const a = getApp()!
  _auth = _getAuth(a)
  /** Allow optional fields (e.g. occupant.notes) to be undefined without failing writes. */
  db = initializeFirestore(a, { ignoreUndefinedProperties: true })
}

/** Firebase Auth instance, or null if config is incomplete. */
export const auth: Auth | null = _auth ?? null

/** Firestore instance, or null if config is incomplete. */
export const firestore: Firestore | null = db ?? null

/** Call once Firestore reads/writes are wired; returns null until env is set. */
export function getFirestoreDb(): Firestore | null {
  return firestore
}

/** Returns Firebase Storage instance, or null if config is incomplete. */
export function getFirebaseStorage(): FirebaseStorage | null {
  const a = getApp()
  if (!a) return null
  if (!storage) storage = getStorage(a)
  return storage
}
