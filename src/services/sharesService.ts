import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
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
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return toShare(d.id, d.data())
}

/** Accept a pending invite — sets granteeUid and marks active. Also adds viewer to owner's viewers array for security rules. */
export async function acceptShare(shareId: string, granteeUid: string): Promise<void> {
  const share = await getShare(shareId)
  if (!share) return
  await Promise.all([
    updateDoc(shareDoc(shareId), {
      granteeUid,
      status: 'active',
      acceptedAt: serverTimestamp(),
    }),
    updateDoc(doc(firestore!, 'users', share.ownerUid), {
      viewers: arrayUnion(granteeUid),
    }),
  ])
}

/** Owner revokes an active share. Only removes viewer from owner's viewers array if no other active share remains for them. */
export async function revokeShare(shareId: string): Promise<void> {
  const share = await getShare(shareId)
  if (!share) return
  const ops: Promise<void>[] = [
    updateDoc(shareDoc(shareId), { status: 'revoked' }),
  ]
  if (share.granteeUid) {
    const otherSnap = await getDocs(query(
      sharesCol(),
      where('ownerUid', '==', share.ownerUid),
      where('granteeUid', '==', share.granteeUid),
      where('status', '==', 'active'),
    ))
    const otherActive = otherSnap.docs.filter((d) => d.id !== shareId)
    if (otherActive.length === 0) {
      ops.push(
        updateDoc(doc(firestore!, 'users', share.ownerUid), {
          viewers: arrayRemove(share.granteeUid),
        }),
      )
    }
  }
  await Promise.all(ops)
}

/** Owner cancels a pending share (before it is accepted). */
export async function cancelShare(shareId: string): Promise<void> {
  await updateDoc(shareDoc(shareId), { status: 'revoked' })
}

/** Load a single share by ID. */
export async function getShare(shareId: string): Promise<Share | null> {
  const snap = await getDoc(shareDoc(shareId))
  if (!snap.exists()) return null
  return toShare(snap.id, snap.data())
}
