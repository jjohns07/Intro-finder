import { createHash } from 'node:crypto'
import type { DiscoveryProvider } from '../provider'
import type { Company, DiscoveryResult, DiscoverySearchResult, DiscoveryVerification, Person } from '../types'
import { ProviderError, providerError } from '../errors'
import { arrayField, normalizeQuery, object, textField, urlField } from '../validation'

const PROVIDER = 'Skrapp'
const COMPANY_LIMIT = 5
const PEOPLE_LIMIT = 5
const LIMITATION = 'Skrapp lists this name and title on the company record. Individual identity and original sources were not independently verified; titles may be outdated. Complete employment history is not supplied.'

type SkrappOptions = {
  apiKey?: string
  executivesEnabled?: boolean
  searchRequestsPerMinute?: number
  searchRequestsPerDay?: number
}

function companyId(value: unknown) {
  // Skrapp internal IDs exceed JavaScript's safe integer range. Never convert them.
  const id = textField(value, 64, true)!
  if (!/^\d+$/.test(id)) throw new ProviderError('provider_error')
  return id
}

function limit(value: number | undefined, fallback: number, maximum: number) {
  return Number.isInteger(value) && value! > 0 && value! <= maximum ? value! : fallback
}

function explicitFounderTitle(title: string) {
  return normalizeQuery(title).replace(/[\u2010-\u2015]/g, '-').split(/[,/&]|\band\b/)
    .some(part => /^(co[- ]?)?founder$/.test(part.trim()))
}

function retrySeconds(value: string | null) {
  if (!value) return undefined
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000)
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined
}

async function readBody(response: Response) {
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
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  return object(JSON.parse(Buffer.concat(chunks).toString('utf8')))
}

function executives(value: unknown, company: Company) {
  const rows = arrayField(value, 1000)
  const candidates = new Map<string, Person>()
  let excluded = 0
  rows.forEach((value, index) => {
    try {
      const row = object(value)
      const name = textField(row.member_full_name, 200, true)!
      const title = textField(row.member_position_title, 300, true)!
      // This is a local display-row ID, not a person ID supplied by Skrapp.
      const digest = createHash('sha256').update(JSON.stringify([company.id, normalizeQuery(name), normalizeQuery(title)])).digest('hex').slice(0, 24)
      const id = 'skrapp-executive-' + digest
      if (candidates.has(id)) { excluded++; return }
      const founder = explicitFounderTitle(title)
      candidates.set(id, {
        id, name, title, companyId: company.id, role: founder ? 'founder' : 'executive', source: 'approved-source',
        evidence: [{
          provider: PROVIDER, recordId: id, companyId: company.id,
          field: 'categories.headcount.data.key_executives[' + index + ']',
          title, affiliation: 'current',
        }],
        verification: {
          confidence: 'provider-supported',
          explanation: founder
            ? 'An explicit founder or co-founder title appears in Skrapp’s executive list for this company ID.'
            : 'Skrapp lists this name and title among this company’s executives. This does not establish founder status.',
          limitation: LIMITATION,
        },
      })
    } catch {
      excluded++
    }
  })
  if (rows.length && !candidates.size) throw new ProviderError('provider_error')
  const people = [...candidates.values()].sort((a, b) => Number(b.role === 'founder') - Number(a.role === 'founder'))
  return { people: people.slice(0, PEOPLE_LIMIT), truncated: people.length > PEOPLE_LIMIT, excluded }
}

export class SkrappProvider implements DiscoveryProvider {
  readonly name = 'skrapp'
  readonly available: boolean
  // Discovery saves an allowlisted snapshot as part of the authorized application flow.
  readonly snapshotAllowed = true
  readonly configurationMessage?: string
  readonly #apiKey: string
  readonly #executivesEnabled: boolean
  readonly #requestsPerMinute: number
  readonly #requestsPerDay: number
  #searchTimes: number[] = []
  #searchDay = ''
  #searchDayUsed = 0
  #blockedUntil = { search: 0, enrich: 0 }
  #verification: DiscoveryVerification = { status: 'not_run', companySearch: 'not_run', executiveEnrichment: 'not_run' }
  #verificationPromise?: Promise<DiscoveryVerification>

