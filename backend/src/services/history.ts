import SearchHistory, { type HistoryDocument } from '../models/SearchHistory'
import type { DiscoveryResult, Person } from '../discovery/types'

export const normalizeCompanyName = (query: string) => query.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

export function historySummary(record: HistoryDocument) {
  return {
    id: record._id.toString(), originalQuery: record.originalQuery,
    normalizedCompanyName: record.normalizedCompanyName,
    searchedAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    status: record.status, outcome: record.outcome, message: record.message,
    company: record.company, target: record.target, founders: record.founders,
    provenance: record.provenance,
  }
}

export function historyDetail(record: HistoryDocument) {
  return { ...historySummary(record), result: record.result }
}

// A server interruption must not leave a search labelled "in progress" forever.
// Provider execution is capped at 12s; this lease leaves ample time for saving.
export async function settleInterruptedSearches(user: string) {
  await SearchHistory.updateMany({ user, status: 'pending', updatedAt: { $lt: new Date(Date.now() - 90_000) } }, {
    $set: { status: 'failed', outcome: 'provider_error', message: 'The search was interrupted before a result could be saved.' },
  })
}

function shortText(value: unknown, maximum: number, required = false): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    if (required) throw new Error('Missing result field')
    return undefined
  }
  if (value.length > maximum) throw new Error('Result field is too long')
  return value
}
function webUrl(value: unknown) {
  if (value == null) return undefined
  const text = shortText(value, 2048)
  if (!text) return undefined
  const url = new URL(text)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined
  return url.href
}
function personSnapshot(person: Person): Person {
  if (person.source !== 'approved-source' || person.isFixture) throw new Error('Unverified person')
  return {
    id: shortText(person.id, 200, true)!, name: shortText(person.name, 200, true)!,
    title: shortText(person.title, 300), role: person.role,
    imageUrl: webUrl(person.imageUrl), profileUrl: webUrl(person.profileUrl),
    source: 'approved-source', isCurrentUser: person.isCurrentUser === true,
  }
}

// Explicit projection prevents provider credentials, contact emails and arbitrary
// metadata from leaking into stored snapshots. It also rejects fixture results.
export function permittedSnapshot(result: DiscoveryResult): DiscoveryResult {
  if (result.source !== 'approved-source' || result.company?.source !== 'approved-source') throw new Error('Unverified company')
  const company = result.company
  const targetPerson = result.targetPerson ? personSnapshot(result.targetPerson) : undefined
  const people = (result.people ?? []).map(personSnapshot)
  if (targetPerson && !people.some(person => person.id === targetPerson.id)) people.push(targetPerson)
  if (people.length > 200 || (result.paths?.length ?? 0) > 100 || (result.connections?.length ?? 0) > 500) throw new Error('Result is too large')
  const ids = new Set(people.map(person => person.id))
  const paths = result.paths === null ? null : result.paths.map(path => {
    if (path.source !== 'approved-source' || path.isFixture || path.path.length < 2 || path.path.length > 20
      || path.path[0] !== path.startPersonId || path.path.at(-1) !== path.targetPersonId
      || new Set(path.path).size !== path.path.length || path.path.some(id => !ids.has(id))) throw new Error('Invalid path')
    const strength = path.calculatedStrength
    if (strength && (!Number.isFinite(strength.score) || strength.score < 0 || strength.score > 1 || !strength.explanation?.trim())) throw new Error('Invalid strength')
    return {
      id: shortText(path.id, 200, true)!, startPersonId: path.startPersonId, targetPersonId: path.targetPersonId,
      path: [...path.path], explanation: shortText(path.explanation, 2000), source: 'approved-source' as const,
      ...(strength ? { calculatedStrength: { score: strength.score, explanation: shortText(strength.explanation, 2000, true)! } } : {}),
    }
  })
  const connections = result.connections?.map(connection => {
    if (connection.source !== 'approved-source' || !ids.has(connection.fromPersonId) || !ids.has(connection.toPersonId)
      || !['direct', 'warm', 'introduced', 'vouched', 'unknown'].includes(connection.relationship)) throw new Error('Invalid connection')
    return {
      id: shortText(connection.id, 200, true)!, fromPersonId: connection.fromPersonId, toPersonId: connection.toPersonId,
      relationship: connection.relationship, notes: shortText(connection.notes, 2000), source: 'approved-source' as const,
    }
  })
  if (!Number.isFinite(Date.parse(result.generatedAt))) throw new Error('Invalid result date')
  return {
    company: { id: shortText(company.id, 200, true)!, name: shortText(company.name, 200, true)!,
      description: shortText(company.description, 5000), industry: shortText(company.industry, 200),
      website: webUrl(company.website), logoUrl: webUrl(company.logoUrl), source: 'approved-source' },
    targetPerson, people, paths, connections, source: 'approved-source', generatedAt: result.generatedAt,
    warnings: (result.warnings ?? []).slice(0, 20).map(warning => shortText(warning, 1000, true)!),
  }
}
