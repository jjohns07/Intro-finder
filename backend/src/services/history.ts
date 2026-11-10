import SearchHistory, { type HistoryDocument } from '../models/SearchHistory'
import type { Company, CompanyDetails, DiscoveryResult, Person } from '../discovery/types'
import { dateField, domainField, integerField, normalizeQuery, timestampField } from '../discovery/validation'

export const normalizeCompanyName = normalizeQuery

export function historySummary(record: HistoryDocument) {
  return {
    id: record._id.toString(), originalQuery: record.originalQuery,
    normalizedCompanyName: record.normalizedCompanyName,
    searchedAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    status: record.status, outcome: record.outcome, message: record.message,
    company: record.company, target: record.target, founders: record.founders,
    provenance: record.provenance,
    totalMatches: record.totalMatches,
    candidateCount: record.candidateCount,
  }
}

export function historyDetail(record: HistoryDocument) {
  return { ...historySummary(record), result: record.result, matches: record.matches,
    matchMode: record.matchMode, retryAfterSeconds: record.retryAfterSeconds }
}

// A server interruption must not leave a search labelled "in progress" forever.
// Provider execution is capped at 15s; this lease leaves ample time for saving.
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
  if (person.role && !['founder', 'executive', 'operator', 'investor', 'team-member', 'advisor', 'unknown'].includes(person.role)) throw new Error('Invalid role')
  if (person.verification && (person.verification.confidence !== 'provider-supported' || !person.evidence?.length)) throw new Error('Unsupported verification')
  return {
    id: shortText(person.id, 200, true)!, name: shortText(person.name, 200, true)!,
    title: shortText(person.title, 300), role: person.role,
    imageUrl: webUrl(person.imageUrl), profileUrl: webUrl(person.profileUrl),
    source: 'approved-source', isCurrentUser: person.isCurrentUser === true,
    companyId: shortText(person.companyId, 200),
    evidence: person.evidence?.slice(0, 30).map(item => {
      if (!['current', 'historical', 'unknown'].includes(item.affiliation)
        || (item.sourceCount !== undefined && (!Number.isSafeInteger(item.sourceCount) || item.sourceCount < 1))) throw new Error('Invalid employment evidence')
      return { provider: shortText(item.provider, 100, true)!, recordId: shortText(item.recordId, 200, true)!,
        field: shortText(item.field, 100, true)!, companyId: shortText(item.companyId, 200, true)!, title: shortText(item.title, 300, true)!,
        affiliation: item.affiliation, startDate: dateField(item.startDate), endDate: dateField(item.endDate), lastSeen: dateField(item.lastSeen),
        sourceCount: item.sourceCount, profileUrl: webUrl(item.profileUrl) }
    }),
    ...(person.verification ? { verification: {
      confidence: 'provider-supported' as const,
      explanation: shortText(person.verification.explanation, 1000, true)!, limitation: shortText(person.verification.limitation, 1000, true)!,
    } } : {}),
  }
}

function companySnapshot(company: Company): Company {
  if (company.source !== 'approved-source') throw new Error('Unverified company')
  if (company.attribution && (company.attribution.recordId !== company.id || !Number.isFinite(Date.parse(company.attribution.retrievedAt))
    || company.attribution.reliability !== 'aggregated-provider-data')) throw new Error('Invalid attribution')
  return {
    id: shortText(company.id, 200, true)!, name: shortText(company.name, 200, true)!,
    description: shortText(company.description, 20_000), industry: shortText(company.industry, 200),
    website: webUrl(company.website), logoUrl: webUrl(company.logoUrl), source: 'approved-source',
    location: shortText(company.location, 1000), country: shortText(company.country, 200),
    city: shortText(company.city, 200), region: shortText(company.region, 200), domain: domainField(company.domain),
    employeeRange: shortText(company.employeeRange, 100), linkedinEmployeeCount: integerField(company.linkedinEmployeeCount),
    legalName: shortText(company.legalName, 300), companyType: shortText(company.companyType, 200),
    foundedYear: integerField(company.foundedYear, 1, 9999), activityStatus: shortText(company.activityStatus, 200),
    profileUrl: webUrl(company.profileUrl),
    ...(company.attribution ? { attribution: { provider: shortText(company.attribution.provider, 100, true)!,
      recordId: shortText(company.attribution.recordId, 200, true)!, retrievedAt: shortText(company.attribution.retrievedAt, 40, true)!,
      reliability: 'aggregated-provider-data' as const } } : {}),
  }
}

