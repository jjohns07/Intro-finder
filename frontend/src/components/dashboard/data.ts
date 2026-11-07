// View contracts for future authenticated data. No dashboard endpoint is
// configured yet; null means unavailable, while [] means a known empty result.
export type ActivityPeriod = '30' | '90'
export type ActivityPoint = {
  label: string
  connections: number | null
  opportunities: number | null
  searches: number | null
}
export type ActivityData = Partial<Record<ActivityPeriod, readonly ActivityPoint[]>>

export type PlatformIntegration = {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'not-configured' | 'unavailable'
  connectionCount?: number | null
}

export type NetworkDistribution = { label: string; count: number }

export type RecentSearch = {
  id: string
  company: { name: string; logoUrl?: string }
  target?: { name: string; title?: string }
  searchedAt?: string
  status: 'completed' | 'pending' | 'failed'
}

export type IntroductionOpportunity = {
  id: string
  company: { name: string; logoUrl?: string }
  target: { name: string; title?: string }
  // Complete, ordered path supplied by discovery: viewer through to target.
  path: readonly { id: string; name: string; title?: string }[]
  // Only provide a strength that the backend calculated, with its explanation.
  strength?: { score: number; explanation: string }
}
