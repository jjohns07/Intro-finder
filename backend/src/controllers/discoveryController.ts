import { createHash } from 'node:crypto'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import SearchHistory from '../models/SearchHistory'
import type { DiscoveryProvider } from '../discovery/provider'
import type { CompanyMatchMode, DiscoveryResult } from '../discovery/types'
import { ProviderError, providerError } from '../discovery/errors'
import { validQuery } from '../discovery/validation'
import { historyDetail, normalizeCompanyName, permittedSnapshot, settleInterruptedSearches } from '../services/history'

type Outcome = 'success' | 'ambiguous' | 'no_matches' | 'invalid_query' | 'provider_unavailable' | ProviderError['code']
const responseStatus = (outcome: string | null | undefined) => ({ invalid_query: 400, provider_unavailable: 503,
  provider_error: 502, rate_limited: 429, provider_timeout: 504, provider_access_denied: 503, quota_exceeded: 503 }[outcome ?? ''] ?? 200)

export function executeDiscovery(provider: DiscoveryProvider) {
  return async (req: AuthenticatedRequest, res: Response) => {
    const input: unknown = req.body?.companyName
    const requestId = req.get('Idempotency-Key')
    if (!requestId || !/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) {
      res.status(400).json({ message: 'A valid Idempotency-Key is required.' }); return
    }
    const valid = validQuery(input)
    // Invalid API submissions are recorded too. Never persist arbitrary request bodies.
    const displayQuery = typeof input === 'string' ? input.replace(/[\p{Cc}\p{Cf}]/gu, '').slice(0, 160) : ''
    const originalQuery = displayQuery.trim() ? displayQuery : '[invalid company name]'
    const fingerprint = createHash('sha256').update(JSON.stringify(input ?? null)).digest('hex')
    const user = req.user!.id
    await settleInterruptedSearches(user)
    let record
    try {
      record = await SearchHistory.create({ user, requestId, originalQuery, queryFingerprint: fingerprint,
        normalizedCompanyName: normalizeCompanyName(originalQuery).slice(0, 320),
        provenance: { provider: provider.name, source: provider.available ? 'approved-source' : 'disabled', snapshotVersion: 2 },
      })
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error
      const existing = await SearchHistory.findOne({ user, requestId })
      if (!existing) { res.status(409).json({ message: 'This search changed. Please start a new search.' }); return }
      if (existing.queryFingerprint ? existing.queryFingerprint !== fingerprint : existing.originalQuery !== originalQuery) {
        res.status(409).json({ message: 'This request key belongs to a different search.' }); return
      }
      if (existing.retryAfterSeconds) res.set('Retry-After', String(existing.retryAfterSeconds))
      res.status(existing.status === 'pending' ? 202 : responseStatus(existing.outcome)).json(historyDetail(existing)); return
    }

    let matches: DiscoveryResult[] = []
    let totalMatches = 0
    let matchMode: CompanyMatchMode | undefined
    let retryAfterSeconds: number | undefined
    let outcome: Outcome = valid ? 'provider_unavailable' : 'invalid_query'
    let message = valid ? provider.configurationMessage ?? 'Company discovery is not configured. No provider search was performed.'
      : 'Enter a company name with 2–160 characters, without control characters.'
    if (valid && provider.available && provider.snapshotAllowed) {
      const controller = new AbortController()
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        const found = await Promise.race([
          provider.search(normalizeCompanyName(input), { signal: controller.signal }),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new ProviderError('provider_timeout')) }, 15_000) }),
        ])
        if (!Array.isArray(found.matches) || found.matches.length > 5 || !Number.isSafeInteger(found.total)
          || found.total < found.matches.length || (found.total > 0 && !found.matches.length)
          || !['exact', 'prefix', 'relevance'].includes(found.matchMode)) throw new ProviderError('provider_error')
        matches = found.matches.map(permittedSnapshot)
        totalMatches = found.total
        matchMode = found.matchMode
        outcome = !totalMatches ? 'no_matches' : totalMatches > 1 || matchMode !== 'exact' ? 'ambiguous' : 'success'
        message = !totalMatches ? 'No matching company was found in this source.'
          : outcome === 'ambiguous' ? 'Review the possible company matches. No company has been selected automatically.' : 'Company result saved.'
      } catch (error) {
        const failure = providerError(error)
        outcome = failure.code; message = failure.message; retryAfterSeconds = failure.retryAfterSeconds
      } finally { clearTimeout(timeout); controller.abort() }
    }
    const result = outcome === 'success' ? matches[0] : null
    const completed = ['success', 'ambiguous', 'no_matches'].includes(outcome)
    // Never upsert: a concurrent delete must stay deleted.
    const saved = await SearchHistory.findOneAndUpdate({ _id: record._id, user, status: 'pending' }, { $set: {
      status: completed ? 'completed' : 'failed', outcome, message, result, matches, totalMatches, matchMode, retryAfterSeconds,
      company: result?.company ?? null, target: null,
      founders: matches.flatMap(match => match.people?.filter(person => person.role === 'founder') ?? []),
      candidateCount: matches.reduce((total, match) => total + (match.people?.length ?? 0), 0),
    } }, { returnDocument: 'after', runValidators: true })
    if (!saved) { res.status(409).json({ message: 'This search was removed or interrupted before it completed.' }); return }
    if (retryAfterSeconds) res.set('Retry-After', String(retryAfterSeconds))
    res.status(completed ? 201 : responseStatus(outcome)).json(historyDetail(saved))
  }
}
