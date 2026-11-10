import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import SearchHistory from '../models/SearchHistory'
import { CandidateIdentity, NetworkPerson } from '../models/Network'
import { activeNetwork, deleteNetwork, expectedRevision, importNetwork, networkStatus } from '../network/store'
import { evidenceText, parseNetworkCsv } from '../network/csv'
import { NetworkInputError } from '../network/types'
import { discoverIntroductionPaths } from '../network/discoverPaths'
import type { DiscoveryResult } from '../discovery/types'

export async function matchedCompany(req: AuthenticatedRequest) {
  const { searchId, companyId } = req.body ?? {}
  if (typeof searchId !== 'string' || !/^[a-f\d]{24}$/i.test(searchId) || typeof companyId !== 'string' || !companyId || companyId.length > 200) throw new NetworkInputError('A saved search ID and company ID are required.')
  const record = await SearchHistory.findOne({ _id: searchId, user: req.user!.id, status: 'completed' }).maxTimeMS(1500)
  const match: DiscoveryResult | undefined = (record?.matches as DiscoveryResult[] | undefined)?.find(item => item.company.id === companyId)
    ?? (record?.result?.company.id === companyId ? record.result : undefined)
  if (!record || !match) throw new NetworkInputError('Company not found in your saved search.', 404)
  return { record, match }
}

export const status = async (req: AuthenticatedRequest, res: Response) => { res.json(await networkStatus(req.user!.id)) }
export const preview = async (req: AuthenticatedRequest, res: Response) => {
  const parsed = parseNetworkCsv(req.body)
  res.json({ personCount: parsed.people.length, relationshipCount: parsed.relationships.length,
    confirmedCount: parsed.relationships.filter(edge => edge.verification === 'user_confirmed' && ['direct_connection', 'user_confirmed'].includes(edge.type)).length,
    people: parsed.people.slice(0, 5) })
}
export const importCsv = async (req: AuthenticatedRequest, res: Response) => {
  if (req.get('X-Import-Confirmed') !== 'true') throw new NetworkInputError('Confirm that you are authorised to import this data and that user-confirmed records are supported by your evidence.')
  const result = await importNetwork(req.user!.id, req.body, expectedRevision(req.get('X-Network-Revision')))
  res.status(result.unchanged ? 200 : 201).json(result)
}
export const removeNetwork = async (req: AuthenticatedRequest, res: Response) => { res.json(await deleteNetwork(req.user!.id, expectedRevision(req.body?.revision))) }

export async function listPeople(req: AuthenticatedRequest, res: Response) {
  const q = req.query.q ?? '', page = req.query.page ?? '1'
  if (typeof q !== 'string' || q.length > 100 || typeof page !== 'string' || !/^[1-9]\d{0,2}$/.test(page)) throw new NetworkInputError('Invalid contact search.')
  const summary = await networkStatus(req.user!.id)
  if (!summary.imported) { res.json({ ...summary, people: [], total: 0 }); return }
  const state = await activeNetwork(req.user!.id, summary.revision)
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const filter = { owner: req.user!.id, importId: state.activeImport, ...(escaped ? { name: { $regex: escaped, $options: 'i' } } : {}) }
  const [people, total] = await Promise.all([
    NetworkPerson.find(filter).sort({ localId: 1 }).skip((Number(page) - 1) * 50).limit(50).select('localId name title profileUrl createdAt updatedAt').lean().maxTimeMS(1500),
    NetworkPerson.countDocuments(filter).maxTimeMS(1500),
  ])
  res.json({ ...summary, people: people.map(({ _id, ...person }) => person), total })
}

export async function linkCandidate(req: AuthenticatedRequest, res: Response) {
  const { record, match } = await matchedCompany(req)
  const { candidateId, personId, confirmed, statement } = req.body ?? {}
  const candidate = match.people?.find(person => person.id === candidateId && ['founder', 'executive'].includes(person.role ?? '') && person.source === 'approved-source' && !person.isFixture)
  if (!candidate) throw new NetworkInputError('Founder or executive candidate not found in this company result.', 404)
  const state = await activeNetwork(req.user!.id, expectedRevision(req.body?.revision))
  const scope = { owner: req.user!.id, importId: state.activeImport, provider: record.provenance!.provider, companyId: match.company.id, candidateId: candidate.id }
  if (req.method === 'DELETE') await CandidateIdentity.deleteOne(scope)
  else {
    if (confirmed !== true || typeof personId !== 'string' || personId === 'me' || personId.length > 80) throw new NetworkInputError('Explicitly confirm the candidate’s identity using an imported contact.')
    const evidence = evidenceText(statement)
    if (!await NetworkPerson.exists({ owner: req.user!.id, importId: state.activeImport, localId: personId }).maxTimeMS(1500)) throw new NetworkInputError('Contact not found in your current network.', 404)
    await CandidateIdentity.updateOne(scope, { $set: { personId, statement: evidence, verification: 'user_confirmed' } }, { upsert: true, runValidators: true })
  }
  await activeNetwork(req.user!.id, state.revision)
  const [result] = await discoverIntroductionPaths(req.user!, [match], record.provenance!.provider)
  res.json(result)
}

export async function refreshPaths(req: AuthenticatedRequest, res: Response) {
  const { record, match } = await matchedCompany(req)
  const [result] = await discoverIntroductionPaths(req.user!, [match], record.provenance!.provider)
  res.json(result)
}
