import type { AuthenticatedRequest } from '../middleware/auth'
import type { HistoryDocument } from '../models/SearchHistory'
import type { DiscoveryResult } from '../discovery/types'
import { discoverIntroductionPaths } from '../network/discoverPaths'
import { historyDetail } from './history'

// Company/provider snapshots stay durable. Private network paths are computed
// from the current owned import, so replacement/deletion also removes them from
// subsequent history reads, without duplicating contact data into saved searches.
export async function historyWithIntroductions(record: HistoryDocument, actor: NonNullable<AuthenticatedRequest['user']>) {
  const detail = historyDetail(record)
  if (record.status !== 'completed') return detail
  const original = (record.matches?.length ? record.matches : record.result ? [record.result] : []) as DiscoveryResult[]
  const matches = await discoverIntroductionPaths(actor, original, record.provenance?.provider ?? '')
  return { ...detail, matches: record.matches?.length ? matches : [], result: record.result ? matches.find(match => match.company.id === record.result!.company.id) ?? null : null }
}
