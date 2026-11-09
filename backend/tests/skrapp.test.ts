import test from 'node:test'
import assert from 'node:assert/strict'
import { SkrappProvider } from '../src/discovery/providers/skrapp'
import { createDiscoveryProvider, shouldVerifyOnStartup } from '../src/discovery/provider'
import { permittedSnapshot } from '../src/services/history'

// Deliberately fake credentials and records; none of these tests contact Skrapp.
const TEST_KEY = 'skrapp-test-only-not-a-real-key'
const company = { id: 'encoded-search-only', internal_id: '8342903258370330161', name: 'Example', domain: 'example.com',
  website: 'https://example.com',
  industry: 'Software', city: 'Lagos', country: 'Nigeria', linkedin_url: 'linkedin.com/company/example' }
const secondCompany = { ...company, internal_id: '5582989491351854253', name: 'Example Labs' }
const rows = [
  { member_full_name: 'Test Executive', member_position_title: 'CEO' },
  { member_full_name: 'Test Founder', member_position_title: 'Co-Founder & CEO' },
]
const json = (body: unknown, headers?: HeadersInit) => new Response(JSON.stringify(body), { headers })
const companies = (records: unknown[] = [company], total = records.length, headers?: HeadersInit) =>
  json(records.length ? { results: records, meta: { total_all: total } } : { results: [] }, headers)
const enrichment = (id = company.internal_id, executives: unknown = rows) => json({
  id, company_name: 'Example', total_cost: 3, last_updated_at: '2026-11-01T00:00:00.000Z',
  categories: { headcount: { cost: 3, data: { key_executives: executives } } },
})
const search = (provider: SkrappProvider, signal = new AbortController().signal) => provider.search('Example', { signal })
const mock = (responses: Response[], options: ConstructorParameters<typeof SkrappProvider>[0] = {}) => {
  const requests: { url: URL; options?: RequestInit }[] = []
  const provider = new SkrappProvider({ apiKey: TEST_KEY, ...options }, (async (input, options) => {
    requests.push({ url: new URL(String(input)), options })
    const response = responses.shift()
    assert.ok(response, 'Unexpected upstream request')
    return response
  }) as typeof fetch)
  return { provider, requests }
}

test('Skrapp is selected by default; missing local credentials never make a request', async () => {
  const unconfigured = createDiscoveryProvider({})
  assert.equal(unconfigured.name, 'skrapp')
  assert.equal(unconfigured.available, false)
  const { provider, requests } = mock([], { apiKey: '' })
  await assert.rejects(search(provider), { code: 'provider_access_denied' })
  assert.equal(requests.length, 0)
  assert.equal((await provider.verifyConnection()).companySearch, 'not_configured')
  assert.equal(provider.verification.status, 'failed')
  assert.equal(createDiscoveryProvider({ DISCOVERY_PROVIDER: 'pdl', SKRAPP_API_KEY: TEST_KEY }).name, 'skrapp')
  assert.equal(createDiscoveryProvider({ DISCOVERY_PROVIDER: 'pdl', SKRAPP_API_KEY: TEST_KEY, PDL_API_KEY: 'pdl-test-only', PDL_ALLOW_RESULT_STORAGE: 'true' }).name, 'pdl')
  assert.equal(createDiscoveryProvider({ DISCOVERY_PROVIDER: 'disabled', SKRAPP_API_KEY: TEST_KEY }).available, false)
})

test('default constructor reads the backend environment and keeps the key non-enumerable', async () => {
  const previous = process.env.SKRAPP_API_KEY
  try {
    process.env.SKRAPP_API_KEY = TEST_KEY
    let header: string | null = null
    const provider = new SkrappProvider({}, (async (_url, options) => {
      header = new Headers(options?.headers).get('x-access-key')
      return companies([])
    }) as typeof fetch)
    assert.equal(provider.available, true)
    await search(provider)
    assert.equal(header, TEST_KEY)
    assert.equal(JSON.stringify(provider).includes(TEST_KEY), false)
  } finally {
    if (previous === undefined) delete process.env.SKRAPP_API_KEY
    else process.env.SKRAPP_API_KEY = previous
  }
})

