import test from 'node:test'
import assert from 'node:assert/strict'
import { SkrappProvider } from '../src/discovery/providers/skrapp'
import type { Company } from '../src/discovery/types'
import { companyDetailsSnapshot, permittedSnapshot } from '../src/services/history'

const KEY = 'company-profile-test-key-not-real'
const base: Company = { id: '8342903258370330161', name: 'Stripe', source: 'approved-source' }
const signal = () => new AbortController().signal
const json = (body: unknown, headers?: HeadersInit) => new Response(JSON.stringify(body), { headers })
const response = (data: unknown, id = base.id, headers?: HeadersInit) => json({
  id, company_name: 'Stripe', domain: 'stripe.com', total_cost: 1, last_updated_at: '2026-05-28T00:00:00.000Z',
  categories: { firmographics: { cost: 1, data } },
}, headers)
const mock = (responses: Response[], options: ConstructorParameters<typeof SkrappProvider>[0] = {}) => {
  const requests: { url: URL; options?: RequestInit }[] = []
  const provider = new SkrappProvider({ apiKey: KEY, ...options }, (async (url, options) => {
    requests.push({ url: new URL(String(url)), options })
    assert.ok(responses.length, 'Unexpected provider request')
    return responses.shift()!
  }) as typeof fetch)
  return { provider, requests, details: (refresh = false) => provider.getCompanyDetails(base, { signal: signal(), refresh }) }
}

// Verbatim field values from Skrapp's public v3 response examples, retrieved
// 2026-11-09 at https://skrapp.io/api#company-search and #company-enrich.
// These are documentation contract tests, not authenticated live verification.
const stripeExample = {
  company_name: 'Stripe', company_legal_name: 'Stripe, LLC.', domain: 'stripe.com',
  description_short: 'Stripe, Inc. is a payment-processing software provider that serves businesses of various sizes.',
  industry: 'Technology, Information and Internet', type: 'Privately Held', founded_year: 2010,
  employees_range: '10,001+', linkedin_employees_count: 15356, linkedin_employees_range: '10,001+',
  hq_location: 'South San Francisco, California, United States', is_public: false,
}
const swapcardExample = {
  id: 'eMjwWd8bgOC5yKmKEo_G_cfAe7lFFIP5_uJkheLKRuF0CQc', internal_id: '5462236887991785263',
  name: 'Swapcard', domain: 'swapcard.com', website: 'https://www.swapcard.com', industry: 'Software Development',
  type: 'Privately Held', founded: 2014, linkedin_url: 'https://www.linkedin.com/company/swapcard',
  revenue_range: '10m_50m', revenue_range_formatted: '10M-50M USD', hq_location: 'Paris, Île-de-France',
  activity_status: 'Active', employee_count_range: '51-200', city: 'Paris', country: 'France', geo_area: 'Île-de-France',
  logo_url: 'https://logos-cdn.skrapp.io/logos/swapcard.com', lead_count: 145,
}

test('documented search response preserves French headquarters, domain, size and official website', async () => {
  const { provider, requests } = mock([json({ results: [swapcardExample], meta: { total_all: 614 } })], { executivesEnabled: false })
  const found = await provider.search('Swapcard', { signal: signal() })
  const { company } = permittedSnapshot(found.matches[0])
  assert.equal(company.id, swapcardExample.internal_id)
  assert.equal(company.country, 'France'); assert.equal(company.city, 'Paris'); assert.equal(company.region, 'Île-de-France')
  assert.equal(company.location, 'Paris, Île-de-France')
  assert.equal(company.employeeRange, '51-200'); assert.equal(company.linkedinEmployeeCount, undefined)
  assert.equal(company.website, 'https://www.swapcard.com/'); assert.equal(company.domain, 'swapcard.com')
  assert.equal(company.companyType, 'Privately Held'); assert.equal(company.foundedYear, 2014)
  assert.equal(company.logoUrl, swapcardExample.logo_url); assert.equal(company.profileUrl, swapcardExample.linkedin_url)
  assert.equal(company.description, undefined)
  assert.equal(requests.length, 1, 'Profiles load only after selection')
})

