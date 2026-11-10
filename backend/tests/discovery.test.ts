import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createApp } from '../src/app'
import { generateToken } from '../src/config/auth'
import SearchHistory from '../src/models/SearchHistory'
import User from '../src/models/User'
import type { DiscoveryProvider } from '../src/discovery/provider'
import { ProviderError } from '../src/discovery/errors'
import type { Company, CompanyDetails, DiscoveryResult } from '../src/discovery/types'
import { SkrappProvider } from '../src/discovery/providers/skrapp'
import { CandidateIdentity, NetworkPerson, NetworkRelationship, NetworkState, initializeNetworkIndexes } from '../src/models/Network'
import { CSV_COLUMNS } from '../src/network/csv'
import { discoverIntroductionPaths } from '../src/network/discoverPaths'
import { importNetwork } from '../src/network/store'

let mongo: MongoMemoryServer, server: Server, base: string, token: string, otherToken: string
let calls = 0
let detailCalls = 0
const sample: DiscoveryResult = { company: { id: 'test-company', name: 'Test Company', source: 'approved-source', attribution: { provider: 'Test provider', recordId: 'test-company', retrievedAt: '2026-11-07T00:00:00.000Z', reliability: 'aggregated-provider-data' } }, people: [], paths: null, source: 'approved-source', generatedAt: '2026-11-07T00:00:00.000Z', warnings: [], peopleStatus: 'no_candidates', connectionStatus: 'unavailable' }
let run: DiscoveryProvider['search'] = async () => ({ matches: [sample], total: 1, matchMode: 'exact' })
let runDetails: NonNullable<DiscoveryProvider['getCompanyDetails']> = async company => profileFor(company)
const provider: DiscoveryProvider = { name: 'test-provider', available: true, snapshotAllowed: true,
  search: (...args) => { calls++; return run(...args) },
  getCompanyDetails: (...args) => { detailCalls++; return runDetails(...args) },
}
const post = (companyName: unknown, key: string, auth = token) => fetch(`${base}/api/discovery/search`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify({ companyName }) })
const get = (path: string, auth = token) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${auth}` } })
// Provider snapshots must survive history reads exactly; network checks are live
// and have their own refreshed timestamp, separate from provider retrieval time.
function assertRestoredMatches(actual: DiscoveryResult[], expected: DiscoveryResult[]) {
  assert.equal(actual.length, expected.length)
  actual.forEach((match, index) => {
    if (!match.introduction && !expected[index].introduction) return
    assert.ok(Number.isFinite(Date.parse(match.introduction!.checkedAt)))
    assert.ok(Date.parse(match.introduction!.checkedAt) >= Date.parse(expected[index].introduction!.checkedAt))
  })
  const withoutCheckTime = (matches: DiscoveryResult[]) => matches.map(match => ({ ...match,
    ...(match.introduction ? { introduction: { ...match.introduction, checkedAt: undefined } } : {}),
  }))
  assert.deepEqual(withoutCheckTime(actual), withoutCheckTime(expected))
}
const details = (searchId: string, companyId = sample.company.id, refresh: unknown = false, auth = token) => fetch(`${base}/api/discovery/company-details`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
  body: JSON.stringify({ searchId, companyId, refresh }),
})
function profileFor(company: Company): CompanyDetails {
  return { status: 'available', company: { ...company, description: 'A description supplied by the test provider.',
    country: 'Nigeria', city: 'Lagos', region: 'Lagos', domain: 'example.com', employeeRange: '11-50' },
    checkedAt: '2026-11-09T00:00:00.000Z', retrievedAt: '2026-11-09T00:00:00.000Z', cached: false, descriptionField: 'description' }
}

before(async () => {
  process.env.JWT_SECRET = 'discovery-test-secret-at-least-32-characters'
  process.env.JWT_EXPIRES_IN = '1h'
  mongo = await MongoMemoryServer.create({ binary: { downloadDir: '/tmp/intro-finder-mongodb', version: process.env.MONGOMS_VERSION ?? '7.0.24' }, instance: { storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongo.getUri())
  await SearchHistory.init()
  await initializeNetworkIndexes()
  const users = await User.create([{ name: 'Test User', email: 'test@example.com', password: 'test-password' }, { name: 'Other User', email: 'other@example.com', password: 'test-password' }])
  token = generateToken(String(users[0]._id), users[0].email)
  otherToken = generateToken(String(users[1]._id), users[1].email)
  server = createApp(provider).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  await mongoose.disconnect(); if (mongo) await mongo.stop()
})

test('JWT required; malformed requests never contact provider', async () => {
  const beforeCalls = calls
  assert.equal((await post('Test Company', 'unauthorized', '')).status, 401)
  assert.equal((await post('Test Company', 'bad-token-key', 'invalid')).status, 401)
  assert.equal((await post('Test Company', 'bad')).status, 400)
  assert.equal(calls, beforeCalls)
})

test('successful search persists and replays exactly once; account ownership enforced', async () => {
  let normalized = ''
  run = async query => { normalized = query; return { matches: [sample], total: 1, matchMode: 'exact' } }
  const beforeCalls = calls
  const response = await post('  Ｔest   Company ', 'success-key')
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const record = await response.json()
  assert.equal(record.outcome, 'success'); assert.equal(normalized, 'test company')
  assert.equal(record.matches[0].company.name, 'Test Company')
  assert.equal((await post('  Ｔest   Company ', 'success-key')).status, 200)
  assert.equal(calls, beforeCalls + 1)
  assert.equal(await SearchHistory.countDocuments({ requestId: 'success-key' }), 1)
  assert.equal((await post('Different', 'success-key')).status, 409)
  assert.equal((await get(`/api/history/${record.id}`, otherToken)).status, 404)
  const detail = await (await get(`/api/history/${record.id}`)).json()
  assertRestoredMatches(detail.matches, record.matches)
  const history = await (await get('/api/history?q=Test')).json()
  assert.ok(history.records.some((item: { id: string }) => item.id === record.id))
  assert.equal('matches' in history.records[0], false)
})

test('concurrent duplicates return pending; one record and one provider call', async () => {
  let finish!: () => void, entered!: () => void
  const ready = new Promise<void>(resolve => { entered = resolve })
  run = async () => { entered(); await new Promise<void>(resolve => { finish = resolve }); return { matches: [sample], total: 1, matchMode: 'exact' } }
  const beforeCalls = calls
  const first = post('Concurrent Company', 'concurrent-key')
  await ready
  const pending = await post('Concurrent Company', 'concurrent-key')
  assert.equal(pending.status, 202)
  const pendingRecord = await pending.json()
  assert.equal(pendingRecord.status, 'pending')
  finish(); assert.equal((await first).status, 201)
  assert.equal(calls, beforeCalls + 1)
  assert.equal(await SearchHistory.countDocuments({ requestId: 'concurrent-key' }), 1)
})

test('ambiguous matches persist without silently choosing a company', async () => {
  run = async () => ({ matches: [sample, { ...sample, company: { ...sample.company, id: 'second', name: 'Test Company UK', attribution: { ...sample.company.attribution!, recordId: 'second' } } }], total: 9, matchMode: 'prefix' })
  const record = await (await post('Test', 'ambiguous-key')).json()
  assert.equal(record.outcome, 'ambiguous'); assert.equal(record.company, null); assert.equal(record.result, null)
  assert.equal(record.totalMatches, 9); assert.equal(record.matches.length, 2)
  assertRestoredMatches((await (await get(`/api/history/${record.id}`)).json()).matches, record.matches)
})

test('a single relevance match is saved for explicit selection, not treated as an exact match', async () => {
  run = async () => ({ matches: [sample], total: 1, matchMode: 'relevance' })
  const response = await post('Related name', 'relevance-key')
  assert.equal(response.status, 201)
  const record = await response.json()
  assert.equal(record.outcome, 'ambiguous')
  assert.equal(record.result, null)
  assert.equal(record.company, null)
  const restored = await (await get('/api/history/' + record.id)).json()
  assert.equal(restored.matchMode, 'relevance')
  assert.equal(restored.matches[0].company.name, 'Test Company')
})

test('Skrapp projection survives the authenticated HTTP and MongoDB flow without leaking the key', async () => {
  const fakeKey = 'integration-test-only-skrapp-key'
  let upstreamCalls = 0
  const skrapp = new SkrappProvider({ apiKey: fakeKey }, (async input => {
    upstreamCalls++
    return new Response(JSON.stringify(String(input).includes('/search?') ? {
      results: [{ id: 'encoded', internal_id: '8342903258370330161', name: 'Example', domain: 'example.com', api_key: fakeKey }],
      meta: { total_all: 1 },
    } : {
      id: '8342903258370330161', total_cost: 3,
      categories: { headcount: { cost: 3, data: { key_executives: [{ member_full_name: 'Test Founder', member_position_title: 'Co-founder' }] } } },
    }))
  }) as typeof fetch)
  const skrappServer = createApp(skrapp).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => skrappServer.once('listening', resolve))
  const origin = 'http://127.0.0.1:' + (skrappServer.address() as { port: number }).port
  try {
    const health = await (await fetch(origin + '/api/health')).json()
    assert.equal(health.discovery.provider, 'skrapp')
    assert.equal(health.discovery.configured, true)
    assert.equal(health.discovery.verification.status, 'not_run')
    assert.equal(upstreamCalls, 0)
    const request = () => fetch(origin + '/api/discovery/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': 'skrapp-http-key' },
      body: JSON.stringify({ companyName: 'Example' }),
    })
    const response = await request()
    assert.equal(response.status, 201)
    const record = await response.json()
    assert.equal(record.outcome, 'success')
    assert.equal(record.provenance.provider, 'skrapp')
    assert.equal(record.matches[0].company.id, '8342903258370330161')
    assert.equal(record.matches[0].people[0].role, 'founder')
    assert.equal(JSON.stringify(record).includes(fakeKey), false)
    assert.equal((await request()).status, 200)
    assert.equal(upstreamCalls, 2)
    const restored = await (await get('/api/history/' + record.id)).json()
    assertRestoredMatches(restored.matches, record.matches)
    assert.equal((await get('/api/history/' + record.id, otherToken)).status, 404)
  } finally {
    skrappServer.closeAllConnections()
    await new Promise<void>(resolve => skrappServer.close(() => resolve()))
  }
})

test('no matches, invalid input, configuration, rate limits, access and provider failures are persisted distinctly', async () => {
  run = async () => ({ matches: [], total: 0, matchMode: 'prefix' })
  assert.equal((await (await post('Nothing', 'no-match-key')).json()).outcome, 'no_matches')
  const beforeCalls = calls
  const invalid = await post('', 'invalid-query-key'); assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).outcome, 'invalid_query'); assert.equal(calls, beforeCalls)
  provider.available = false
  const missing = await post('Missing', 'missing-config-key'); assert.equal(missing.status, 503)
  assert.equal((await missing.json()).outcome, 'provider_unavailable')
  provider.available = true
  for (const [code, status] of [['provider_error', 502], ['rate_limited', 429], ['provider_timeout', 504], ['provider_access_denied', 503], ['quota_exceeded', 503]] as const) {
    run = async () => { throw new ProviderError(code, code === 'rate_limited' ? 60 : undefined) }
    const key = `failure-${code}`
    const response = await post('Failure', key); assert.equal(response.status, status)
    const record = await response.json(); assert.equal(record.outcome, code); assert.equal(record.status, 'failed')
    if (code === 'rate_limited') assert.equal(response.headers.get('retry-after'), '60')
    assert.equal((await post('Failure', key)).status, status)
    assert.equal(await SearchHistory.countDocuments({ requestId: key }), 1)
  }
})

test('deleting an in-flight search prevents its final write from recreating it', async () => {
  let finish!: () => void, entered!: () => void
  const ready = new Promise<void>(resolve => { entered = resolve })
  run = async () => { entered(); await new Promise<void>(resolve => { finish = resolve }); return { matches: [sample], total: 1, matchMode: 'exact' } }
  const request = post('Deleted Company', 'delete-running-key')
  await ready
  const record = await SearchHistory.findOne({ requestId: 'delete-running-key' })
  assert.ok(record)
  assert.equal((await fetch(`${base}/api/history/${record._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status, 204)
  finish(); assert.equal((await request).status, 409)
  assert.equal(await SearchHistory.countDocuments({ requestId: 'delete-running-key' }), 0)
})