test('search and enrichment use documented methods, header auth and lossless internal company IDs', async () => {
  const { provider, requests } = mock([
    companies([{ ...company, api_key: TEST_KEY, metadata: { secret: TEST_KEY } }]),
    enrichment(company.internal_id, rows.map(row => ({ ...row, email: 'private@example.com', api_key: TEST_KEY }))),
  ])
  const found = await search(provider)
  const result = permittedSnapshot(found.matches[0])
  assert.equal(requests.length, 2)
  assert.equal(requests[0].url.origin, 'https://api.skrapp.io')
  assert.equal(requests[0].url.pathname, '/api/v3/companies/search')
  assert.equal(requests[0].options?.method, 'POST')
  assert.deepEqual(JSON.parse(String(requests[0].options?.body)), { companyName: 'example', sort: 'relevance' })
  assert.equal(requests[0].url.searchParams.get('size'), '5')
  assert.equal(requests[0].url.searchParams.get('lead_counts'), 'false')
  assert.equal(new Headers(requests[0].options?.headers).get('x-access-key'), TEST_KEY)
  assert.equal(requests[1].url.pathname, '/api/v3/companies/enrich')
  assert.equal(requests[1].options?.method, 'GET')
  assert.equal(requests[1].url.searchParams.get('id'), company.internal_id)
  assert.equal(requests[1].url.searchParams.get('categories'), 'headcount')
  assert.equal(requests[1].options?.body, undefined)
  assert.ok(requests.every(request => request.options?.redirect === 'error' && !request.url.href.includes(TEST_KEY)))
  assert.equal(result.company.id, company.internal_id)
  assert.equal(result.company.website, 'https://example.com/')
  assert.equal(result.company.attribution?.provider, 'Skrapp')
  assert.equal(found.matchMode, 'exact')
  assert.equal(result.peopleStatus, 'available')
  assert.equal(result.people?.[0].role, 'founder')
  assert.equal(result.people?.[1].role, 'executive')
  assert.equal(result.people?.[0].evidence?.[0].companyId, company.internal_id)
  assert.match(result.people?.[0].evidence?.[0].field ?? '', /key_executives\[1\]/)
  assert.equal(result.people?.[0].evidence?.[0].lastSeen, undefined)
  assert.equal(result.people?.[0].evidence?.[0].sourceCount, undefined)
  assert.equal(result.paths, null)
  assert.deepEqual(result.connections, [])
  assert.doesNotMatch(JSON.stringify(result), /skrapp-test-only|private@example|metadata|"score"|api_key/)
})

test('a founder claim needs an explicit title; IDs do not imply global person identity', async () => {
  const titles = ['CEO', "Founder’s associate", 'Assistant to founder', 'Founding engineer', 'Owner', 'Co‑Founder and CTO']
  const { provider } = mock([companies(), enrichment(company.internal_id, titles.map((title, index) => ({
    member_full_name: 'Candidate ' + index, member_position_title: title,
  })))])
  const match = (await search(provider)).matches[0]
  assert.equal(match.people?.filter(person => person.role === 'founder').length, 1)
  assert.equal(match.people?.[0].name, 'Candidate 5')
  assert.match(match.people?.[0].id ?? '', /^skrapp-executive-/)
  assert.equal(match.peopleTruncated, true)
  assert.equal(match.people?.length, 5)
})

test('duplicate and incomplete executive rows are excluded without inventing names or titles', async () => {
  const { provider } = mock([companies(), enrichment(company.internal_id, [rows[0], rows[0], null, { member_full_name: 'No title' }, rows[1]])])
  const match = (await search(provider)).matches[0]
  assert.equal(match.people?.length, 2)
  assert.ok(match.warnings.some(warning => warning.includes('excluded')))
})

