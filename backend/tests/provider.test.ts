import test from 'node:test'
import assert from 'node:assert/strict'
import { PeopleDataLabsProvider, personCandidate } from '../src/discovery/providers/peopleDataLabs'
import { createDiscoveryProvider } from '../src/discovery/provider'
import { permittedSnapshot } from '../src/services/history'
import { normalizeQuery, validQuery } from '../src/discovery/validation'

const env = { PDL_API_KEY: 'test-only-key', PDL_ALLOW_RESULT_STORAGE: 'true', PDL_PERSON_SEARCH_ENABLED: 'true' }
const company = { id: 'company-a', name: 'Example', source: 'approved-source' as const }
const record = { id: 'company-a', name: 'example', display_name: 'Example', website: 'example.com', location: { name: 'Lagos' }, linkedin_url: 'linkedin.com/company/example' }
const person = { id: 'person-a', full_name: 'Test Founder', linkedin_url: 'linkedin.com/in/test-founder', experience: [
  { company: { id: 'company-a' }, title: { name: 'co-founder and CEO', levels: ['cxo'] }, is_primary: true, start_date: '2020-01', end_date: null, last_seen: '2026-10-01', num_sources: 2 },
] }
const json = (data: unknown[], total = data.length) => new Response(JSON.stringify({ status: 200, data, total }))
const search = (provider: PeopleDataLabsProvider) => provider.search('Example', { signal: new AbortController().signal })
const mockProvider = (responses: Response[], overrides = {}) => {
  const requests: { url: string; options?: RequestInit }[] = []
  const provider = new PeopleDataLabsProvider({ ...env, ...overrides }, (async (url, options) => {
    requests.push({ url: String(url), options }); const response = responses.shift(); assert.ok(response, 'unexpected API request'); return response
  }) as typeof fetch)
  return { provider, requests }
}

test('normalization and validation reject control-only, oversized, and non-string input', () => {
  assert.equal(normalizeQuery('  Ａcme   Inc  '), 'acme inc')
  for (const value of ['', ' ', 'a', {}, ['Example'], 'x'.repeat(161), 'x\u0000y', '---']) assert.equal(validQuery(value), false)
  assert.equal(validQuery('Énergie & Co.'), true)
})

test('missing credentials/storage rights disable discovery without a request', async () => {
  assert.equal(createDiscoveryProvider({}).available, false)
  for (const config of [{}, { PDL_API_KEY: 'test-only-key' }, { PDL_ALLOW_RESULT_STORAGE: 'true' }]) {
    const { provider, requests } = mockProvider([], { PDL_API_KEY: '', PDL_ALLOW_RESULT_STORAGE: 'false', ...config })
    assert.equal(provider.available, false)
    await assert.rejects(search(provider), { code: 'provider_access_denied' })
    assert.equal(requests.length, 0)
  }
})

test('company and founder evidence are projected; no emails, credentials, metadata or paths', async () => {
  const { provider, requests } = mockProvider([json([{ ...record, api_key: 'must-not-leak', metadata: { secret: true } }]), json([{ ...person, emails: ['private@example.com'] }])])
  const found = await search(provider)
  const result = permittedSnapshot(found.matches[0])
  assert.equal(result.company.website, 'https://example.com/')
  assert.equal(result.people?.[0].role, 'founder')
  assert.equal(result.people?.[0].evidence?.[0].sourceCount, 2)
  assert.equal(result.people?.[0].evidence?.[0].affiliation, 'current')
  assert.equal(result.people?.[0].verification?.confidence, 'provider-supported')
  assert.equal(result.paths, null)
  assert.deepEqual(result.connections, [])
  const serialized = JSON.stringify(result)
  assert.doesNotMatch(serialized, /test-only-key|private@example|must-not-leak|metadata|"score"/)
  assert.equal(requests[0].url, 'https://api.peopledatalabs.com/v5/company/search')
  assert.equal(new Headers(requests[0].options?.headers).get('x-api-key'), 'test-only-key')
  assert.deepEqual(JSON.parse(String(requests[0].options?.body)).query, { query: { term: { name: 'example' } } })
})

test('founder claim must belong to the same employment entry and explicit founder title', () => {
  const crossCompany = { ...person, experience: [
    { company: { id: 'company-b' }, title: { name: 'founder' } },
    { company: { id: 'company-a' }, title: { name: 'engineer' } },
  ] }
  assert.equal(personCandidate(crossCompany, company), null)
  for (const title of ["founder's associate", 'assistant to founder', 'founding engineer', 'founder of Another Company']) {
    assert.equal(personCandidate({ ...person, experience: [{ company: { id: 'company-a' }, title: { name: title } }] }, company), null)
  }
  const former = personCandidate({ ...person, experience: [{ ...person.experience[0], is_primary: false, end_date: '2024-05' }] }, company)
  assert.equal(former?.evidence?.[0].affiliation, 'historical')
  const executive = personCandidate({ id: 'exec', full_name: 'Executive', job_company_id: 'company-a', job_title: 'CEO', job_title_levels: ['cxo'] }, company)
  assert.equal(executive?.role, 'executive')
})

