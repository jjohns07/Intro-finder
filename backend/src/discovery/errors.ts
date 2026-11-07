export type ProviderFailure = 'provider_error' | 'provider_timeout' | 'rate_limited' | 'provider_access_denied' | 'quota_exceeded'
const messages: Record<ProviderFailure, string> = {
  provider_error: 'The discovery provider could not complete this search.',
  provider_timeout: 'The discovery provider did not respond in time.',
  rate_limited: 'Discovery has reached its request limit. Please try again later.',
  provider_access_denied: 'The discovery provider rejected access. The service configuration needs attention.',
  quota_exceeded: 'The discovery provider has no search credits available.',
}
export class ProviderError extends Error {
  constructor(readonly code: ProviderFailure, readonly retryAfterSeconds?: number) {
    super(messages[code]); this.name = 'ProviderError'
  }
}
export const providerError = (error: unknown) => error instanceof ProviderError ? error : new ProviderError('provider_error')