test('documented firmographics description and LinkedIn size are mapped without generating facts', async () => {
  const { details, requests } = mock([response({ ...stripeExample, api_key: KEY, metadata: { secret: KEY } })])
  const profile = companyDetailsSnapshot(await details(), base.id)
  assert.equal(profile.status, 'available')
  assert.equal(profile.company?.description, stripeExample.description_short)
  assert.equal(profile.descriptionField, 'description_short')
  assert.equal(profile.company?.location, stripeExample.hq_location)
  assert.equal(profile.company?.country, undefined, 'Do not infer a country by parsing display strings')
  assert.equal(profile.company?.employeeRange, '10,001+')
  assert.equal(profile.company?.linkedinEmployeeCount, 15356)
  assert.equal(profile.company?.legalName, 'Stripe, LLC.')
  assert.equal(profile.company?.foundedYear, 2010)
  assert.equal(profile.providerUpdatedAt, '2026-05-28T00:00:00.000Z')
  assert.equal(profile.company?.attribution?.recordId, base.id)
  assert.equal(requests[0].url.origin, 'https://api.skrapp.io')
  assert.equal(requests[0].url.pathname, '/api/v3/companies/enrich')
  assert.deepEqual([...requests[0].url.searchParams], [['id', base.id], ['categories', 'firmographics']])
  assert.equal(requests[0].options?.method, 'GET')
  assert.equal(requests[0].options?.redirect, 'error')
  assert.equal(new Headers(requests[0].options?.headers).get('x-access-key'), KEY)
  assert.doesNotMatch(JSON.stringify(profile), /api_key|metadata|test-key|employeeCount/)
})

test('structured headquarters use hq_country, hq_city and hq_state across international formats', async () => {
  // Synthetic records exercise geography and Unicode; they are not company facts.
  for (const [country, city, state] of [['Nigeria', 'Lagos', 'Lagos'], ['Canada', 'Ottawa', 'Ontario'], ['Japan', '京都市', '京都府'], ['Germany', 'München', 'Bayern']]) {
    const { details } = mock([response({ hq_country: country, hq_city: city, hq_state: state,
      hq_full_address: `${city}, ${state}, ${country}`, country: 'Do not map', city: 'Do not map', geo_area: 'Do not map',
      hq_region: ['Do not use world regions as states'], company_logo: 'https://example.com/logo.png', website: 'https://www.example.com',
      domain: 'mail.example.com', linkedin_url: 'https://linkedin.com/company/example', employees_range: '11-50', linkedin_employees_count: 0 })])
    const company = (await details()).company!
    assert.equal(company.country, country); assert.equal(company.city, city); assert.equal(company.region, state)
    assert.equal(company.location, `${city}, ${state}, ${country}`)
    assert.equal(company.logoUrl, 'https://example.com/logo.png'); assert.equal(company.domain, 'mail.example.com')
    assert.equal(company.website, 'https://www.example.com/'); assert.equal(company.linkedinEmployeeCount, 0)
  }
})

test('descriptions follow long, short, then website description; blank or absent facts stay absent', async () => {
  for (const [data, field, expected] of [
    [{ description: 'Full supplied description.', description_short: 'Short.', meta_description: 'Website.' }, 'description', 'Full supplied description.'],
    [{ description: null, description_short: '  Short.  ', meta_description: 'Website.' }, 'description_short', 'Short.'],
    [{ description: '  ', description_short: null, meta_description: 'Website.' }, 'meta_description', 'Website.'],
    [{ specialities: ['Software'], industry: 'Software', hq_location: 'Somewhere' }, undefined, undefined],
  ] as const) {
    const profile = await mock([response(data)]).details()
    assert.equal(profile.company?.description, expected); assert.equal(profile.descriptionField, field)
  }
  const long = 'A supplied description. '.repeat(400)
  assert.equal((await mock([response({ description: long })]).details()).company?.description, long.trim())
  const absent = await mock([response({ website: null, domain: 'mail.example.com', employees_range: null, hq_country: null })]).details()
  assert.equal(absent.status, 'available'); assert.equal(absent.company?.website, undefined)
  assert.equal(absent.company?.employeeRange, undefined); assert.equal(absent.company?.country, undefined)
  const empty = await mock([response(null)]).details()
  assert.equal(empty.status, 'unavailable'); assert.equal(empty.company, undefined)
})

test('malformed profiles, costs and mismatched IDs are errors, not unavailable fields', async () => {
  for (const body of [
    response({}, '123'), response({}, String(Number(base.id))), response({ description: ['not text'] }),
    response({ linkedin_employees_count: -1 }), response({ hq_country: { name: 'Nigeria' } }),
    json({ id: base.id, total_cost: 1, categories: { firmographics: { cost: 1 } } }),
    json({ id: Number(base.id), total_cost: 1, categories: { firmographics: { cost: 1, data: null } } }),
    json({ id: base.id, total_cost: 2, categories: { firmographics: { cost: 2, data: {} } } }),
    json({ id: base.id, total_cost: 1, categories: { firmographics: { cost: 0, data: {} } } }),
    json({ id: base.id, total_cost: 1, categories: { firmographics: { cost: 1, data: {} }, contacts: {} } }),
  ]) await assert.rejects(mock([body]).details(), { code: 'provider_error' })
  const unsafe = await mock([response({ website: 'javascript:alert(1)', company_logo: 'data:image/png;base64,x', linkedin_url: 'https://user:pass@example.com', domain: 'bad/path' })]).details()
  assert.equal(unsafe.company?.website, undefined); assert.equal(unsafe.company?.logoUrl, undefined)
  assert.equal(unsafe.company?.profileUrl, undefined); assert.equal(unsafe.company?.domain, undefined)
})