export function companyDetailsSnapshot(details: CompanyDetails, companyId: string): CompanyDetails {
  if (!['available', 'unavailable', 'not_configured', 'provider_error', 'provider_timeout', 'rate_limited', 'provider_access_denied', 'quota_exceeded'].includes(details.status)
    || (details.company && details.company.id !== companyId)
    || (details.status === 'available' && !details.company)
    || (details.status === 'unavailable' && details.company)
    || !timestampField(details.checkedAt)) throw new Error('Invalid company details')
  if (details.descriptionField && (!['description', 'description_short', 'meta_description'].includes(details.descriptionField)
    || !details.company?.description)) throw new Error('Invalid description source')
  if (details.profileSource && !['firmographics', 'snapshot'].includes(details.profileSource)) throw new Error('Invalid profile source')
  if (details.enrichmentStatus && (details.profileSource !== 'snapshot'
    || !['provider_error', 'provider_timeout', 'rate_limited', 'provider_access_denied', 'quota_exceeded'].includes(details.enrichmentStatus))) throw new Error('Invalid enrichment status')
  if (details.profileSource === 'snapshot' && (details.descriptionField || details.company?.description)) throw new Error('Snapshot cannot supply a description')
  const snapshot: CompanyDetails = {
    status: details.status, ...(details.company ? { company: companySnapshot(details.company) } : {}),
    checkedAt: details.checkedAt, retrievedAt: timestampField(details.retrievedAt),
    providerUpdatedAt: timestampField(details.providerUpdatedAt), expiresAt: timestampField(details.expiresAt),
    cached: details.cached === true, descriptionField: details.descriptionField,
    profileSource: details.profileSource, enrichmentStatus: details.enrichmentStatus,
    retryAfterSeconds: integerField(details.retryAfterSeconds, 1, 86_400),
  }
  // MongoDB Mixed updates otherwise serialize nested undefined values as null.
  // Store the same optional-field contract that JSON sends to the browser.
  return JSON.parse(JSON.stringify(snapshot)) as CompanyDetails
}

// Explicit projection prevents provider credentials, contact emails and arbitrary
// metadata from leaking into stored snapshots. It also rejects fixture results.
export function permittedSnapshot(result: DiscoveryResult): DiscoveryResult {
  if (result.source !== 'approved-source' || result.company?.source !== 'approved-source') throw new Error('Unverified company')
  const company = result.company
  if (result.peopleStatus && !['available', 'no_candidates', 'not_configured', 'rate_limited', 'provider_error', 'provider_timeout', 'provider_access_denied', 'quota_exceeded'].includes(result.peopleStatus)) throw new Error('Invalid people status')
  const targetPerson = result.targetPerson ? personSnapshot(result.targetPerson) : undefined
  const people = (result.people ?? []).map(personSnapshot)
  if (targetPerson && !people.some(person => person.id === targetPerson.id)) people.push(targetPerson)
  if (people.some(person => person.evidence?.some(item => item.companyId !== company.id || item.recordId !== person.id))) throw new Error('Mismatched person evidence')
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
  if (paths?.some(path => path.path.slice(0, -1).some((id, index) => !connections?.some(connection =>
    connection.fromPersonId === id && connection.toPersonId === path.path[index + 1] && connection.relationship !== 'unknown')))) throw new Error('Path lacks relationship evidence')
  if (!Number.isFinite(Date.parse(result.generatedAt))) throw new Error('Invalid result date')
  return {
    company: companySnapshot(company),
    ...(result.companyDetails ? { companyDetails: companyDetailsSnapshot(result.companyDetails, company.id) } : {}),
    targetPerson, people, paths, connections, source: 'approved-source', generatedAt: result.generatedAt,
    warnings: (result.warnings ?? []).slice(0, 20).map(warning => shortText(warning, 1000, true)!),
    peopleStatus: result.peopleStatus, peopleTruncated: result.peopleTruncated === true,
    connectionStatus: result.connectionStatus === 'unavailable' ? 'unavailable' : undefined,
  }
}