test('company details require JWT, valid input, account ownership and an existing match', async () => {
  run = async () => ({ matches: [sample], total: 1, matchMode: 'exact' })
  const record = await (await post('Test Company', 'profile-auth-key')).json()
  const beforeCalls = detailCalls
  assert.equal((await details(record.id, sample.company.id, false, '')).status, 401)
  assert.equal((await details(record.id, sample.company.id, false, otherToken)).status, 404)
  assert.equal((await details('invalid')).status, 400)
  assert.equal((await details(record.id, sample.company.id, 'yes')).status, 400)
  assert.equal((await details(record.id, 'a-company-that-was-not-searched')).status, 404)
  assert.equal(detailCalls, beforeCalls)
})

test('profile loading and refresh persist in history while preserving founder discovery and original outcomes', async () => {
  const withFounder: DiscoveryResult = { ...sample, people: [{ id: 'test-founder', name: 'Test Founder', title: 'Founder', role: 'founder', source: 'approved-source' }], peopleStatus: 'available' }
  run = async () => ({ matches: [withFounder], total: 1, matchMode: 'exact' })
  const record = await (await post('Test Company', 'profile-history-key')).json()
  let refreshing = false
  runDetails = async (company, options) => { refreshing = options.refresh === true; return profileFor(company) }
  const beforeCalls = calls
  const response = await details(record.id, sample.company.id, true)
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  const profile = await response.json()
  assert.equal(profile.company.country, 'Nigeria'); assert.equal(refreshing, true)
  const restored = await (await get('/api/history/' + record.id)).json()
  assert.deepEqual(restored.matches[0].companyDetails, profile)
  assert.deepEqual(restored.result.companyDetails, profile)
  assert.deepEqual(restored.matches[0].people, record.matches[0].people)
  assert.deepEqual(restored.founders, record.founders)
  assert.equal(restored.outcome, 'success'); assert.equal(restored.candidateCount, 1)
  assert.equal(restored.provenance.snapshotVersion, 3)
  assert.equal(calls, beforeCalls)
  assert.equal(await SearchHistory.countDocuments({ requestId: 'profile-history-key' }), 1)
  const replay = await (await post('Test Company', 'profile-history-key')).json()
  assert.deepEqual(replay.result.companyDetails, profile)
})

