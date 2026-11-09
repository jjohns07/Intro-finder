import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { DiscoveryProvider } from '../discovery/provider'
import type { CompanyDetails, DiscoveryResult } from '../discovery/types'
import { providerError } from '../discovery/errors'
import SearchHistory, { type HistoryDocument } from '../models/SearchHistory'
import { companyDetailsSnapshot } from '../services/history'

export function loadCompanyDetails(provider: DiscoveryProvider) {
  const pending = new Map<string, Promise<CompanyDetails | null>>()

  async function enrich(record: HistoryDocument, match: DiscoveryResult, refresh: boolean, inMatches: boolean) {
    let details: CompanyDetails
    try {
      details = companyDetailsSnapshot(await provider.getCompanyDetails!(match.company, {
        refresh, signal: AbortSignal.timeout(10_000),
      }), match.company.id)
    } catch (error) {
      const failure = providerError(error)
      // Keep the last successful profile visible, with its original source date.
      details = companyDetailsSnapshot({ ...match.companyDetails, status: failure.code, cached: false,
        expiresAt: undefined, checkedAt: new Date().toISOString(), retryAfterSeconds: failure.retryAfterSeconds }, match.company.id)
    }
    const changes: Record<string, unknown> = { 'provenance.snapshotVersion': 3 }
    if (inMatches) changes['matches.$.companyDetails'] = details
    if (record.result?.company.id === match.company.id) changes['result.companyDetails'] = details
    // Patch only this company's profile. Never replace people, other matches, or
    // a saved outcome, and never recreate a record deleted while the API ran.
    const updated = await SearchHistory.updateOne({ _id: record._id, user: record.user, status: 'completed',
      ...(inMatches ? { 'matches.company.id': match.company.id } : { 'result.company.id': match.company.id }),
    }, { $set: changes }, { runValidators: true })
    return updated.matchedCount ? details : null
  }

  return async (req: AuthenticatedRequest, res: Response) => {
    const { searchId, companyId, refresh = false } = req.body ?? {}
    if (typeof searchId !== 'string' || !/^[a-f\d]{24}$/i.test(searchId)
      || typeof companyId !== 'string' || !companyId.trim() || companyId.length > 200
      || typeof refresh !== 'boolean') {
      res.status(400).json({ message: 'A saved search ID, company ID and optional refresh flag are required.' }); return
    }
    const record = await SearchHistory.findOne({ _id: searchId, user: req.user!.id, status: 'completed' })
    const matches = (record?.matches ?? []) as DiscoveryResult[]
    const fromMatches = matches.find(match => match.company.id === companyId)
    const match = fromMatches ?? (record?.result?.company.id === companyId ? record.result : undefined)
    if (!record || !match) { res.status(404).json({ message: 'This company was not found in your saved search.' }); return }
    if (!provider.available || !provider.snapshotAllowed || !provider.getCompanyDetails || record.provenance?.provider !== provider.name) {
      res.json(companyDetailsSnapshot({ ...match.companyDetails, status: 'not_configured', cached: false,
        expiresAt: undefined, checkedAt: new Date().toISOString() }, companyId)); return
    }
    const key = `${req.user!.id}:${searchId}:${companyId}`
    let work = pending.get(key)
    if (!work) {
      work = enrich(record, match, refresh, Boolean(fromMatches)).finally(() => { pending.delete(key) })
      pending.set(key, work)
    }
    const details = await work
    if (!details) { res.status(409).json({ message: 'This search was removed before company details could be saved.' }); return }
    if (details.retryAfterSeconds) res.set('Retry-After', String(details.retryAfterSeconds))
    // The optional provider request has its own explicit outcome. The original
    // successful search and its founder/executive results remain successful.
    res.json(details)
  }
}