test('relevance matches remain ambiguous, and company-only discovery makes no enrichment requests', async () => {
  const { provider, requests } = mock([companies([secondCompany], 1)], { executivesEnabled: false })
  const found = await search(provider)
  assert.equal(found.matchMode, 'relevance')
  assert.equal(found.matches[0].peopleStatus, 'not_configured')
  assert.equal(requests.length, 1)
  const many = mock([companies([company, secondCompany], 12)], { executivesEnabled: false })
  assert.equal((await search(many.provider)).total, 12)
  assert.equal((await search(mock([companies([])]).provider)).total, 0)
})

test('unknown executive data produces no candidates; malformed data is a provider error', async () => {
  const absent = mock([companies(), json({ id: company.internal_id, total_cost: 0, categories: { headcount: { cost: 0, data: null } } })])
  const match = (await search(absent.provider)).matches[0]
  assert.equal(match.peopleStatus, 'no_candidates')
  assert.deepEqual(match.people, [])
  for (const response of [
    enrichment(secondCompany.internal_id),
    enrichment(company.internal_id, { invalid: true }),
    enrichment(company.internal_id, [{ member_full_name: 'No title' }]),
    json({ id: company.internal_id, total_cost: 0, categories: {} }),
    json({ id: Number(company.internal_id), total_cost: 3, categories: { headcount: { cost: 3, data: null } } }),
  ]) {
    const result = await search(mock([companies(), response]).provider)
    assert.equal(result.matches[0].peopleStatus, 'provider_error')
    assert.equal(result.matches[0].company.id, company.internal_id)
  }
})

test('enrichment access, quota, rate and server failures preserve companies and stop further enrichment', async () => {
  for (const [status, expected] of [
    [401, 'provider_access_denied'], [403, 'provider_access_denied'], [402, 'quota_exceeded'],
    [429, 'rate_limited'], [500, 'provider_error'], [504, 'provider_timeout'],
  ] as const) {
    const { provider, requests } = mock([companies([company, secondCompany]), new Response(TEST_KEY, { status, headers: { 'Retry-After': '120' } })])
    const found = await search(provider)
    assert.equal(found.matches.length, 2)
    assert.ok(found.matches.every(match => match.peopleStatus === expected && match.people?.length === 0))
    assert.equal(requests.length, 2)
    assert.equal(JSON.stringify(found).includes(TEST_KEY), false)
  }
})

test('search errors never become no matches and upstream exceptions remain private', async () => {
  for (const [status, code] of [
    [401, 'provider_access_denied'], [403, 'provider_access_denied'], [402, 'quota_exceeded'],
    [429, 'rate_limited'], [408, 'provider_timeout'], [500, 'provider_error'],
  ] as const) {
    await assert.rejects(search(mock([new Response(TEST_KEY, { status })]).provider), (error: unknown) =>
      error instanceof Error && 'code' in error && error.code === code && !error.message.includes(TEST_KEY))
  }
  const provider = new SkrappProvider({ apiKey: TEST_KEY }, (async () => { throw new Error(TEST_KEY) }) as typeof fetch)
  await assert.rejects(search(provider), (error: unknown) => error instanceof Error && !error.message.includes(TEST_KEY))
})

test('malformed, oversized, duplicate-ID and lossy-ID responses are rejected', async () => {
  for (const response of [
    new Response('not JSON'), new Response('x'.repeat(2_000_001)),
    json({ results: [] , meta: { total_all: 1 } }), json({ results: [company] }),
    companies([{ ...company, internal_id: Number(company.internal_id) }]),
    companies([company, company]), companies([{ ...company, name: null }]),
    companies([{ ...company, internal_id: company.id }]),
  ]) {
    await assert.rejects(search(mock([response]).provider), { code: 'provider_error' })
  }
})

