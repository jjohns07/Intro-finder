import type { DiscoveryProvider } from '../provider'
import type { Company, DiscoveryResult, DiscoverySearchResult, EmploymentEvidence, Person } from '../types'
import { ProviderError, providerError } from '../errors'
import { arrayField, dateField, normalizeQuery, object, optionalObject, textField, urlField } from '../validation'

const PROVIDER = 'People Data Labs'
const COMPANY_LIMIT = 5
const PEOPLE_LIMIT = 5
const LIMITATION = 'Aggregated provider data; original sources were not independently checked. Titles and affiliations may be outdated.'

// A role segment, not “founder’s associate”, “founding engineer”, or a biography.
// The affiliation ID must also match; title levels alone cannot prove founding.
function founderTitle(title: string) {
  return title.toLowerCase().split(/[,/&]|\band\b/).some(part => /^(co[- ]?)?founder$/.test(part.trim()))
}

export function personCandidate(value: unknown, company: Company): Person | null {
  const row = object(value)
  const id = textField(row.id, 200, true)!
  const name = textField(row.full_name, 200, true)!
  const profileUrl = urlField(row.linkedin_url)
  const evidence: EmploymentEvidence[] = []
  let hasFounder = false
  const add = (companyId: unknown, titleValue: unknown, levelsValue: unknown, field: string, job: Record<string, unknown>, current: boolean) => {
    if (textField(companyId, 200) !== company.id) return
    const title = textField(titleValue, 300)
    if (!title) return
    const levels = arrayField(levelsValue, 20).map(level => textField(level, 50, true)!)
    const founder = founderTitle(title)
    if (!founder && !levels.some(level => ['cxo', 'vp', 'director', 'owner', 'partner'].includes(level))) return
    hasFounder ||= founder
    const endDate = dateField(job.end_date)
    const sourceCount = job.num_sources
    if (sourceCount != null && (!Number.isSafeInteger(sourceCount) || Number(sourceCount) < 1)) throw new ProviderError('provider_error')
    evidence.push({ provider: PROVIDER, recordId: id, field, companyId: company.id, title,
      affiliation: endDate ? 'historical' : current ? 'current' : 'unknown',
      startDate: dateField(job.start_date), endDate, lastSeen: dateField(job.last_seen),
      ...(sourceCount != null ? { sourceCount: Number(sourceCount) } : {}), profileUrl })
  }
  arrayField(row.experience).forEach((value, index) => {
    const job = object(value), employer = optionalObject(job.company), title = optionalObject(job.title)
    if (job.is_primary != null && typeof job.is_primary !== 'boolean') throw new ProviderError('provider_error')
    add(employer.id, title.name, title.levels, `experience[${index}]`, job, job.is_primary === true)
  })
  if (!evidence.some(item => item.affiliation === 'current')) {
    add(row.job_company_id, row.job_title, row.job_title_levels, 'job_company_id + job_title',
      { start_date: row.job_start_date, last_seen: row.job_last_verified }, true)
  }
  if (!evidence.length) return null
  const preferred = evidence.find(item => hasFounder && founderTitle(item.title)) ?? evidence[0]
  return { id, name, title: preferred.title, companyId: company.id, role: hasFounder ? 'founder' : 'executive',
    source: 'approved-source', profileUrl, evidence,
    verification: { confidence: 'provider-supported',
      explanation: hasFounder ? 'An explicit founder or co-founder title is attached to this company’s provider ID.' : 'A senior title is attached to this company’s provider ID; this does not establish founder status.',
      limitation: LIMITATION } }
}

export class PeopleDataLabsProvider implements DiscoveryProvider {
  readonly name = 'pdl'
  readonly available: boolean
  readonly snapshotAllowed: boolean
  readonly configurationMessage?: string
  private readonly apiKey: string
  private readonly peopleEnabled: boolean
  private readonly requestsPerMinute: number
  private readonly windows = new Map<string, { times: number[]; blockedUntil: number }>()

