import test from 'node:test'
import assert from 'node:assert/strict'
import { CSV_COLUMNS, parseNetworkCsv } from '../src/network/csv'
import { shortestPaths, type GraphEdge } from '../src/network/shortestPaths'

// Synthetic algorithm fixtures only. Never loaded by production discovery.
const now = Date.parse('2026-11-10T12:00:00Z')
const edge = (from: string, to: string, overrides: Partial<GraphEdge> = {}): GraphEdge => ({ id: `${from}:${to}`, from, to, type: 'direct_connection',
  evidence: { source: 'csv', verification: 'user_confirmed', statement: 'Synthetic test relationship evidence.', observedAt: '2026-11-01T00:00:00.000Z', importedAt: '2026-11-10T00:00:00.000Z', updatedAt: '2026-11-10T00:00:00.000Z' }, ...overrides })
const paths = (targets: string[], edges: GraphEdge[]) => shortestPaths('me', targets, edges, now)

test('shortest paths: direct, one intermediary and three intermediaries', () => {
  for (const nodes of [['me', 'founder'], ['me', 'connector', 'founder'], ['me', 'a', 'b', 'c', 'founder']]) {
    const result = paths(['founder'], nodes.slice(0, -1).map((from, i) => edge(from, nodes[i + 1])))
    assert.deepEqual(result.paths.map(path => path.nodes), [nodes])
    assert.equal(result.paths[0].edges.length, nodes.length - 1)
  }
})

test('shortest paths: all shortest alternatives, longer routes excluded, multiple targets handled independently', () => {
  const graph = [edge('me', 'a'), edge('me', 'b'), edge('a', 'founder'), edge('b', 'founder'), edge('me', 'c'), edge('c', 'd'), edge('d', 'founder'), edge('c', 'executive')]
  const found = paths(['founder', 'executive'], graph)
  assert.deepEqual(found.paths.map(path => path.nodes), [['me', 'a', 'founder'], ['me', 'b', 'founder'], ['me', 'c', 'executive']])
  assert.deepEqual(paths(['founder'], [...graph, edge('me', 'founder')]).paths.map(path => path.nodes), [['me', 'founder']])
})

test('shortest paths: cycles, duplicate edges and directed relationships do not create false chains', () => {
  const graph = [edge('me', 'a'), edge('a', 'me'), edge('a', 'b'), edge('b', 'a'), edge('b', 'founder'), edge('a', 'a'), edge('me', 'a', { id: 'another-record', type: 'user_confirmed' })]
  assert.deepEqual(paths(['founder'], graph).paths.map(path => path.nodes), [['me', 'a', 'b', 'founder']])
  assert.equal(paths(['founder'], [edge('founder', 'me')]).paths.length, 0)
  assert.equal(paths(['me'], graph).paths.length, 0)
  assert.equal(paths(['founder'], []).paths.length, 0)
})

test('shortest paths: follows, mutual follows, unverified, stale and unsupported evidence are excluded', () => {
  const normal = edge('me', 'founder')
  for (const type of ['follows', 'mutual_follow'] as const) assert.equal(paths(['founder'], [{ ...normal, type }]).paths.length, 0)
  for (const evidence of [{ ...normal.evidence, verification: 'unverified' as const }, { ...normal.evidence, observedAt: '2020-01-01T00:00:00Z' },
    { ...normal.evidence, observedAt: '2027-01-01T00:00:00Z' }, { ...normal.evidence, statement: '' }]) assert.equal(paths(['founder'], [{ ...normal, evidence }]).paths.length, 0)
  assert.equal(paths(['founder'], [{ ...normal, type: 'user_confirmed' }]).paths.length, 1)
})

test('shortest paths: depth and result bounds limit cyclic/dense graph work', () => {
  const nodes = ['me', 'a', 'b', 'c', 'd', 'founder']
  const deep = paths(['founder'], nodes.slice(0, -1).map((from, i) => edge(from, nodes[i + 1])))
  assert.equal(deep.paths.length, 0); assert.equal(deep.limited, true)
  const dense = paths(['founder'], Array.from({ length: 100 }, (_, i) => [edge('me', `a${i}`), edge(`a${i}`, 'founder')]).flat())
  assert.equal(dense.paths.length, 3); assert.equal(dense.limited, true); assert.equal(dense.visited, 102)
  assert.equal(new Set(dense.paths.map(path => path.nodes.join('|'))).size, 3)
})

