import { createHash } from 'node:crypto'
import type { AuthenticatedRequest } from '../middleware/auth'
import { CandidateIdentity, NetworkPerson, NetworkRelationship, NetworkState } from '../models/Network'
import type { Connection, DiscoveryResult, IntroductionPath, Person } from '../discovery/types'
import { NETWORK_LIMITS, type IntroductionReport, type IntroductionStatus } from './types'
import { shortestPaths, type GraphEdge } from './shortestPaths'

type Actor = NonNullable<AuthenticatedRequest['user']>
const candidatesFor = (result: DiscoveryResult) => (result.people ?? []).filter(person => person.source === 'approved-source' && !person.isFixture && ['founder', 'executive'].includes(person.role ?? '')).slice(0, NETWORK_LIMITS.targets)
function report(status: IntroductionStatus, checkedAt: Date): IntroductionReport {
  return { status, socialIntegration: 'unavailable', networkStatus: 'unavailable', checkedAt: checkedAt.toISOString(),
    maxEvidenceAgeDays: NETWORK_LIMITS.evidenceDays, maxDepth: NETWORK_LIMITS.depth,
    maxPathsPerCandidate: NETWORK_LIMITS.pathsPerTarget, limited: false, limits: [], candidates: [] }
}
function withoutPaths(result: DiscoveryResult, status: IntroductionStatus, checkedAt: Date): DiscoveryResult {
  return { ...result, people: (result.people ?? []).filter(person => person.source !== 'user-import'), paths: [], connections: [], connectionStatus: status, introduction: report(status, checkedAt) }
}