  constructor({
    apiKey = process.env.SKRAPP_API_KEY,
    executivesEnabled = true,
    searchRequestsPerMinute,
    searchRequestsPerDay,
  }: SkrappOptions = {}, private readonly fetcher: typeof fetch = fetch) {
    this.#apiKey = apiKey?.trim() ?? ''
    this.available = Boolean(this.#apiKey)
    this.#executivesEnabled = executivesEnabled
    this.#requestsPerMinute = limit(searchRequestsPerMinute, 20, 100)
    this.#requestsPerDay = limit(searchRequestsPerDay, 50, 2000)
    if (!this.available) this.configurationMessage = 'Skrapp discovery is not configured on the server. No provider search was performed.'
  }

  get verification(): DiscoveryVerification { return { ...this.#verification } }

  private async request(endpoint: 'search' | 'enrich', query: URLSearchParams, signal: AbortSignal, body?: unknown) {
    if (!this.available) throw new ProviderError('provider_access_denied')
    if (signal.aborted) throw new ProviderError('provider_timeout')
    const now = Date.now()
    const day = new Date(now).toISOString().slice(0, 10)
    const nextDay = Date.parse(day) + 86_400_000
    let blockedUntil = this.#blockedUntil[endpoint]
    if (endpoint === 'search') {
      this.#searchTimes = this.#searchTimes.filter(time => time > now - 60_000)
      if (this.#searchDay !== day) { this.#searchDay = day; this.#searchDayUsed = 0 }
      if (this.#searchTimes.length >= this.#requestsPerMinute) blockedUntil = Math.max(blockedUntil, this.#searchTimes[0] + 60_000)
      if (this.#searchDayUsed >= this.#requestsPerDay) blockedUntil = Math.max(blockedUntil, nextDay)
    }
    if (blockedUntil > now) throw new ProviderError('rate_limited', Math.ceil((blockedUntil - now) / 1000))
    if (endpoint === 'search') { this.#searchTimes.push(now); this.#searchDayUsed++ }

    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(4_000)])
    try {
      const response = await this.fetcher('https://api.skrapp.io/api/v3/companies/' + endpoint + '?' + query.toString(), {
        method: endpoint === 'search' ? 'POST' : 'GET',
        redirect: 'error', signal: requestSignal,
        headers: { 'X-Access-Key': this.#apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Accept-Encoding': 'gzip' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      const retry = retrySeconds(response.headers.get('retry-after'))
      const dayExhausted = endpoint === 'search' && response.headers.get('x-ratelimit-remaining-day') === '0'
      const minuteExhausted = endpoint === 'search' && response.headers.get('x-ratelimit-remaining-minute') === '0'
      if (response.status === 429 || dayExhausted || minuteExhausted) {
        this.#blockedUntil[endpoint] = Math.max(this.#blockedUntil[endpoint],
          dayExhausted ? nextDay : 0, Date.now() + (retry ?? 60) * 1000)
      }
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {})
        if (response.status === 401 || response.status === 403) throw new ProviderError('provider_access_denied')
        if (response.status === 402) throw new ProviderError('quota_exceeded')
        if (response.status === 429) throw new ProviderError('rate_limited', Math.max(1, Math.ceil((this.#blockedUntil[endpoint] - Date.now()) / 1000)))
        if (response.status === 408 || response.status === 504) throw new ProviderError('provider_timeout')
        throw new ProviderError('provider_error')
      }
      return await readBody(response)
    } catch (error) {
      if (requestSignal.aborted) throw new ProviderError('provider_timeout')
      // Never forward upstream bodies, headers, URLs or exceptions to clients/logs.
      throw providerError(error)
    }
  }

  private async findCompanies(query: string, signal: AbortSignal, size = COMPANY_LIMIT, domain?: string) {
    const body = await this.request('search', new URLSearchParams({ size: String(size), start: '0', lead_counts: 'false' }), signal,
      { companyName: normalizeQuery(query), sort: 'relevance', ...(domain ? { companyDomains: [domain] } : {}) })
    if (!Array.isArray(body.results) || body.results.length > size) throw new ProviderError('provider_error')
    // Skrapp's documented empty response is { results: [] }, without meta.
    const total = body.meta == null && !body.results.length ? 0 : object(body.meta).total_all
    if (!Number.isSafeInteger(total) || Number(total) < body.results.length || (total !== 0 && !body.results.length)) throw new ProviderError('provider_error')
    const retrievedAt = new Date().toISOString()
    const companies: Company[] = body.results.map(value => {
      const row = object(value)
      const id = companyId(row.internal_id)
      const location = [...new Set([row.city, row.geo_area, row.country].map(value => textField(value, 200)).filter(Boolean))].join(', ')
      return {
        id, name: textField(row.name, 200, true)!, source: 'approved-source',
        website: urlField(row.website) ?? urlField(row.domain), industry: textField(row.industry, 200),
        location: location || textField(row.hq_location, 300), logoUrl: urlField(row.logo_url), profileUrl: urlField(row.linkedin_url),
        attribution: { provider: PROVIDER, recordId: id, retrievedAt, reliability: 'aggregated-provider-data' },
      }
    })
    if (new Set(companies.map(company => company.id)).size !== companies.length) throw new ProviderError('provider_error')
    const matchMode = total === 1 && normalizeQuery(companies[0].name) === normalizeQuery(query) ? 'exact' : 'relevance'
    return { companies, total: Number(total), matchMode } as const
  }

  private async enrich(company: Company, signal: AbortSignal) {
    // Omitted categories means all 12 categories (25 credits). Always request only headcount.
    const body = await this.request('enrich', new URLSearchParams({ id: company.id, categories: 'headcount' }), signal)
    if (companyId(body.id) !== company.id || !Number.isSafeInteger(body.total_cost) || Number(body.total_cost) < 0 || Number(body.total_cost) > 3) throw new ProviderError('provider_error')
    const category = object(object(body.categories).headcount)
    if (!Number.isSafeInteger(category.cost) || Number(category.cost) < 0 || Number(category.cost) > 3 || category.cost !== body.total_cost || !('data' in category)) throw new ProviderError('provider_error')
    return executives(category.data === null ? [] : object(category.data).key_executives, company)
  }

  async search(query: string, { signal }: { signal: AbortSignal }): Promise<DiscoverySearchResult> {
    const found = await this.findCompanies(query, signal)
    const matches: DiscoveryResult[] = []
    const peopleSignal = AbortSignal.any([signal, AbortSignal.timeout(8_000)])
    let failure: ProviderError | undefined
    for (const company of found.companies) {
      const match: DiscoveryResult = {
        company, people: [], paths: null, connections: [], source: 'approved-source', generatedAt: new Date().toISOString(),
        peopleStatus: 'not_configured', connectionStatus: 'unavailable', warnings: [],
      }
      if (this.#executivesEnabled) {
        try {
          if (failure) throw failure
          const result = await this.enrich(company, peopleSignal)
          match.people = result.people
          match.peopleStatus = result.people.length ? 'available' : 'no_candidates'
          match.peopleTruncated = result.truncated
          if (result.truncated) match.warnings.push('Showing the first five executive candidates, with explicit founder titles first.')
          if (result.excluded) match.warnings.push('Some executive rows were duplicates or lacked a usable name and title and were excluded.')
          match.warnings.push('Skrapp’s executive list may be incomplete or outdated. It is not a complete founder register.')
        } catch (error) {
          failure = providerError(error)
          match.peopleStatus = failure.code
          match.warnings.push('Company information is available. Executive enrichment: ' + failure.message)
        }
      }
      matches.push(match)
    }
    return { matches, total: found.total, matchMode: found.matchMode }
  }

  verifyConnection(): Promise<DiscoveryVerification> {
    // No HTTP endpoint triggers this. Startup and the operator CLI are the only callers.
    if (this.#verificationPromise) return this.#verificationPromise
    this.#verificationPromise = this.runVerification().finally(() => { this.#verificationPromise = undefined })
    return this.#verificationPromise
  }

  private async runVerification(): Promise<DiscoveryVerification> {
    this.#verification = { status: 'running', companySearch: 'not_run', executiveEnrichment: 'not_run' }
    const signal = AbortSignal.timeout(12_000)
    try {
      if (!this.available) {
        this.#verification.companySearch = 'not_configured'
      } else {
        // One company, at most three credits once per account/category. No real user data.
        const found = await this.findCompanies('Stripe', signal, 1, 'stripe.com')
        if (!found.companies.length) this.#verification.companySearch = 'no_data'
        else {
          const company = found.companies[0]
          if (!company.website || new URL(company.website).hostname.replace(/^www\./, '') !== 'stripe.com') throw new ProviderError('provider_error')
          this.#verification.companySearch = 'passed'
          if (!this.#executivesEnabled) this.#verification.executiveEnrichment = 'not_configured'
          else {
            const result = await this.enrich(company, signal)
            this.#verification.executiveCount = result.people.length
            this.#verification.executiveEnrichment = result.people.length ? 'passed' : 'no_data'
          }
        }
      }
    } catch (error) {
      const failure = providerError(error)
      if (this.#verification.companySearch === 'passed') this.#verification.executiveEnrichment = failure.code
      else this.#verification.companySearch = failure.code
    }
    this.#verification.status = this.#verification.companySearch === 'passed'
      ? this.#verification.executiveEnrichment === 'passed' ? 'passed' : 'partial'
      : 'failed'
    this.#verification.checkedAt = new Date().toISOString()
    return this.verification
  }
}
