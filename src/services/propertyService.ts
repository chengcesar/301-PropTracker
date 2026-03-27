import {
  collection,
  doc,
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
  await setDoc(propertyDoc(uid, property.id), property)
}

/** Delete a property document. */
export async function removePropertyDoc(uid: string, propertyId: number): Promise<void> {
  await deleteDoc(propertyDoc(uid, propertyId))
}
