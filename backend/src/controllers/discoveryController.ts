import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import SearchHistory from '../models/SearchHistory'
import type { DiscoveryProvider } from '../discovery/provider'
import type { DiscoveryResult } from '../discovery/types'
import { historyDetail, normalizeCompanyName, permittedSnapshot, settleInterruptedSearches } from '../services/history'

export function executeDiscovery(provider: DiscoveryProvider) {
  return async (req: AuthenticatedRequest, res: Response) => {
    const originalQuery = req.body?.companyName
    const requestId = req.get('Idempotency-Key')
    if (typeof originalQuery !== 'string' || !originalQuery.trim() || originalQuery.length > 160) {
      res.status(400).json({ message: 'Enter a company name with 160 characters or fewer.' }); return
    }
    if (!requestId || !/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) {
      res.status(400).json({ message: 'A valid Idempotency-Key is required.' }); return
    }
    const user = req.user!.id
    await settleInterruptedSearches(user)
    let record
    try {
      record = await SearchHistory.create({ user, requestId, originalQuery,
        normalizedCompanyName: normalizeCompanyName(originalQuery),
        provenance: { provider: provider.name, source: provider.available ? 'approved-source' : 'disabled', snapshotVersion: 1 },
      })
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error
      const existing = await SearchHistory.findOne({ user, requestId })
      if (!existing) { res.status(409).json({ message: 'This search changed. Please start a new search.' }); return }
      if (existing.originalQuery !== originalQuery) { res.status(409).json({ message: 'This request key belongs to a different search.' }); return }
      res.status(existing.status === 'pending' ? 202 : 200).json(historyDetail(existing)); return
    }

    let result: DiscoveryResult | null = null
    let outcome: 'success' | 'no_matches' | 'provider_unavailable' | 'provider_error' = 'provider_unavailable'
    let message = 'Company discovery is not connected yet. No provider search was performed.'
    if (provider.available) {
      const controller = new AbortController()
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        const found = await Promise.race([
          provider.search(originalQuery.trim(), { signal: controller.signal }),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('Provider timed out')) }, 12_000) }),
        ])
        if (found && !provider.snapshotAllowed) throw new Error('Provider does not permit result snapshots')
        result = found ? permittedSnapshot(found) : null
        outcome = result ? 'success' : 'no_matches'
        message = result ? 'Company result saved.' : 'No matching company was found in the available source.'
      } catch {
        outcome = 'provider_error'
        message = 'The discovery provider could not complete this search.'
      } finally { clearTimeout(timeout); controller.abort() }
    }
    // The final write never upserts: a concurrent delete must stay deleted.
    const saved = await SearchHistory.findOneAndUpdate({ _id: record._id, user, status: 'pending' }, { $set: {
      status: outcome === 'success' || outcome === 'no_matches' ? 'completed' : 'failed',
      outcome, message, result, company: result?.company ?? null, target: result?.targetPerson ?? null,
      founders: result?.people?.filter(person => person.role === 'founder') ?? [],
    } }, { returnDocument: 'after', runValidators: true })
    if (!saved) { res.status(409).json({ message: 'This search was removed or interrupted before it completed.' }); return }
    res.status(201).json(historyDetail(saved))
  }
}
