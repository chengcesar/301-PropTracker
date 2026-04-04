import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '../lib/firebase'
import type { Property } from '../lib/types'

function propertiesCol(uid: string) {
  return collection(firestore!, 'users', uid, 'properties')
}

function propertyDoc(uid: string, propertyId: number) {
  return doc(firestore!, 'users', uid, 'properties', String(propertyId))
}

/** Preferences for portfolio bootstrap (same user doc tree as properties). */
function portfolioPrefsDoc(uid: string) {
  return doc(firestore!, 'users', uid, 'settings', 'portfolioPrefs')
}

export async function getPortfolioPrefs(uid: string): Promise<{ skipAutoSeed: boolean }> {
  try {
    const snap = await getDoc(portfolioPrefsDoc(uid))
    if (!snap.exists()) return { skipAutoSeed: false }
    const d = snap.data() as { skipAutoSeed?: boolean }
    return { skipAutoSeed: d.skipAutoSeed === true }
  } catch {
    return { skipAutoSeed: false }
  }
}

/** When true, empty Firestore will not receive automatic sample properties (e.g. user cleared the portfolio). */
export async function setPortfolioSkipAutoSeed(uid: string, skip: boolean): Promise<void> {
  await setDoc(portfolioPrefsDoc(uid), { skipAutoSeed: skip }, { merge: true })
}

/**
 * Firestore stores object keys as strings.
 * Convert string-keyed nested records back to number-keyed records.
 * Handles: months, services, customExpenseCats, hiddenExpenseCats
 */
function rehydrateNumericKeys(data: any): Property {
  if (data.months && typeof data.months === 'object') {
    const months: Record<number, Record<number, any>> = {}
    for (const [yearStr, yearData] of Object.entries(data.months)) {
      const yearNum = Number(yearStr)
      months[yearNum] = {}
      if (yearData && typeof yearData === 'object') {
        for (const [monthStr, monthData] of Object.entries(yearData as Record<string, any>)) {
          months[yearNum][Number(monthStr)] = monthData
        }
      }
    }
    data.months = months
  }

  if (data.services && typeof data.services === 'object') {
    const services: Record<number, any[]> = {}
    for (const [yearStr, entries] of Object.entries(data.services)) {
      services[Number(yearStr)] = entries as any[]
    }
    data.services = services
  }

  if (data.customExpenseCats && typeof data.customExpenseCats === 'object') {
    const cats: Record<number, string[]> = {}
    for (const [yearStr, entries] of Object.entries(data.customExpenseCats)) {
      cats[Number(yearStr)] = entries as string[]
    }
    data.customExpenseCats = cats
  }

  if (data.hiddenExpenseCats && typeof data.hiddenExpenseCats === 'object') {
    const cats: Record<number, string[]> = {}
    for (const [yearStr, entries] of Object.entries(data.hiddenExpenseCats)) {
      cats[Number(yearStr)] = entries as string[]
    }
    data.hiddenExpenseCats = cats
  }

  return data as Property
}

/** Subscribe to real-time updates for a user's properties. */
export function subscribeProperties(
  uid: string,
  onChange: (properties: Property[]) => void,
): Unsubscribe {
  return onSnapshot(propertiesCol(uid), (snap) => {
    const props = snap.docs.map((d) => rehydrateNumericKeys({ ...d.data() }))
    // Sort by id (creation timestamp) ascending
    props.sort((a, b) => a.id - b.id)
    onChange(props)
  })
}

/** Write or overwrite a property document. */
export async function saveProperty(uid: string, property: Property): Promise<void> {
  try {
    await setDoc(propertyDoc(uid, property.id), property)
  } catch (e) {
    console.error('Firestore saveProperty failed', property.id, e)
  }
}

/** Delete a property document. */
export async function removePropertyDoc(uid: string, propertyId: number): Promise<void> {
  await deleteDoc(propertyDoc(uid, propertyId))
}
