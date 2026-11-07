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
import type { DiscoveryResult } from '../src/discovery/types'

let mongo: MongoMemoryServer, server: Server, base: string, token: string, otherToken: string
let calls = 0
const sample: DiscoveryResult = { company: { id: 'test-company', name: 'Test Company', source: 'approved-source', attribution: { provider: 'Test provider', recordId: 'test-company', retrievedAt: '2026-11-07T00:00:00.000Z', reliability: 'aggregated-provider-data' } }, people: [], paths: null, source: 'approved-source', generatedAt: '2026-11-07T00:00:00.000Z', warnings: [], peopleStatus: 'no_candidates', connectionStatus: 'unavailable' }
let run: DiscoveryProvider['search'] = async () => ({ matches: [sample], total: 1, matchMode: 'exact' })
const provider: DiscoveryProvider = { name: 'test-provider', available: true, snapshotAllowed: true, search: (...args) => { calls++; return run(...args) } }
const post = (companyName: unknown, key: string, auth = token) => fetch(`${base}/api/discovery/search`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify({ companyName }) })
const get = (path: string, auth = token) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${auth}` } })

before(async () => {
  process.env.JWT_SECRET = 'discovery-test-secret-at-least-32-characters'
  process.env.JWT_EXPIRES_IN = '1h'
  mongo = await MongoMemoryServer.create({ binary: { downloadDir: '/tmp/intro-finder-mongodb', version: process.env.MONGOMS_VERSION ?? '7.0.24' }, instance: { storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongo.getUri())
  await SearchHistory.init()
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
  assert.deepEqual(detail.matches, record.matches)
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
  assert.deepEqual((await (await get(`/api/history/${record.id}`)).json()).matches, record.matches)
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