test('shortest paths: an alternative cap does not imply an incomplete search for other targets', () => {
  const graph = Array.from({ length: 4 }, (_, i) => [edge('me', `a${i}`), edge(`a${i}`, 'founder')]).flat()
  const result = paths(['founder', 'unreachable'], graph)
  assert.equal(result.paths.length, 3)
  assert.deepEqual(result.limits, ['path_count'])
  assert.deepEqual(result.limitedTargets, ['founder'])
  assert.equal(result.searchLimited, false)
  const exactlyThree = paths(['founder'], graph.slice(0, 6))
  assert.equal(exactlyThree.paths.length, 3)
  assert.equal(exactlyThree.limited, false)
})

test('shortest paths: cycles at the depth boundary and unrelated longer routes do not falsely limit results', () => {
  const graph = [edge('me', 'a'), edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('d', 'a')]
  assert.equal(paths(['unreachable'], graph).limited, false)
  assert.equal(paths(['founder'], [...graph, edge('d', 'e'), edge('me', 'founder')]).limited, false)
  const beyondDepth = paths(['e'], [...graph, edge('d', 'e')])
  assert.equal(beyondDepth.searchLimited, true)
  assert.deepEqual(beyondDepth.limits, ['depth'])
})

test('shortest paths: oversized input never presents a truncated graph route as shortest', () => {
  const graph = [edge('me', 'a'), edge('a', 'founder'), ...Array.from({ length: 999 }, (_, i) => edge(`x${i}`, `x${i + 1}`)), edge('me', 'founder')]
  const result = paths(['founder'], graph)
  assert.deepEqual(result.paths, [])
  assert.deepEqual(result.limits, ['edge_count'])
  assert.equal(result.visited, 0)
})

test('shortest paths: duplicate targets do not consume the candidate allowance', () => {
  const result = paths(Array(8).fill('founder'), [edge('me', 'founder')])
  assert.equal(result.paths.length, 1)
  assert.equal(result.limited, false)
})

const header = CSV_COLUMNS.join(',')
const row = 'me,,,a,"Fixture, Contact",https://example.com/person/a,direct_connection,user_confirmed,We know each other through a test project.,2026-11-01'
test('CSV accepts BOM, CRLF, quoted commas and escaped quotes, and keeps dates and stable IDs', () => {
  const parsed = parseNetworkCsv('\ufeff' + header + '\r\n' + row + '\r\n', now)
  assert.equal(parsed.people[0].name, 'Fixture, Contact'); assert.equal(parsed.people[0].localId, 'a')
  assert.equal(parsed.relationships[0].from, 'me'); assert.equal(parsed.relationships[0].observedAt, '2026-11-01T00:00:00.000Z')
  assert.equal(parseNetworkCsv(header + '\n' + row.replace('Fixture, Contact', 'Fixture ""Contact""'), now).people[0].name, 'Fixture "Contact"')
})

test('CSV rejects forged account identity, duplicate edges, conflicting contacts, unsafe URLs and invalid dates', () => {
  const invalid = [
    row.replace('me,,,', 'me,Someone Else,,'), row + '\n' + row,
    row + '\n' + row.replace('Fixture, Contact', 'Different Person').replace('direct_connection', 'follows'),
    row.replace('https://example.com/person/a', 'javascript:alert(1)'), row.replace('2026-11-01', '2026-02-31'), row.replace('2026-11-01', '2027-01-01'),
    row.replace('user_confirmed', 'provider_verified'), row.replace('direct_connection', 'friend'), row.replace('me,,,', 'a,,,')
  ]
  for (const value of invalid) assert.throws(() => parseNetworkCsv(header + '\n' + value, now))
  assert.throws(() => parseNetworkCsv(header + ',owner\n' + row + ',another-user', now))
  assert.throws(() => parseNetworkCsv(header + '\n"unclosed', now))
  assert.throws(() => parseNetworkCsv(header + '\n' + row.replace('project', '\u0000'), now))
})

test('CSV row and byte limits prevent unbounded imports; follow records remain distinct and unverified', () => {
  assert.throws(() => parseNetworkCsv('x'.repeat(1_000_001), now), { status: 413 })
  assert.throws(() => parseNetworkCsv(header + '\n' + Array.from({ length: 1001 }, () => row).join('\n'), now))
  const follow = parseNetworkCsv(header + '\n' + row.replace('direct_connection', 'follows').replace('user_confirmed', 'unverified'), now)
  assert.equal(follow.relationships[0].type, 'follows'); assert.equal(follow.relationships[0].verification, 'unverified')
})