test('multiple companies remain separate and partial prefix matches are explicit', async () => {
  const { provider, requests } = mockProvider([json([]), json([record, { ...record, id: 'company-b', name: 'example systems' }], 8)], { PDL_PERSON_SEARCH_ENABLED: 'false' })
  const found = await search(provider)
  assert.equal(found.matchMode, 'prefix'); assert.equal(found.total, 8); assert.equal(found.matches.length, 2)
  assert.deepEqual(JSON.parse(String(requests[1].options?.body)).query, { query: { prefix: { name: 'example' } } })
  assert.equal(found.matches[0].peopleStatus, 'not_configured')
})

test('company persists when people are absent, malformed, rate limited or unavailable', async () => {
  for (const [response, status] of [
    [json([]), 'no_candidates'], [json([{ id: null }]), 'provider_error'],
    [new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }), 'rate_limited'],
    [new Response('{}', { status: 403 }), 'provider_access_denied'],
    [new Response('{}', { status: 402 }), 'quota_exceeded'],
    [new Response('{}', { status: 500 }), 'provider_error'],
  ] as const) {
    const { provider } = mockProvider([json([record]), response])
    const found = await search(provider)
    assert.equal(found.matches[0].company.id, 'company-a')
    assert.equal(found.matches[0].peopleStatus, status)
    assert.equal(found.matches[0].people?.length, 0)
  }
})

test('no results supports documented empty 200 and not_found 404', async () => {
  const { provider } = mockProvider([json([]), new Response(JSON.stringify({ status: 404, error: { type: 'not_found' } }), { status: 404 })])
  assert.deepEqual((await search(provider)).matches, [])
})

test('malformed/oversized responses and provider errors never become no results', async () => {
  for (const response of [new Response('not json'), json([{ name: 'Missing ID' }]), new Response('x'.repeat(2_000_001)), new Response('{}', { status: 500 }), new Response('{}', { status: 404 })]) {
    await assert.rejects(search(mockProvider([response]).provider), { code: 'provider_error' })
  }
  for (const [status, code] of [[401, 'provider_access_denied'], [402, 'quota_exceeded'], [429, 'rate_limited']] as const) {
    await assert.rejects(search(mockProvider([new Response('{}', { status })]).provider), { code })
  }
})

test('honors Retry-After and advertised rate reset without retrying provider', async () => {
  const { provider, requests } = mockProvider([new Response('{}', { status: 429, headers: { 'Retry-After': '120' } })])
  await assert.rejects(search(provider), (error: any) => error.code === 'rate_limited' && error.retryAfterSeconds >= 119)
  await assert.rejects(search(provider), { code: 'rate_limited' })
  assert.equal(requests.length, 1)
  const exhausted = mockProvider([new Response(JSON.stringify({ status: 200, data: [record], total: 1 }), { headers: { 'x-ratelimit-remaining': '{"minute":0}', 'x-ratelimit-reset': new Date(Date.now() + 60_000).toISOString() } })], { PDL_PERSON_SEARCH_ENABLED: 'false' })
  await search(exhausted.provider)
  await assert.rejects(search(exhausted.provider), { code: 'rate_limited' })
  assert.equal(exhausted.requests.length, 1)
})

test('timeouts are classified, and aborted people lookup preserves company', async () => {
  const slow: typeof fetch = async (_url, options) => new Promise((_resolve, reject) => {
    const signal = options!.signal!; if (signal.aborted) reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  const provider = new PeopleDataLabsProvider(env, slow)
  const controller = new AbortController()
  const promise = provider.search('Example', { signal: controller.signal }); controller.abort()
  await assert.rejects(promise, { code: 'provider_timeout' })
  const peopleController = new AbortController()
  const partial = new PeopleDataLabsProvider(env, (async (url, options) => {
    if (String(url).includes('/company/')) return json([record])
    peopleController.abort(); return slow(url, options)
  }) as typeof fetch)
  const found = await partial.search('Example', { signal: peopleController.signal })
  assert.equal(found.matches[0].peopleStatus, 'provider_timeout')
  assert.equal(found.matches[0].company.id, 'company-a')
})

test('projection rejects existing fixture results', () => {
  assert.throws(() => permittedSnapshot({ company: { ...company, source: 'local-fixture' }, source: 'local-fixture', paths: null, generatedAt: new Date().toISOString(), warnings: [] }))
})
