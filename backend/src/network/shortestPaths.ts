import { NETWORK_LIMITS, type NetworkRelationshipType, type RelationshipEvidence } from './types'

export interface GraphEdge { id: string; from: string; to: string; type: NetworkRelationshipType; evidence: RelationshipEvidence }
export interface GraphPath { target: string; nodes: string[]; edges: GraphEdge[] }

// Unweighted directed BFS builds a shortest-distance predecessor DAG. Bounded
// backtracking returns alternatives at that shortest distance for each target.
export function shortestPaths(start: string, targets: readonly string[], edges: readonly GraphEdge[], now = Date.now()) {
  const excluded = { follows: 0, unverified: 0, stale: 0 }
  let limited = edges.length > NETWORK_LIMITS.rows || targets.length > NETWORK_LIMITS.targets
  const pairs = new Map<string, GraphEdge>()
  for (const edge of edges.slice(0, NETWORK_LIMITS.rows)) {
    if (!['direct_connection', 'user_confirmed'].includes(edge.type)) { excluded.follows++; continue }
    if (edge.evidence.verification !== 'user_confirmed' || edge.evidence.source !== 'csv' || edge.evidence.statement.trim().length < 10) { excluded.unverified++; continue }
    const observed = Date.parse(edge.evidence.observedAt)
    if (!Number.isFinite(observed) || observed > now || now - observed > NETWORK_LIMITS.evidenceDays * 86_400_000) { excluded.stale++; continue }
    if (edge.from === edge.to) continue
    const key = JSON.stringify([edge.from, edge.to])
    const previous = pairs.get(key)
    // One evidenced edge per directed pair avoids duplicate person chains.
    if (!previous || observed > Date.parse(previous.evidence.observedAt)
      || (observed === Date.parse(previous.evidence.observedAt) && edge.id < previous.id)) pairs.set(key, edge)
  }
  const outgoing = new Map<string, GraphEdge[]>()
  for (const edge of pairs.values()) {
    const list = outgoing.get(edge.from) ?? []
    list.push(edge); outgoing.set(edge.from, list)
  }
  for (const list of outgoing.values()) list.sort((a, b) => a.to.localeCompare(b.to) || a.id.localeCompare(b.id))
  const distance = new Map([[start, 0]])
  const parents = new Map<string, GraphEdge[]>()
  const queue = [start]
  let visits = 0
  for (let index = 0; index < queue.length; index++) {
    const from = queue[index], depth = distance.get(from)!
    if (depth >= NETWORK_LIMITS.depth) { if (outgoing.has(from)) limited = true; continue }
    for (const edge of outgoing.get(from) ?? []) {
      if (++visits > NETWORK_LIMITS.visits) { limited = true; break }
      const found = distance.get(edge.to)
      if (found === undefined) { distance.set(edge.to, depth + 1); queue.push(edge.to); parents.set(edge.to, [edge]) }
      else if (found === depth + 1) parents.get(edge.to)!.push(edge)
    }
    if (visits > NETWORK_LIMITS.visits) break
  }
  const paths: GraphPath[] = []
  for (const target of [...new Set(targets)].slice(0, NETWORK_LIMITS.targets)) {
    if (target === start || !distance.has(target)) continue
    let count = 0
    const collect = (node: string, reverse: GraphEdge[]) => {
      if (node === start) {
        if (count >= NETWORK_LIMITS.pathsPerTarget) { limited = true; return }
        const pathEdges = [...reverse].reverse()
        paths.push({ target, nodes: [start, ...pathEdges.map(edge => edge.to)], edges: pathEdges }); count++; return
      }
      for (const edge of parents.get(node) ?? []) {
        if (count >= NETWORK_LIMITS.pathsPerTarget) { limited = true; break }
        collect(edge.from, [...reverse, edge])
      }
    }
    collect(target, [])
  }
  return { paths, excluded, limited, visited: distance.size }
}
