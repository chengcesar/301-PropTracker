import { useAuth } from '../contexts/AuthContext'
import { useAppState } from '../context/useAppState'
import { getEffectiveLimits } from '../lib/planConfig'
import type { PlanId } from '../lib/planConfig'

export type Entitlements = {
  /** Whether the user can add another property right now */
  canAddProperty: boolean
  /** Whether the user can trigger an AI generation right now */
  canUseAi: boolean
  /**
   * Whether uploads (photos + documents) are allowed for a given property.
   * Pass the property's 0-based index in the owner's sorted-by-creation list.
   * Use `canUploadOnProperty(propertyIndex)`.
   */
  canUploadOnProperty: (propertyIndex: number) => boolean
  /** Resolved limits (after grants applied) */
  propertyLimit: number
  aiLimit: number
  uploadLimit: number
  /** Current usage */
  propertyCount: number
  aiGenerations: number
}

export function useEntitlements(): Entitlements {
  const auth = useAuth() as unknown as {
    plan?: PlanId
    grants?: { extraProperties?: number; extraAiGenerations?: number }
    aiGenerations?: number
  } | null

  const { properties } = useAppState()

  const plan = auth?.plan
  const grants = auth?.grants
  const aiGenerationsUsed = auth?.aiGenerations ?? 0

  const { propertyLimit, aiLimit, uploadLimit } = getEffectiveLimits(plan, grants)

  return {
    canAddProperty: properties.length < propertyLimit,
    canUseAi: aiGenerationsUsed < aiLimit,
    canUploadOnProperty: (idx: number) => idx < uploadLimit,
    propertyLimit,
    aiLimit,
    uploadLimit,
    propertyCount: properties.length,
    aiGenerations: aiGenerationsUsed,
  }
}