test('enriching a selected ambiguous match preserves other matches and does not choose a company for history', async () => {
  const second = { ...sample, company: { ...sample.company, id: 'second-profile', attribution: { ...sample.company.attribution!, recordId: 'second-profile' } } }
  run = async () => ({ matches: [sample, second], total: 2, matchMode: 'relevance' })
  runDetails = async company => profileFor(company)
  const record = await (await post('Test', 'profile-ambiguous-key')).json()
  assert.equal((await details(record.id, second.company.id)).status, 200)
  const restored = await (await get('/api/history/' + record.id)).json()
  assertRestoredMatches([restored.matches[0]], [record.matches[0]])
  assert.equal(restored.matches[1].companyDetails.company.id, second.company.id)
  assert.equal(restored.outcome, 'ambiguous'); assert.equal(restored.company, null); assert.equal(restored.result, null)
})

test('refresh failures preserve the dated profile and remain distinct from unavailable company data', async () => {
  run = async () => ({ matches: [sample], total: 1, matchMode: 'exact' })
  runDetails = async company => profileFor(company)
  const record = await (await post('Test Company', 'profile-failure-key')).json()
  const original = await (await details(record.id)).json()
  runDetails = async () => { throw new ProviderError('rate_limited', 60) }
  const failedResponse = await details(record.id, sample.company.id, true)
  const failed = await failedResponse.json()
  assert.equal(failedResponse.headers.get('retry-after'), '60')
  assert.equal(failed.status, 'rate_limited'); assert.deepEqual(failed.company, original.company)
  assert.equal(failed.retrievedAt, original.retrievedAt)
  const restored = await (await get('/api/history/' + record.id)).json()
  assert.equal(restored.outcome, 'success'); assert.equal(restored.result.companyDetails.status, 'rate_limited')
  runDetails = async () => ({ status: 'unavailable', checkedAt: new Date().toISOString(), retrievedAt: new Date().toISOString(), cached: false })
  const empty = await (await details(record.id, sample.company.id, true)).json()
  assert.equal(empty.status, 'unavailable'); assert.equal(empty.company, undefined)
})

