/**
 * Firebase Admin SDK setup for Vercel serverless functions.
 * Uses FIREBASE_SERVICE_ACCOUNT_JSON env var (JSON string of service account credentials).
 */
import admin from 'firebase-admin'

let _app = null

export function getAdminApp() {
  if (_app) return _app

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set')
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(serviceAccountJson)
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON')
  }

  if (admin.apps.length === 0) {
    _app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  } else {
    _app = admin.apps[0]
  }

  return _app
}

export function getAdminFirestore() {
  return getAdminApp().firestore()
}

/**
 * Look up a user by SHA-256 hash of their agent API key.
 * Returns { uid, email, ...userDoc } or null if not found.
 */
export async function findUserByApiKeyHash(keyHash) {
  const db = getAdminFirestore()
  const usersRef = db.collection('users')
  const snapshot = await usersRef.where('agentApiKeyHash', '==', keyHash).limit(1).get()

  if (snapshot.empty) {
    return null
  }

  const doc = snapshot.docs[0]
  return { uid: doc.id, ...doc.data() }
}
