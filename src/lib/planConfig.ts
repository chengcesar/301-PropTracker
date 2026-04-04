/**
 * planConfig.ts — Plan definitions for PropTracker's paywall system.
 *
 * HOW TO ADD A NEW PLAN
 * ─────────────────────
 * 1. Add a new key to the `PLANS` object below.
 * 2. Fill in the limit fields (use `null` for unlimited).
 * 3. The new plan ID is immediately usable in Firestore `users/{uid}.plan`.
 * 4. No other files need to change — useEntitlements() reads from here.
 *
 * HOW GRANTS WORK
 * ───────────────
 * Admin grants are stored in Firestore as `users/{uid}.grants` and are
 * additive on top of the plan's base limit. If a plan has a null limit
 * (unlimited), grants are ignored for that dimension.
 *
 *   effective limit = plan.propertyLimit === null
 *     ? Infinity
 *     : plan.propertyLimit + (grants.extraProperties ?? 0)
 */

export type PlanId = keyof typeof PLANS

export type PlanDefinition = {
  /** Human-readable label shown in UI and admin panel */
  label: string
  /** One-line description shown in upgrade modal */
  description: string
  /** Max number of properties. null = unlimited. */
  propertyLimit: number | null
  /** Max cumulative AI report generations. null = unlimited. */
  aiLimit: number | null
  /**
   * How many properties get full image/document upload access.
   * null = all properties. 0 = none.
   * e.g. 5 means only the first 5 properties (by creation order) allow uploads.
   */
  uploadLimit: number | null
  /** Badge color shown in the admin panel */
  badgeColor: string
  /** Whether this plan is publicly selectable (false = internal/hidden) */
  public: boolean
}

export const PLANS = {
  /**
   * UNLIMITED — internal use only (you, testers, invited guests).
   * No caps on anything. Never shown in the upgrade modal.
   */
  unlimited: {
    label: 'Unlimited',
    description: 'Internal plan — no restrictions.',
    propertyLimit: null,
    aiLimit: null,
    uploadLimit: null,
    badgeColor: '#8b5cf6',  // purple
    public: false,
  },

  /**
   * FREE TRIAL — default for all new sign-ups.
   * Caps are intentionally low to encourage upgrade.
   * Edit the numbers here to change the global free tier limits.
   */
  free_trial: {
    label: 'Free',
    description: 'Get started with up to 5 properties and 5 AI reports.',
    propertyLimit: 5,       // ← edit to raise/lower the free property cap
    aiLimit: 5,             // ← edit to raise/lower the free AI cap
    uploadLimit: 5,         // ← only first 5 properties get image uploads
    badgeColor: '#6b7280',  // gray
    public: true,
  },

  /**
   * PRO — paid individual plan.
   */
  pro: {
    label: 'Pro',
    description: 'Up to 50 properties, unlimited AI reports, full uploads.',
    propertyLimit: 50,      // ← edit to raise/lower the Pro property cap
    aiLimit: null,          // unlimited
    uploadLimit: null,      // all properties
    badgeColor: '#3b82f6',  // blue
    public: true,
  },

  /**
   * ORGANIZATION — teams / firms with large portfolios.
   * Add pricing details here when Stripe is integrated.
   */
  organization: {
    label: 'Organization',
    description: 'Unlimited properties and AI reports for teams.',
    propertyLimit: null,    // unlimited
    aiLimit: null,          // unlimited
    uploadLimit: null,      // all properties
    badgeColor: '#0539FF',  // brand blue
    public: true,
  },
} as const satisfies Record<string, PlanDefinition>

/** The plan assigned to every new user on sign-up. */
export const DEFAULT_PLAN: PlanId = 'free_trial'

/**
 * Compute the effective limits for a user, factoring in their plan
 * and any admin-granted bonuses. Returns Infinity for unlimited dimensions.
 */
export function getEffectiveLimits(
  planId: PlanId | undefined,
  grants?: { extraProperties?: number; extraAiGenerations?: number }
) {
  const plan = PLANS[planId ?? DEFAULT_PLAN] ?? PLANS[DEFAULT_PLAN]

  const propertyLimit =
    plan.propertyLimit === null
      ? Infinity
      : plan.propertyLimit + (grants?.extraProperties ?? 0)

  const aiLimit =
    plan.aiLimit === null
      ? Infinity
      : plan.aiLimit + (grants?.extraAiGenerations ?? 0)

  const uploadLimit =
    plan.uploadLimit === null ? Infinity : plan.uploadLimit

  return { propertyLimit, aiLimit, uploadLimit }
}