test('snapshot fallback and its description failure survive history, then refresh recovers the detailed profile', async () => {
  run = async () => ({ matches: [sample], total: 1, matchMode: 'exact' })
  runDetails = async company => ({ status: 'available', company: { ...company, country: 'Nigeria' },
    profileSource: 'snapshot', enrichmentStatus: 'quota_exceeded', cached: false,
    checkedAt: new Date().toISOString(), retrievedAt: new Date().toISOString() })
  const record = await (await post('Test Company', 'profile-snapshot-key')).json()
  const snapshot = await (await details(record.id)).json()
  assert.equal(snapshot.profileSource, 'snapshot'); assert.equal(snapshot.enrichmentStatus, 'quota_exceeded')
  const saved = await (await get('/api/history/' + record.id)).json()
  assert.deepEqual(saved.result.companyDetails, snapshot)
  assert.equal(saved.result.companyDetails.company.description, undefined)
  assert.equal(saved.outcome, 'success')
  assert.deepEqual(saved.result.people, record.result.people)
  runDetails = async company => ({ ...profileFor(company), profileSource: 'firmographics' })
  const refreshed = await (await details(record.id, sample.company.id, true)).json()
  assert.equal(refreshed.profileSource, 'firmographics'); assert.equal(refreshed.enrichmentStatus, undefined)
  assert.ok(refreshed.company.description)
  const restored = await (await get('/api/history/' + record.id)).json()
  assert.deepEqual(restored.result.companyDetails, refreshed)
})