export async function discoverIntroductionPaths(actor: Actor, matches: readonly DiscoveryResult[], provider: string): Promise<DiscoveryResult[]> {
  const checkedAt = new Date()
  const initial = matches.map(result => withoutPaths(result, candidatesFor(result).length ? 'network_not_imported'
    : result.peopleStatus && !['available', 'no_candidates', 'not_configured'].includes(result.peopleStatus) ? 'candidate_provider_error' : 'candidate_not_identified', checkedAt))
  if (!matches.length) return initial
  try {
    const state = await NetworkState.findOne({ owner: actor.id }).lean().maxTimeMS(1500)
    for (const result of initial) {
      result.introduction!.networkStatus = state?.activeImport ? 'imported' : 'not_imported'
      if (state?.activeImport) {
        result.introduction!.networkRevision = state.revision
        result.introduction!.networkUpdatedAt = state.updatedAt.toISOString()
      }
    }
    if (!state?.activeImport) return initial
    if (!matches.some(result => candidatesFor(result).length)) return initial
    const scope = { owner: actor.id, importId: state.activeImport }
    const [people, relationships, identities] = await Promise.all([
      NetworkPerson.find(scope).limit(NETWORK_LIMITS.people + 1).lean().maxTimeMS(1500),
      NetworkRelationship.find(scope).limit(NETWORK_LIMITS.rows + 1).lean().maxTimeMS(1500),
      CandidateIdentity.find({ ...scope, provider, companyId: { $in: matches.map(result => result.company.id) },
        candidateId: { $in: matches.flatMap(result => candidatesFor(result).map(candidate => candidate.id)) } }).limit(26).lean().maxTimeMS(1500),
    ])
    if (people.length > NETWORK_LIMITS.people || relationships.length > NETWORK_LIMITS.rows || identities.length > 25) throw new Error('Network exceeds limits')
    const personById = new Map(people.map(person => [person.localId, person]))
    const edges: GraphEdge[] = relationships.filter(edge => (edge.from === 'me' || personById.has(edge.from)) && (edge.to === 'me' || personById.has(edge.to))).map(edge => ({
      id: edge._id.toString(), from: edge.from, to: edge.to, type: edge.type,
      evidence: { source: edge.source, verification: edge.verification, statement: edge.evidence,
        recordId: edge._id.toString(), importId: edge.importId.toString(), recordNumber: edge.row,
        observedAt: edge.observedAt.toISOString(), importedAt: edge.importedAt.toISOString(), updatedAt: edge.updatedAt.toISOString() },
    }))
    const rootId = `account:${actor.id}`
    const nodeId = (id: string) => id === 'me' ? rootId : `network:${state.activeImport}:${id}`
    const results = matches.map((original, index) => {
      const candidates = candidatesFor(original)
      if (!candidates.length) return initial[index]
      const links = candidates.map(candidate => ({ candidate, identity: identities.find(link => link.companyId === original.company.id && link.candidateId === candidate.id && link.verification === 'user_confirmed' && personById.has(link.personId)) }))
      const graph = shortestPaths('me', links.flatMap(link => link.identity ? [link.identity.personId] : []), edges, checkedAt.getTime())
      const extraPeople = new Map<string, Person>()
      const connections = new Map<string, Connection>()
      const paths: IntroductionPath[] = []
      const info = report('identity_unresolved', checkedAt)
      info.networkStatus = 'imported'
      info.networkRevision = state.revision; info.networkUpdatedAt = state.updatedAt.toISOString()
      info.limited = graph.limited; info.limits = graph.limits; info.excluded = graph.excluded
      for (const { candidate, identity } of links) {
        const contact = identity ? personById.get(identity.personId) : undefined
        const found = identity ? graph.paths.filter(path => path.target === identity.personId) : []
        info.candidates.push({ candidateId: candidate.id,
          status: !identity ? 'identity_unresolved' : found.length ? 'available' : graph.searchLimited ? 'search_limited' : 'no_path',
          pathsLimited: Boolean(identity && graph.limitedTargets.includes(identity.personId)),
          ...(identity && contact ? { identity: { personId: contact.localId, name: contact.name, profileUrl: contact.profileUrl ?? undefined,
            verification: 'user_confirmed', statement: identity.statement, confirmedAt: identity.updatedAt.toISOString() } } : {}) })
        for (const foundPath of found) {
          const ids = foundPath.nodes.map((id, i) => i === foundPath.nodes.length - 1 ? candidate.id : nodeId(id))
          const connectionIds = foundPath.edges.map((edge, i) => {
            // Same real edge may end at distinct provider candidate aliases.
            const id = `${edge.id}:${candidate.id}`
            connections.set(id, { id, fromPersonId: ids[i], toPersonId: ids[i + 1], relationship: edge.type, source: 'user-import', evidence: edge.evidence })
            return id
          })
          for (const id of foundPath.nodes.slice(0, -1)) {
            if (id === 'me') extraPeople.set(rootId, { id: rootId, name: actor.name, isCurrentUser: true, source: 'user-import' })
            else {
              const contact = personById.get(id)!
              extraPeople.set(nodeId(id), { id: nodeId(id), name: contact.name, title: contact.title ?? undefined, profileUrl: contact.profileUrl ?? undefined,
                source: 'user-import', importedAt: contact.createdAt.toISOString(), updatedAt: contact.updatedAt.toISOString() })
            }
          }
          paths.push({ id: 'path-' + createHash('sha256').update(JSON.stringify([actor.id, state.activeImport, candidate.id, ids])).digest('hex').slice(0, 24),
            startPersonId: rootId, targetPersonId: candidate.id, path: ids, connectionIds, steps: ids.length - 1, intermediateCount: ids.length - 2,
            updatedAt: foundPath.edges.map(edge => edge.evidence.updatedAt).sort().at(-1),
            oldestEvidenceAt: foundPath.edges.map(edge => edge.evidence.observedAt).sort()[0], source: 'user-import',
            explanation: 'Shortest path through relationships you confirmed in your imported network. Identity matches are user-confirmed; an introduction is not guaranteed.' })
        }
      }
      info.status = paths.length ? 'available' : links.every(link => !link.identity) ? 'identity_unresolved' : graph.searchLimited ? 'search_limited' : 'no_path'
      return { ...initial[index], people: [...(initial[index].people ?? []), ...extraPeople.values()], paths, connections: [...connections.values()], connectionStatus: info.status, introduction: info }
    })
    // A concurrent import/delete must not expose a superseded private graph.
    if (!await NetworkState.exists({ owner: actor.id, activeImport: state.activeImport, revision: state.revision }).maxTimeMS(1500)) throw new Error('Network changed')
    return results
  } catch {
    return initial.map(result => withoutPaths(result, candidatesFor(result).length ? 'network_error' : result.introduction!.status, checkedAt))
  }
}
