import { createHash } from 'node:crypto'
import type { DiscoveryProvider } from '../provider'
import type { Company, CompanyDetails, CompanyInformationVerification, DiscoveryResult, DiscoverySearchResult, DiscoveryVerification, Person } from '../types'
import { ProviderError, providerError } from '../errors'
import { arrayField, integerField, normalizeQuery, object, textField, timestampField } from '../validation'
import { firmographicsCompany, searchCompany, skrappCompanyId as companyId } from './skrappCompany'

const PROVIDER = 'Skrapp'
const COMPANY_LIMIT = 5
const PEOPLE_LIMIT = 5
const REFERENCE_COMPANIES = [
  { name: 'Stripe', domain: 'stripe.com', countries: ['united states', 'ireland'] },
  { name: 'BMW Group', domain: 'bmwgroup.com', countries: ['germany'] },
  { name: 'Shopify', domain: 'shopify.com', countries: ['canada'] },
  { name: 'Safaricom', domain: 'safaricom.co.ke', countries: ['kenya'] },
] as const
const LIMITATION = 'Skrapp lists this name and title on the company record. Individual identity and original sources were not independently verified; titles may be outdated. Complete employment history is not supplied.'

type SkrappOptions = {
  apiKey?: string
  executivesEnabled?: boolean
  searchRequestsPerMinute?: number
  searchRequestsPerDay?: number
  companyCacheTtlSeconds?: number
}