test('concurrent profile loads share one execution and deletion during enrichment is respected', async () => {
  run = async () => ({ matches: [sample], total: 1, matchMode: 'exact' })
  const record = await (await post('Test Company', 'profile-delete-key')).json()
  let finish!: () => void, entered!: () => void
  const ready = new Promise<void>(resolve => { entered = resolve })
  runDetails = async company => { entered(); await new Promise<void>(resolve => { finish = resolve }); return profileFor(company) }
  const beforeCalls = detailCalls
  const first = details(record.id)
  await ready
  const second = details(record.id)
  assert.equal((await fetch(`${base}/api/history/${record.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status, 204)
  finish()
  assert.equal((await first).status, 409)
  assert.ok([404, 409].includes((await second).status))
  assert.equal(detailCalls, beforeCalls + 1)
  assert.equal(await SearchHistory.countDocuments({ _id: record.id }), 0)
})

test('legacy result-only history remains readable and can receive a company profile', async () => {
  run = async () => ({ matches: [sample], total: 1, matchMode: 'exact' })
  runDetails = async company => profileFor(company)
  const record = await (await post('Test Company', 'profile-legacy-key')).json()
  await SearchHistory.updateOne({ _id: record.id }, { $set: { matches: [], 'provenance.snapshotVersion': 1 } })
  assert.equal((await details(record.id)).status, 200)
  const restored = await (await get('/api/history/' + record.id)).json()
  assert.equal(restored.result.company.name, sample.company.name)
  assert.equal(restored.result.companyDetails.status, 'available')
  assert.deepEqual(restored.matches, [])
})

// All network data below is synthetic test data in isolated MongoDB, never a
// production import or a claim of real-world relationships.
const networkCandidate = { id: 'fixture-founder-candidate', name: 'Fixture Founder', title: 'Co-founder', role: 'founder' as const, source: 'approved-source' as const }
const networkExecutive = { id: 'fixture-executive-candidate', name: 'Fixture Executive', title: 'CEO', role: 'executive' as const, source: 'approved-source' as const }
const csvEdge = (from: string, to: string, type = 'direct_connection', verification = 'user_confirmed') => [from, from === 'me' ? '' : `Fixture ${from}`, '', to, to === 'me' ? '' : `Fixture ${to}`, '', type, verification, 'Synthetic test relationship with supporting fixture evidence.', new Date().toISOString().slice(0, 10)].join(',')
const csvNetwork = (...rows: string[]) => CSV_COLUMNS.join(',') + '\n' + rows.join('\n')
const networkRequest = (path: string, method = 'GET', body?: unknown, auth = token) => fetch(`${base}/api/${path}`, {
  method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const csvImport = (csv: string, revision = 0, auth = token, confirm = true) => fetch(`${base}/api/network/import`, {
  method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'text/csv', 'X-Network-Revision': String(revision), 'X-Import-Confirmed': String(confirm) }, body: csv,
})
async function resetNetworks() {
  await Promise.all([NetworkState.deleteMany({}), NetworkPerson.deleteMany({}), NetworkRelationship.deleteMany({}), CandidateIdentity.deleteMany({})])
}
async function networkSearch(key: string, auth = token) {
  run = async () => ({ matches: [{ ...sample, people: [networkCandidate, networkExecutive], peopleStatus: 'available' }], total: 1, matchMode: 'exact' })
  return (await post('Test Company', key, auth)).json()
}
const matchIdentity = (searchId: string, candidateId: string, personId: string, revision: number, auth = token) => networkRequest('network/candidate-links', 'POST', {
  searchId, companyId: sample.company.id, candidateId, personId, revision, confirmed: true, statement: 'Synthetic fixture confirms this is the same candidate identity.',
}, auth)

test('private network API requires JWT, validates CSV and confirmation before writes, and does not accept client ownership', async () => {
  await resetNetworks()
  assert.equal((await networkRequest('network', 'GET', undefined, '')).status, 401)
  assert.equal((await csvImport(csvNetwork(csvEdge('me', 'founder')), 0, token, false)).status, 400)
  assert.equal((await csvImport(csvNetwork(csvEdge('me', 'founder'), csvEdge('me', 'founder')))).status, 400)
  assert.equal((await csvImport(CSV_COLUMNS.join(',') + ',owner\n' + csvEdge('me', 'founder') + ',another-account')).status, 400)
  assert.equal(await NetworkRelationship.countDocuments(), 0)
  const preview = await fetch(`${base}/api/network/preview`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/csv' }, body: csvNetwork(csvEdge('me', 'founder')) })
  assert.equal(preview.status, 200); assert.equal((await preview.json()).personCount, 1)
  assert.equal(await NetworkRelationship.countDocuments(), 0, 'Preview never writes the graph')
  assert.equal((await csvImport(csvNetwork(csvEdge('me', 'founder')))).status, 201)
  const people = await (await networkRequest('network/people')).json()
  assert.equal(people.people[0].localId, 'founder'); assert.equal(people.people[0].name, 'Fixture founder')
  assert.equal(people.people[0].owner, undefined)
  assert.equal((await (await networkRequest('network', 'GET', undefined, otherToken)).json()).imported, false)
  assert.equal((await (await networkRequest('network/people', 'GET', undefined, otherToken)).json()).people.length, 0)
})

test('identity confirmation yields direct and one-intermediary paths for multiple candidates without more provider calls', async () => {
  await resetNetworks()
  const saved = await networkSearch('network-paths-key')
  assert.equal(saved.result.introduction.status, 'network_not_imported')
  assert.equal(saved.result.introduction.networkStatus, 'not_imported')
  const imported = await (await csvImport(csvNetwork(csvEdge('me', 'a'), csvEdge('a', 'founder'), csvEdge('me', 'executive')))).json()
  const beforeProvider = calls
  const unresolved = await (await networkRequest('discovery/paths', 'POST', { searchId: saved.id, companyId: sample.company.id })).json()
  assert.equal(unresolved.introduction.status, 'identity_unresolved'); assert.equal(unresolved.paths.length, 0)
  const founder = await (await matchIdentity(saved.id, networkCandidate.id, 'founder', imported.revision)).json()
  assert.equal(founder.paths.length, 1); assert.equal(founder.paths[0].steps, 2); assert.equal(founder.paths[0].intermediateCount, 1)
  assert.equal(founder.paths[0].targetPersonId, networkCandidate.id)
  assert.equal(founder.people.find((person: any) => person.isCurrentUser).name, 'Test User')
  assert.ok(founder.connections.every((edge: any) => edge.source === 'user-import' && edge.evidence.verification === 'user_confirmed' && edge.evidence.statement.includes('Synthetic')))
  assert.equal(founder.introduction.networkStatus, 'imported')
  assert.equal(founder.introduction.maxEvidenceAgeDays, 365)
  assert.ok(Number.isFinite(Date.parse(founder.introduction.checkedAt)))
  for (const edge of founder.connections) {
    const stored = await NetworkRelationship.findById(edge.evidence.recordId).lean()
    assert.equal(edge.evidence.importId, stored!.importId.toString())
    assert.equal(edge.evidence.recordNumber, stored!.row)
    assert.equal(edge.evidence.updatedAt, stored!.updatedAt.toISOString())
  }
  const both = await (await matchIdentity(saved.id, networkExecutive.id, 'executive', imported.revision)).json()
  assert.equal(both.paths.length, 2)
  assert.equal(both.paths.find((path: any) => path.targetPersonId === networkExecutive.id).intermediateCount, 0)
  assert.equal(calls, beforeProvider, 'Linking and path refresh use no Skrapp or other provider requests')
  const history = await (await get('/api/history/' + saved.id)).json()
  assert.deepEqual(history.result.paths, both.paths)
  const stored = await SearchHistory.findById(saved.id).lean()
  assert.equal(stored!.result.paths, null, 'Private graph is not duplicated into durable provider history')
  assert.equal((await networkSearch('network-paths-new-search')).result.paths.length, 2, 'Confirmed identity persists for stable provider/company/candidate IDs')
})

test('another account cannot access a saved search, map a foreign contact or traverse another user’s edges', async () => {
  await resetNetworks()
  const first = await networkSearch('network-owner-first')
  const second = await networkSearch('network-owner-second', otherToken)
  const imported = await (await csvImport(csvNetwork(csvEdge('me', 'founder')))).json()
  assert.equal((await matchIdentity(first.id, networkCandidate.id, 'founder', imported.revision, otherToken)).status, 404)
  assert.equal((await networkRequest('discovery/paths', 'POST', { searchId: first.id, companyId: sample.company.id, user: 'forged' }, otherToken)).status, 404)
  assert.equal((await matchIdentity(second.id, networkCandidate.id, 'founder', 0, otherToken)).status, 409)
  await csvImport(csvNetwork(csvEdge('me', 'own-contact'), csvEdge('founder', 'own-contact')), 0, otherToken)
  assert.equal((await matchIdentity(second.id, networkCandidate.id, 'foreign-contact', 1, otherToken)).status, 404)
  assert.equal((await matchIdentity(second.id, networkCandidate.id, 'founder', 1, otherToken)).status, 200)
  assert.equal((await matchIdentity(first.id, networkCandidate.id, 'founder', imported.revision)).status, 200)
  const other = await (await get('/api/history/' + second.id, otherToken)).json()
  assert.equal(other.result.paths.length, 0); assert.equal(other.result.introduction.status, 'no_path')
  assert.ok(!other.result.people.some((person: any) => person.isCurrentUser), 'Identical local contact IDs cannot traverse another account’s direct edge')
})

test('follow records and missing candidate identities never become introduction paths', async () => {
  await resetNetworks()
  const saved = await networkSearch('network-follows-key')
  await csvImport(csvNetwork(csvEdge('me', 'founder', 'mutual_follow'), csvEdge('me', 'executive', 'follows')))
  const found = await (await matchIdentity(saved.id, networkCandidate.id, 'founder', 1)).json()
  assert.equal(found.paths.length, 0); assert.equal(found.introduction.status, 'no_path')
  assert.equal(found.introduction.excluded.follows, 2)
  assert.equal(found.introduction.candidates.find((person: any) => person.candidateId === networkExecutive.id).status, 'identity_unresolved')
})

test('repeated imports are idempotent; replacement and deletion invalidate identity links and history paths', async () => {
  await resetNetworks()
  const saved = await networkSearch('network-lifecycle-key')
  const csv = csvNetwork(csvEdge('me', 'founder'))
  await csvImport(csv)
  await matchIdentity(saved.id, networkCandidate.id, 'founder', 1)
  const repeated = await (await csvImport(csv, 1)).json()
  assert.equal(repeated.unchanged, true); assert.equal(repeated.revision, 1)
  assert.equal(await NetworkRelationship.countDocuments(), 1)
  assert.equal((await csvImport(csvNetwork(csvEdge('me', 'new-contact')), 0)).status, 409)
  assert.equal((await csvImport(csvNetwork(csvEdge('me', 'new-contact')), 1)).status, 201)
  assert.equal(await CandidateIdentity.countDocuments(), 0)
  assert.equal((await (await get('/api/history/' + saved.id)).json()).result.paths.length, 0)
  assert.equal((await networkRequest('network', 'DELETE', { revision: 2 })).status, 200)
  const history = await (await get('/api/history/' + saved.id)).json()
  assert.equal(history.result.introduction.status, 'network_not_imported')
  assert.equal(history.result.company.name, sample.company.name)
  assert.equal(await NetworkPerson.countDocuments(), 0); assert.equal(await NetworkRelationship.countDocuments(), 0)
})

test('concurrent CSV imports publish one complete graph; a database write failure keeps the previous graph active', async t => {
  await resetNetworks()
  const results = await Promise.all([csvImport(csvNetwork(csvEdge('me', 'a'))), csvImport(csvNetwork(csvEdge('me', 'b')))])
  assert.deepEqual(results.map(response => response.status).sort(), [201, 409])
  assert.equal(await NetworkPerson.countDocuments(), 1); assert.equal(await NetworkRelationship.countDocuments(), 1)
  const current = await (await networkRequest('network')).json()
  const failure = t.mock.method(NetworkRelationship, 'insertMany', async () => { throw new Error('Synthetic database failure') })
  assert.equal((await csvImport(csvNetwork(csvEdge('me', 'c')), current.revision)).status, 500)
  failure.mock.restore()
  const retained = await (await networkRequest('network')).json()
  assert.equal(retained.revision, current.revision); assert.equal(retained.personCount, 1)
  assert.equal(await NetworkPerson.countDocuments(), 1)
})

test('candidate absence, provider failure and graph failure are separate outcomes and keep company results', async t => {
  await resetNetworks()
  run = async () => ({ matches: [{ ...sample, peopleStatus: 'no_candidates' }], total: 1, matchMode: 'exact' })
  const absent = await (await post('Test Company', 'network-no-candidate')).json()
  assert.equal(absent.result.introduction.status, 'candidate_not_identified')
  assert.equal(absent.result.introduction.networkStatus, 'not_imported')
  run = async () => ({ matches: [{ ...sample, peopleStatus: 'provider_error' }], total: 1, matchMode: 'exact' })
  const failedProvider = await (await post('Test Company', 'network-candidate-error')).json()
  assert.equal(failedProvider.result.introduction.status, 'candidate_provider_error')
  const saved = await networkSearch('network-read-error')
  const failure = t.mock.method(NetworkState, 'findOne', () => { throw new Error('Synthetic graph read failure') })
  const graphError = await (await networkRequest('discovery/paths', 'POST', { searchId: saved.id, companyId: sample.company.id })).json()
  failure.mock.restore()
  assert.equal(graphError.introduction.status, 'network_error')
  assert.equal(graphError.introduction.networkStatus, 'unavailable')
  assert.equal(graphError.company.id, sample.company.id)
  assert.ok(graphError.people.some((person: any) => person.id === networkCandidate.id))
  assert.deepEqual(graphError.paths, [])
})

test('multi-candidate discovery separates path caps from unreachable identities and retains independent network status', async () => {
  await resetNetworks()
  const user = await User.findOne({ email: 'test@example.com' }).lean()
  const actor = { id: user!._id.toString(), name: user!.name, email: user!.email }
  const rows = Array.from({ length: 4 }, (_, i) => [csvEdge('me', `a${i}`), csvEdge(`a${i}`, 'founder')]).flat()
  await importNetwork(actor.id, csvNetwork(...rows, csvEdge('executive', 'founder')), 0)
  const state = await NetworkState.findOne({ owner: actor.id }).lean()
  await CandidateIdentity.insertMany([networkCandidate, networkExecutive].map((candidate, index) => ({
    owner: actor.id, importId: state!.activeImport, provider: provider.name, companyId: sample.company.id,
    candidateId: candidate.id, personId: index ? 'executive' : 'founder', verification: 'user_confirmed',
    statement: 'Synthetic test identity, not an actual discovery.',
  })))
  const [result, absent] = await discoverIntroductionPaths(actor, [
    { ...sample, people: [networkCandidate, networkExecutive], peopleStatus: 'available' },
    { ...sample, company: { ...sample.company, id: 'fixture-no-candidates' } },
  ], provider.name)
  assert.equal(result.paths!.length, 3)
  assert.equal(result.introduction!.candidates[0].pathsLimited, true)
  assert.equal(result.introduction!.candidates[1].status, 'no_path')
  assert.deepEqual(result.introduction!.limits, ['path_count'])
  assert.equal(absent.introduction!.status, 'candidate_not_identified')
  assert.equal(absent.introduction!.networkStatus, 'imported')
})