test('only projected profiles are cached, refresh bypasses cache, and callers cannot mutate cached data', async () => {
  const { details, requests } = mock([response({ description: 'First.' }), response({ description: 'Updated.' })])
  const first = await details(); assert.equal(first.cached, false); assert.ok(first.expiresAt)
  first.company!.description = 'Changed by caller'
  const second = await details(); assert.equal(second.cached, true); assert.equal(second.company?.description, 'First.')
  assert.equal(requests.length, 1)
  const refreshed = await details(true); assert.equal(refreshed.cached, false); assert.equal(refreshed.company?.description, 'Updated.')
  assert.equal(requests.length, 2)
})

test('cache expiry and provider no-store, no-cache, max-age and Age restrictions are respected', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-09T00:00:00Z') })
  const expires = mock([response({}, base.id, { 'Cache-Control': 'private, max-age=2', Age: '1' }), response({})])
  assert.equal((await expires.details()).expiresAt, '2026-11-09T00:00:01.000Z')
  t.mock.timers.tick(1500)
  assert.equal((await expires.details()).cached, false); assert.equal(expires.requests.length, 2)
  for (const cacheControl of ['private, no-store', 'no-cache', 'max-age=0']) {
    const none = mock([response({}, base.id, { 'Cache-Control': cacheControl }), response({})])
    assert.equal((await none.details()).expiresAt, undefined)
    assert.equal((await none.details()).cached, false); assert.equal(none.requests.length, 2)
  }
  assert.equal((await mock([response({})], { companyCacheTtlSeconds: 0 }).details()).expiresAt, undefined)
})

test('failed refreshes invalidate cache and are never recorded as a successful empty profile', async () => {
  for (const [status, code] of [[401, 'provider_access_denied'], [402, 'quota_exceeded'], [429, 'rate_limited'], [500, 'provider_error'], [504, 'provider_timeout']] as const) {
    const api = mock([response({ description: 'Old.' }), new Response(KEY, { status }),
      ...([401, 402].includes(status) ? [new Response(KEY, { status: 503 })] : []), response({ description: 'New.' })])
    await api.details()
    await assert.rejects(api.details(true), (error: any) => error.code === code && !error.message.includes(KEY))
    if (status !== 429) assert.equal((await api.details()).company?.description, 'New.')
  }
})

test('concurrent profile requests share a call while one caller cancelling cannot cancel another', async () => {
  let release!: () => void
  let calls = 0
  const provider = new SkrappProvider({ apiKey: KEY }, (async () => {
    calls++; await new Promise<void>(resolve => { release = resolve }); return response(stripeExample)
  }) as typeof fetch)
  const controller = new AbortController()
  const first = provider.getCompanyDetails(base, { signal: controller.signal })
  const second = provider.getCompanyDetails(base, { signal: signal() })
  controller.abort(); release()
  await assert.rejects(first, { code: 'provider_timeout' })
  assert.equal((await second).status, 'available'); assert.equal(calls, 1)
})

test('snapshot validation rejects mismatched profile attribution and strips arbitrary metadata', async () => {
  const details = await mock([response(stripeExample)]).details()
  assert.throws(() => companyDetailsSnapshot(details, 'different-company'))
  assert.throws(() => companyDetailsSnapshot({ ...details, descriptionField: 'invented' as any }, base.id))
  assert.throws(() => companyDetailsSnapshot({ ...details, company: { ...details.company!, attribution: { ...details.company!.attribution!, recordId: 'other' } } }, base.id))
  const snapshot = companyDetailsSnapshot({ ...details, company: { ...details.company!, metadata: { secret: KEY } } }, base.id)
  assert.equal(snapshot.company?.metadata, undefined)
})

// The flat snapshot example from https://skrapp.io/api#company-snapshot.
const stripeSnapshot = { id: base.id, company_name: 'Stripe', domain: 'stripe.com', domain_region: null,
  website: 'https://www.stripe.com', linkedin_url: 'https://www.linkedin.com/company/stripe',
  company_logo: 'https://logos-cdn.skrapp.io/logos/stripe.com', industry: 'Technology, Information and Internet',
  employees_range: '10,001+', revenue_range: 'gte_10b', revenue_range_formatted: '10B+ USD',
  hq_location: 'South San Francisco, California, United States', hq_country: 'United States',
  hq_state: 'California', hq_city: 'South San Francisco', type: 'Privately Held', founded_year: 2010, activity_status: 'Active' }