function categoryData(body: Record<string, unknown>, id: string, name: 'headcount' | 'firmographics', maximumCost: number) {
  if (companyId(body.id) !== id || integerField(body.total_cost, 0, maximumCost) === undefined) throw new ProviderError('provider_error')
  const categories = object(body.categories)
  if (Object.keys(categories).length !== 1) throw new ProviderError('provider_error')
  const category = object(categories[name])
  if (integerField(category.cost, 0, maximumCost) !== body.total_cost || !('data' in category)) throw new ProviderError('provider_error')
  return category.data === null ? null : object(category.data)
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
  readonly #companyCacheTtlSeconds: number
  #companyCache = new Map<string, CompanyDetails>()
  #companyRequests = new Map<string, Promise<CompanyDetails>>()
  #companyRequestTimes: number[] = []
  #searchTimes: number[] = []
  #searchDay = ''
  #searchDayUsed = 0
  #blockedUntil = { search: 0, enrich: 0 }
  #verification: DiscoveryVerification = { status: 'not_run', companySearch: 'not_run', executiveEnrichment: 'not_run' }
  #verificationPromise?: Promise<DiscoveryVerification>
  #companyVerification: CompanyInformationVerification = { status: 'not_run', companies: [] }
  #companyVerificationPromise?: Promise<CompanyInformationVerification>

  constructor({
    apiKey = process.env.SKRAPP_API_KEY,
    executivesEnabled = true,
    searchRequestsPerMinute,
    searchRequestsPerDay,
    companyCacheTtlSeconds = 3600,
  }: SkrappOptions = {}, private readonly fetcher: typeof fetch = fetch) {
    this.#apiKey = apiKey?.trim() ?? ''
    this.available = Boolean(this.#apiKey)
    this.#executivesEnabled = executivesEnabled
    this.#requestsPerMinute = limit(searchRequestsPerMinute, 20, 100)
    this.#requestsPerDay = limit(searchRequestsPerDay, 50, 2000)
    this.#companyCacheTtlSeconds = Number.isInteger(companyCacheTtlSeconds) && companyCacheTtlSeconds >= 0 && companyCacheTtlSeconds <= 86_400
      ? companyCacheTtlSeconds : 3600
    if (!this.available) this.configurationMessage = 'Skrapp discovery is not configured on the server. No provider search was performed.'
  }

  get verification(): DiscoveryVerification { return { ...this.#verification } }
  get companyInformationVerification(): CompanyInformationVerification { return structuredClone(this.#companyVerification) }

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
      return { body: await readBody(response), cacheControl: response.headers.get('cache-control'), age: response.headers.get('age') }
    } catch (error) {
      if (requestSignal.aborted) throw new ProviderError('provider_timeout')
      // Never forward upstream bodies, headers, URLs or exceptions to clients/logs.
      throw providerError(error)
    }
  }

  private async findCompanies(query: string, signal: AbortSignal, size = COMPANY_LIMIT, domain?: string) {
    const { body } = await this.request('search', new URLSearchParams({ size: String(size), start: '0', lead_counts: 'false' }), signal,
      { companyName: normalizeQuery(query), sort: 'relevance', ...(domain ? { companyDomains: [domain] } : {}) })
    if (!Array.isArray(body.results) || body.results.length > size) throw new ProviderError('provider_error')
    // Skrapp's documented empty response is { results: [] }, without meta.
    const total = body.meta == null && !body.results.length ? 0 : object(body.meta).total_all
    if (!Number.isSafeInteger(total) || Number(total) < body.results.length || (total !== 0 && !body.results.length)) throw new ProviderError('provider_error')
    const retrievedAt = new Date().toISOString()
    const companies = body.results.map(value => searchCompany(value, retrievedAt))
    if (new Set(companies.map(company => company.id)).size !== companies.length) throw new ProviderError('provider_error')
    const matchMode = total === 1 && normalizeQuery(companies[0].name) === normalizeQuery(query) ? 'exact' : 'relevance'
    return { companies, total: Number(total), matchMode } as const
  }

  private async enrich(company: Company, signal: AbortSignal) {
    // Omitted categories means all 12 categories (25 credits). Always request only headcount.
    const { body } = await this.request('enrich', new URLSearchParams({ id: company.id, categories: 'headcount' }), signal)
    const data = categoryData(body, company.id, 'headcount', 3)
    return { ...executives(data?.key_executives, company),
      employeeRange: textField(data?.employees_range, 100), linkedinEmployeeCount: integerField(data?.linkedin_employees_count) }
  }

  async getCompanyDetails(company: Company, { signal, refresh = false }: { signal: AbortSignal; refresh?: boolean }): Promise<CompanyDetails> {
    const id = companyId(company.id)
    if (!this.available) throw new ProviderError('provider_access_denied')
    if (signal.aborted) throw new ProviderError('provider_timeout')
    const cached = this.#companyCache.get(id)
    if (!refresh && cached?.expiresAt && Date.parse(cached.expiresAt) > Date.now()) {
      this.#companyCache.delete(id)
      this.#companyCache.set(id, cached)
      return { ...structuredClone(cached), cached: true }
    }
    // A refresh failure must not leave a previous entry looking freshly checked.
    this.#companyCache.delete(id)
    let pending = this.#companyRequests.get(id)
    if (!pending) {
      // Shared requests have their own bounded lifetime; cancelling one viewer
      // must not cancel another viewer's request for the same company.
      pending = this.loadCompanyDetails(company).finally(() => { this.#companyRequests.delete(id) })
      this.#companyRequests.set(id, pending)
    }
    const result = await pending
    if (signal.aborted) throw new ProviderError('provider_timeout')
    return structuredClone(result)
  }

  private async loadCompanyDetails(company: Company): Promise<CompanyDetails> {
    const now = Date.now()
    this.#companyRequestTimes = this.#companyRequestTimes.filter(time => time > now - 60_000)
    if (this.#companyRequestTimes.length >= 20) throw new ProviderError('rate_limited', Math.ceil((this.#companyRequestTimes[0] + 60_000 - now) / 1000))
    this.#companyRequestTimes.push(now)
    // Only the selected company's one-credit profile category. Never request all.
    const { body, cacheControl, age } = await this.request('enrich',
      new URLSearchParams({ id: company.id, categories: 'firmographics' }), AbortSignal.timeout(5_000))
    const data = categoryData(body, company.id, 'firmographics', 1)
    const retrievedAt = new Date().toISOString()
    let ttl = this.#companyCacheTtlSeconds
    if (/(?:^|,)\s*(?:no-store|no-cache)\b/i.test(cacheControl ?? '')) ttl = 0
    const maxAge = /(?:^|,)\s*max-age\s*=\s*"?(\d+)/i.exec(cacheControl ?? '')
    if (maxAge) ttl = Math.min(ttl, Number(maxAge[1]))
    ttl = Math.max(0, ttl - (/^\d+$/.test(age ?? '') ? Number(age) : 0))
    const result: CompanyDetails = {
      status: data === null ? 'unavailable' : 'available',
      ...(data === null ? {} : firmographicsCompany(data, company, retrievedAt)),
      checkedAt: retrievedAt, retrievedAt, providerUpdatedAt: timestampField(body.last_updated_at), cached: false,
      ...(ttl > 0 ? { expiresAt: new Date(Date.now() + ttl * 1000).toISOString() } : {}),
    }
    if (ttl > 0) {
      // Only projected company fields, no raw responses or personal contact data.
      if (this.#companyCache.size >= 200) this.#companyCache.delete(this.#companyCache.keys().next().value!)
      this.#companyCache.set(company.id, structuredClone(result))
    }
    return result
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
          company.employeeRange = result.employeeRange ?? company.employeeRange
          company.linkedinEmployeeCount = result.linkedinEmployeeCount
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

  verifyCompanyInformation(): Promise<CompanyInformationVerification> {
    if (this.#companyVerificationPromise) return this.#companyVerificationPromise
    this.#companyVerificationPromise = this.runCompanyInformationVerification().finally(() => { this.#companyVerificationPromise = undefined })
    return this.#companyVerificationPromise
  }

  private async runCompanyInformationVerification(): Promise<CompanyInformationVerification> {
    this.#companyVerification = { status: 'running', companies: REFERENCE_COMPANIES.map(({ name, domain }) => ({ name, domain, status: 'not_run' })) }
    const signal = AbortSignal.timeout(35_000)
    for (const [index, reference] of REFERENCE_COMPANIES.entries()) {
      const report = this.#companyVerification.companies[index]
      if (!this.available) { report.status = 'not_configured'; continue }
      try {
        const found = await this.findCompanies(reference.name, signal, 1, reference.domain)
        const company = found.companies[0]
        if (!company) { report.status = 'no_match'; continue }
        const matchesDomain = (company: Company) => company.domain === reference.domain
          || Boolean(company.website && new URL(company.website).hostname.replace(/^www\./, '') === reference.domain)
        if (!matchesDomain(company)) { report.status = 'needs_review'; continue }
        const profile = await this.getCompanyDetails(company, { signal, refresh: true })
        if (profile.status !== 'available' || !profile.company) { report.status = 'no_data'; continue }
        if (profile.company.domain && !matchesDomain(profile.company)) { report.status = 'needs_review'; continue }
        const country = profile.company.country ?? company.country
        report.description = profile.company.description ? 'available' : 'unavailable'
        report.country = !country ? 'unavailable' : (reference.countries as readonly string[]).includes(normalizeQuery(country)) ? 'matched' : 'different'
        report.industry = profile.company.industry ?? company.industry ? 'available' : 'unavailable'
        report.fields = ['name', 'logoUrl', 'description', 'industry', 'country', 'city', 'region', 'location', 'website', 'domain',
          'employeeRange', 'linkedinEmployeeCount', 'profileUrl', 'legalName', 'companyType', 'foundedYear', 'activityStatus']
          .filter(field => profile.company![field as keyof Company] != null)
        report.status = report.description === 'available' && report.country === 'matched' && report.industry === 'available' ? 'passed' : 'needs_review'
      } catch (error) {
        const failure = providerError(error)
        report.status = failure.code
        if (['rate_limited', 'quota_exceeded', 'provider_access_denied'].includes(failure.code)) break
      }
    }
    const reports = this.#companyVerification.companies
    this.#companyVerification.status = reports.every(report => report.status === 'passed') ? 'passed'
      : reports.some(report => ['passed', 'needs_review', 'no_data', 'no_match'].includes(report.status)) ? 'partial' : 'failed'
    this.#companyVerification.checkedAt = new Date().toISOString()
    return this.companyInformationVerification
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
          if (company.domain !== 'stripe.com' && (!company.website || new URL(company.website).hostname.replace(/^www\./, '') !== 'stripe.com')) throw new ProviderError('provider_error')
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
