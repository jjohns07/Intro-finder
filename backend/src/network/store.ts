import { createHash } from 'node:crypto'
import { Types } from 'mongoose'
import { NetworkState, NetworkPerson, NetworkRelationship, CandidateIdentity } from '../models/Network'
import { parseNetworkCsv } from './csv'
import { NetworkInputError } from './types'

export function expectedRevision(value: unknown) {
  if (typeof value === 'string' && /^(0|[1-9]\d{0,8})$/.test(value)) return Number(value)
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value < 1e9) return value
  throw new NetworkInputError('A valid network revision is required. Reload your network and try again.')
}

export async function networkStatus(owner: string) {
  const state = await NetworkState.findOne({ owner }).lean().maxTimeMS(1500)
  return { imported: Boolean(state?.activeImport), revision: state?.revision ?? 0,
    personCount: state?.personCount ?? 0, relationshipCount: state?.relationshipCount ?? 0,
    updatedAt: state?.updatedAt?.toISOString(), source: state?.activeImport ? 'csv' : null,
    socialIntegration: 'unavailable' as const }
}

export async function activeNetwork(owner: string, revision: number) {
  const state = await NetworkState.findOne({ owner, revision }).lean().maxTimeMS(1500)
  if (!state?.activeImport) throw new NetworkInputError('Your network changed or is not imported. Reload it and try again.', 409)
  return state
}

async function cleanImport(owner: string, importId: Types.ObjectId) {
  await Promise.all([NetworkPerson.deleteMany({ owner, importId }), NetworkRelationship.deleteMany({ owner, importId }), CandidateIdentity.deleteMany({ owner, importId })])
}

export async function importNetwork(owner: string, csv: string, revision: number) {
  const parsed = parseNetworkCsv(csv)
  const digest = createHash('sha256').update(csv).digest('hex')
  // A single active pointer publishes a complete import, also on standalone
  // MongoDB. Invalid/partial batches never become traversable.
  await NetworkState.updateOne({ owner }, { $setOnInsert: { owner, revision: 0 } }, { upsert: true }).catch(error => {
    if (error?.code !== 11000) throw error
  })
  const previous = await NetworkState.findOne({ owner }).lean()
  if (!previous || previous.revision !== revision) throw new NetworkInputError('Your network changed. Review the current network before importing.', 409)
  if (previous.activeImport && previous.digest === digest) return { ...(await networkStatus(owner)), unchanged: true }
  const importId = new Types.ObjectId(), now = new Date()
  let published = false
  try {
    if (parsed.people.length) await NetworkPerson.insertMany(parsed.people.map(person => ({ ...person, owner, importId })))
    await NetworkRelationship.insertMany(parsed.relationships.map(edge => ({ ...edge, owner, importId, source: 'csv', importedAt: now })))
    const updated = await NetworkState.updateOne({ owner, revision }, { $set: {
      activeImport: importId, digest, personCount: parsed.people.length, relationshipCount: parsed.relationships.length,
    }, $inc: { revision: 1 } })
    if (!updated.modifiedCount) throw new NetworkInputError('Another network change completed first. Reload before importing.', 409)
    published = true
    // Old imports are already inaccessible after the atomic pointer switch.
    if (previous.activeImport) await cleanImport(owner, previous.activeImport).catch(() => {})
    return { ...(await networkStatus(owner)), unchanged: false }
  } finally {
    if (!published) await cleanImport(owner, importId).catch(() => {})
  }
}

export async function deleteNetwork(owner: string, revision: number) {
  const state = await activeNetwork(owner, revision)
  const updated = await NetworkState.updateOne({ owner, revision, activeImport: state.activeImport }, {
    $set: { activeImport: null, personCount: 0, relationshipCount: 0 }, $unset: { digest: 1 }, $inc: { revision: 1 },
  })
  if (!updated.modifiedCount) throw new NetworkInputError('Your network changed. Reload before deleting.', 409)
  await cleanImport(owner, state.activeImport!)
  return networkStatus(owner)
}