  constructor(env: NodeJS.ProcessEnv, private readonly fetcher: typeof fetch = fetch) {
    this.apiKey = env.PDL_API_KEY?.trim() ?? ''
    this.snapshotAllowed = env.PDL_ALLOW_RESULT_STORAGE === 'true'
    this.peopleEnabled = env.PDL_PERSON_SEARCH_ENABLED === 'true'
    const limit = Number(env.PDL_REQUESTS_PER_MINUTE ?? 10)
    this.requestsPerMinute = Number.isInteger(limit) && limit > 0 && limit <= 1000 ? limit : 10
    this.available = Boolean(this.apiKey) && this.snapshotAllowed
    if (!this.available) this.configurationMessage = !this.apiKey
      ? 'Company discovery is not configured. No provider search was performed.'
      : 'Discovery is awaiting configuration of result storage permissions. No provider search was performed.'
  }

  private async request(endpoint: 'company' | 'person', query: unknown, signal: AbortSignal) {
    if (!this.available) throw new ProviderError('provider_access_denied')
    const now = Date.now()
    const window = this.windows.get(endpoint) ?? { times: [], blockedUntil: 0 }
    window.times = window.times.filter(time => time > now - 60_000)
    this.windows.set(endpoint, window)
    const until = Math.max(window.blockedUntil, window.times.length >= this.requestsPerMinute ? window.times[0] + 60_000 : 0)
    if (until > now) throw new ProviderError('rate_limited', Math.max(1, Math.ceil((until - now) / 1000)))
    if (signal.aborted) throw new ProviderError('provider_timeout')
    window.times.push(now)
    const timeoutSignal = AbortSignal.timeout(4_000)
    const requestSignal = AbortSignal.any([signal, timeoutSignal])
    try {
      const response = await this.fetcher(`https://api.peopledatalabs.com/v5/${endpoint}/search`, {
        method: 'POST', redirect: 'error', signal: requestSignal,
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.apiKey, 'Accept-Encoding': 'gzip' },
        body: JSON.stringify({ query: { query }, size: endpoint === 'company' ? COMPANY_LIMIT : PEOPLE_LIMIT,
          ...(endpoint === 'person' ? { data_include: 'id,full_name,linkedin_url,job_company_id,job_title,job_title_levels,job_start_date,job_last_verified,experience.company.id,experience.title,experience.start_date,experience.end_date,experience.is_primary,experience.last_seen,experience.num_sources' } : {}) }),
      })
      const retry = response.headers.get('retry-after')
      const reset = Date.parse(response.headers.get('x-ratelimit-reset') ?? '')
      const retryUntil = retry && /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry ?? '')
      let remaining: unknown
      try { remaining = JSON.parse(response.headers.get('x-ratelimit-remaining') ?? 'null') } catch { /* Optional provider header. */ }
      if (response.status === 429 || (remaining && typeof remaining === 'object' && 'minute' in remaining && remaining.minute === 0)) {
        window.blockedUntil = Math.max(Date.now() + 1000, Number.isFinite(reset) ? reset : Date.now() + 60_000, Number.isFinite(retryUntil) ? retryUntil : 0)
      }
      if ([401, 403].includes(response.status)) throw new ProviderError('provider_access_denied')
      if (response.status === 402) throw new ProviderError('quota_exceeded')
      if (response.status === 429) throw new ProviderError('rate_limited', Math.ceil((window.blockedUntil - Date.now()) / 1000))
      if (!response.ok && response.status !== 404) throw new ProviderError('provider_error')
      // Bound decompressed bytes, including responses without Content-Length.
      if (!response.body) throw new ProviderError('provider_error')
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let bytes = 0
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 2_000_000) throw new ProviderError('provider_error')
          chunks.push(value)
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
      const body = object(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      if (response.status === 404 && body.status === 404 && optionalObject(body.error).type === 'not_found') return { data: [], total: 0 }
      if (body.status !== 200 || !Array.isArray(body.data) || body.data.length > (endpoint === 'company' ? COMPANY_LIMIT : PEOPLE_LIMIT)
        || !Number.isSafeInteger(body.total) || Number(body.total) < body.data.length || (body.total !== 0 && body.data.length === 0)) throw new ProviderError('provider_error')
      return { data: body.data as unknown[], total: Number(body.total) }
    } catch (error) {
      if (requestSignal.aborted) throw new ProviderError('provider_timeout')
      throw providerError(error)
    }
  }

  async search(query: string, { signal }: { signal: AbortSignal }): Promise<DiscoverySearchResult> {
    let matchMode: 'exact' | 'prefix' = 'exact'
    let found = await this.request('company', { term: { name: normalizeQuery(query) } }, signal)
    if (!found.total) {
      matchMode = 'prefix'
      found = await this.request('company', { prefix: { name: normalizeQuery(query) } }, signal)
    }
    const generatedAt = new Date().toISOString()
    const companies: Company[] = found.data.map(value => {
      const row = object(value)
      return { id: textField(row.id, 200, true)!, name: textField(row.display_name, 200) ?? textField(row.name, 200, true)!,
        description: textField(row.summary, 5000), industry: textField(row.industry, 200), website: urlField(row.website),
        location: textField(optionalObject(row.location).name, 300), profileUrl: urlField(row.linkedin_url), source: 'approved-source',
        attribution: { provider: PROVIDER, recordId: textField(row.id, 200, true)!, retrievedAt: generatedAt, reliability: 'aggregated-provider-data' } }
    })
    if (new Set(companies.map(company => company.id)).size !== companies.length) throw new ProviderError('provider_error')
    const matches: DiscoveryResult[] = []
    const peopleSignal = AbortSignal.any([signal, AbortSignal.timeout(5_000)])
    let peopleFailure: ProviderError | undefined
    for (const company of companies) {
      const result: DiscoveryResult = { company, people: [], paths: null, connections: [], source: 'approved-source', generatedAt,
        connectionStatus: 'unavailable', peopleStatus: 'not_configured', warnings: [] }
      if (this.peopleEnabled) {
        try {
          if (peopleFailure) throw peopleFailure
          const foundPeople = await this.request('person', { bool: { must: [
            { bool: { should: [{ term: { job_company_id: company.id } }, { term: { 'experience.company.id': company.id } }], minimum_should_match: 1 } },
            { bool: { should: [
              { wildcard: { job_title: '*founder*' } }, { wildcard: { 'experience.title.name': '*founder*' } },
              { terms: { job_title_levels: ['cxo', 'vp', 'director', 'owner', 'partner'] } },
              { terms: { 'experience.title.levels': ['cxo', 'vp', 'director', 'owner', 'partner'] } },
            ], minimum_should_match: 1 } },
          ] } }, peopleSignal)
          result.people = [...new Map(foundPeople.data.map(value => personCandidate(value, company)).filter((person): person is Person => !!person).map(person => [person.id, person])).values()]
          result.people.sort((a, b) => Number(b.role === 'founder') - Number(a.role === 'founder'))
          result.peopleStatus = result.people.length ? 'available' : 'no_candidates'
          result.peopleTruncated = foundPeople.total > foundPeople.data.length
          if (result.peopleTruncated) result.warnings.push('Only the first five person records were checked. More candidates may exist in this source.')
          if (foundPeople.data.length > result.people.length) result.warnings.push('Some returned profiles were duplicates or lacked a matching company ID and qualifying title and were excluded.')
        } catch (error) {
          peopleFailure = providerError(error)
          result.peopleStatus = peopleFailure.code
          result.warnings.push(`Company information is available. People lookup: ${peopleFailure.message}`)
        }
      }
      matches.push(result)
    }
    return { matches, total: found.total, matchMode }
  }
}