test('Skrapp Retry-After and remaining minute/day headers prevent immediate repeat calls', async () => {
  const limited = mock([new Response('{}', { status: 429, headers: { 'Retry-After': '120' } })])
  await assert.rejects(search(limited.provider), (error: any) => error.code === 'rate_limited' && error.retryAfterSeconds >= 119)
  await assert.rejects(search(limited.provider), { code: 'rate_limited' })
  assert.equal(limited.requests.length, 1)
  for (const header of ['X-RateLimit-Remaining-Minute', 'X-RateLimit-Remaining-Day']) {
    const { provider, requests } = mock([companies([company], 1, { [header]: '0' })], { executivesEnabled: false })
    await search(provider)
    await assert.rejects(search(provider), { code: 'rate_limited' })
    assert.equal(requests.length, 1)
  }
  for (const options of [{ searchRequestsPerMinute: 1 }, { searchRequestsPerDay: 1 }]) {
    const { provider, requests } = mock([companies()], { ...options, executivesEnabled: false })
    await search(provider)
    await assert.rejects(search(provider), { code: 'rate_limited' })
    assert.equal(requests.length, 1)
  }
})

test('caller cancellation is a timeout, and cancellation during enrichment preserves company data', async () => {
  const controller = new AbortController()
  controller.abort()
  const stopped = mock([])
  await assert.rejects(search(stopped.provider, controller.signal), { code: 'provider_timeout' })
  assert.equal(stopped.requests.length, 0)
  const partialController = new AbortController()
  const provider = new SkrappProvider({ apiKey: TEST_KEY }, (async (input) => {
    if (String(input).includes('/search?')) return companies()
    partialController.abort()
    throw new Error('aborted')
  }) as typeof fetch)
  const partial = await search(provider, partialController.signal)
  assert.equal(partial.matches[0].peopleStatus, 'provider_timeout')
  assert.equal(partial.matches[0].company.name, 'Example')
})

test('verification starts unverified and requires company plus usable executives to pass', async () => {
  const stripe = { ...company, name: 'Stripe', domain: 'stripe.com' }
  const { provider, requests } = mock([companies([stripe]), enrichment()])
  assert.equal(provider.verification.status, 'not_run')
  const result = await provider.verifyConnection()
  assert.equal(result.status, 'passed')
  assert.equal(result.companySearch, 'passed')
  assert.equal(result.executiveEnrichment, 'passed')
  assert.equal(result.executiveCount, 2)
  assert.ok(result.checkedAt)
  assert.equal(requests[0].url.searchParams.get('size'), '1')
  assert.deepEqual(JSON.parse(String(requests[0].options?.body)).companyDomains, ['stripe.com'])
  assert.doesNotMatch(JSON.stringify(result), /skrapp-test-only|Test Founder|Test Executive|api_key|name|domain/)
  const partial = mock([companies([stripe]), new Response('{}', { status: 403 })]).provider
  assert.equal((await partial.verifyConnection()).status, 'partial')
  assert.equal(partial.verification.executiveEnrichment, 'provider_access_denied')
  const empty = mock([companies([stripe]), enrichment(company.internal_id, [])]).provider
  assert.equal((await empty.verifyConnection()).status, 'partial')
  assert.equal(empty.verification.executiveEnrichment, 'no_data')
  assert.equal((await mock([companies([])]).provider.verifyConnection()).status, 'failed')
  const wrong = mock([companies()])
  assert.equal((await wrong.provider.verifyConnection()).status, 'failed')
  assert.equal(wrong.requests.length, 1)
})

test('concurrent verification shares one execution, and automatic verification is Render-only', async () => {
  const { provider, requests } = mock([companies([{ ...company, name: 'Stripe', domain: 'stripe.com' }]), enrichment()])
  const [first, second] = await Promise.all([provider.verifyConnection(), provider.verifyConnection()])
  assert.deepEqual(first, second)
  assert.equal(requests.length, 2)
  assert.equal(shouldVerifyOnStartup(provider, {}), false)
  assert.equal(shouldVerifyOnStartup(provider, { RENDER: 'true' }), true)
  assert.equal(shouldVerifyOnStartup(provider, { RENDER: 'true', SKRAPP_VERIFY_ON_STARTUP: 'false' }), false)
  assert.equal(shouldVerifyOnStartup(createDiscoveryProvider({}), { RENDER: 'true' }), false)
})
