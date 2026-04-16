import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
// Note: query/where/getDocs are still used by subscribeOwnerShares, subscribeViewerShares, revokeShare
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
    granteeEmail: input.granteeEmail.toLowerCase().trim(),
    granteeUid: null,
    status: 'pending',
    inviteToken,
    createdAt: serverTimestamp(),
    acceptedAt: null,
  })
  // Write a token-index doc so getShareByToken can use getDoc instead of a collection query.
  // Collection queries with resource.data-based rules are rejected by Firestore.
  await setDoc(doc(firestore!, 'inviteTokens', inviteToken), { shareId: ref.id })

  // Trigger invite email via the Firebase Trigger Email extension.
  const inviteUrl = `${window.location.origin}/invite/${inviteToken}`
  const sharedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  await addDoc(collection(firestore!, 'mail'), {
    to: input.granteeEmail.toLowerCase().trim(),
    message: {
      subject: `${input.ownerDisplayName} shared their portfolio with you`,
      html: `
        <p>Hi,</p>
        <p><strong>${input.ownerDisplayName}</strong> has invited you to view their portfolio <strong>${input.ownerPortfolioName}</strong> on PropTracker.</p>
        <p><strong>Date shared:</strong> ${sharedDate}</p>
        <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Portfolio</a></p>
        <p style="color:#6b7280;font-size:13px;">Or copy this link: ${inviteUrl}</p>
      `,
    },
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

/** Look up a share by its invite token (used on /invite/:token).
 *  Uses a two-step lookup via inviteTokens/{token} so no collection query is needed.
 *  Firestore rejects collection queries where the rule references resource.data fields
 *  not covered by the query's WHERE clause. */
export async function getShareByToken(token: string): Promise<Share | null> {
  const tokenSnap = await getDoc(doc(firestore!, 'inviteTokens', token))
  if (!tokenSnap.exists()) return null
  const shareId = tokenSnap.data().shareId as string
  try {
    const shareSnap = await getDoc(shareDoc(shareId))
    if (!shareSnap.exists()) return null
    return toShare(shareSnap.id, shareSnap.data())
  } catch {
    // Permission denied: current user is neither owner nor grantee — treat as not found
    return null
  }
}

/** Accept a pending invite — sets granteeUid and marks active. Creates viewer doc in owner's viewers subcollection for security rules. */
export async function acceptShare(shareId: string, granteeUid: string): Promise<void> {
  console.log('[acceptShare] loading share', shareId)
  const share = await getShare(shareId)
  if (!share) { console.warn('[acceptShare] share not found'); return }
  console.log('[acceptShare] share loaded, ownerUid=', share.ownerUid, 'granteeEmail=', share.granteeEmail)
  try {
    await updateDoc(shareDoc(shareId), {
      granteeUid,
      status: 'active',
      acceptedAt: serverTimestamp(),
    })
    console.log('[acceptShare] share doc updated OK')
  } catch (err) {
    console.error('[acceptShare] updateDoc(share) FAILED:', err)
    throw err
  }
  try {
    await setDoc(doc(firestore!, 'users', share.ownerUid, 'viewers', granteeUid), { active: true })
    console.log('[acceptShare] viewer doc created OK')
  } catch (err) {
    console.error('[acceptShare] setDoc(viewers) FAILED:', err)
    throw err
  }
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
        deleteDoc(doc(firestore!, 'users', share.ownerUid, 'viewers', share.granteeUid)),
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
