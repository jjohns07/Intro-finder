import test from 'node:test'
import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import { createDiscoveryProvider } from '../src/discovery/provider'

dotenv.config({ quiet: true })
const provider = createDiscoveryProvider()
test('LIVE PDL company search (consumes provider credits)', { skip: process.env.RUN_LIVE_DISCOVERY !== 'true' || !provider.available }, async () => {
  const result = await provider.search('people data labs', { signal: AbortSignal.timeout(15_000) })
  assert.ok(result.matches.length > 0)
  assert.ok(result.matches.every(match => match.source === 'approved-source' && match.company.attribution?.provider === 'People Data Labs'))
  assert.ok(result.matches.every(match => match.paths === null))
})