test('credit/trial failures use the free flat snapshot while retaining the description failure', async () => {
  for (const [status, failure] of [[402, 'quota_exceeded'], [403, 'provider_access_denied']] as const) {
    const api = mock([new Response(KEY, { status }), json({ ...stripeSnapshot, description: 'Undocumented field', linkedin_employees_count: 99 })])
    const details = companyDetailsSnapshot(await api.details(), base.id)
    assert.equal(details.status, 'available'); assert.equal(details.enrichmentStatus, failure)
    assert.equal(details.profileSource, 'snapshot'); assert.equal(details.company?.description, undefined)
    assert.equal(details.company?.linkedinEmployeeCount, undefined)
    assert.equal(details.company?.country, 'United States'); assert.equal(details.company?.city, 'South San Francisco')
    assert.equal(details.company?.region, 'California'); assert.equal(details.company?.employeeRange, '10,001+')
    assert.equal(details.company?.logoUrl, stripeSnapshot.company_logo)
    assert.equal(details.expiresAt, undefined); assert.equal(details.cached, false)
    assert.equal(api.requests.length, 2)
    assert.equal(api.requests[1].url.pathname, '/api/v3/companies/snapshot')
    assert.equal(api.requests[1].url.search, '?id=' + base.id)
    assert.equal(api.requests[1].options?.method, 'GET')
    assert.equal(new Headers(api.requests[1].options?.headers).get('X-Access-Key'), KEY)
    assert.ok(!JSON.stringify(details).includes(KEY))
  }
})

test('a mismatched snapshot cannot replace the selected company and failed snapshots keep the original error', async () => {
  for (const fallback of [json({ ...stripeSnapshot, id: '123' }), json({ ...stripeSnapshot, id: Number(base.id) }),
    new Response(null, { status: 404 }), new Response(KEY, { status: 429 })]) {
    const api = mock([new Response(null, { status: 402 }), fallback])
    await assert.rejects(api.details(), { code: 'quota_exceeded' })
    assert.equal(api.requests.length, 2)
  }
})

test('snapshot fallback is not retained in the provider cache; refresh can recover a real description', async () => {
  const api = mock([new Response(null, { status: 402 }), json(stripeSnapshot), response(stripeExample)])
  assert.equal((await api.details()).profileSource, 'snapshot')
  const recovered = await api.details()
  assert.equal(recovered.profileSource, 'firmographics'); assert.equal(recovered.enrichmentStatus, undefined)
  assert.equal(recovered.company?.description, stripeExample.description_short)
  assert.equal(api.requests.length, 3)
})

test('snapshot provenance and description claims are validated before saving history', () => {
  const details = { status: 'available' as const, company: base, profileSource: 'snapshot' as const,
    enrichmentStatus: 'quota_exceeded' as const, checkedAt: new Date().toISOString(), cached: false }
  assert.equal(companyDetailsSnapshot(details, base.id).enrichmentStatus, 'quota_exceeded')
  assert.throws(() => companyDetailsSnapshot({ ...details, company: { ...base, description: 'Not in snapshot schema' } }, base.id))
  assert.throws(() => companyDetailsSnapshot({ ...details, profileSource: 'firmographics' }, base.id))
  assert.throws(() => companyDetailsSnapshot({ ...details, profileSource: 'unknown' as any }, base.id))
})

test('explicit company verification uses at most four requests across two countries, with no fallback', async () => {
  const bmwId = '1234567890123456789'
  const rows = [
    json({ results: [{ internal_id: base.id, name: 'Stripe', domain: 'stripe.com' }], meta: { total_all: 1 } }),
    response({ ...stripeExample, hq_country: 'United States' }),
    json({ results: [{ internal_id: bmwId, name: 'BMW Group', domain: 'bmwgroup.com' }], meta: { total_all: 1 } }),
    json({ id: bmwId, total_cost: 1, categories: { firmographics: { cost: 1, data: {
      company_name: 'BMW Group', domain: 'bmwgroup.com', hq_country: 'Germany', industry: 'Test industry', description: 'Test fixture description.' } } } }),
  ]
  const api = mock(rows)
  assert.equal((await api.provider.verifyCompanyInformation()).status, 'passed')
  assert.equal(api.requests.length, 4)
  assert.ok(api.requests.every(request => !request.url.pathname.endsWith('/snapshot')))
  const failure = mock([json({ results: [{ internal_id: base.id, name: 'Stripe', domain: 'stripe.com' }], meta: { total_all: 1 } }), new Response(null, { status: 402 })])
  assert.equal((await failure.provider.verifyCompanyInformation()).companies[0].status, 'quota_exceeded')
  assert.equal(failure.requests.length, 2, 'Stop immediately on quota failure')
})
