import mongoose, { Schema } from 'mongoose'
import { RELATIONSHIP_TYPES } from '../network/types'

const owner = { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true } as const
const imported = { type: Schema.Types.ObjectId, required: true, immutable: true } as const
const options = { timestamps: true, bufferCommands: false } as const

const state = new Schema({
  owner, revision: { type: Number, required: true, default: 0 },
  activeImport: { type: Schema.Types.ObjectId, default: null }, digest: String,
  personCount: { type: Number, default: 0 }, relationshipCount: { type: Number, default: 0 },
}, options)
state.index({ owner: 1 }, { unique: true })

const person = new Schema({
  owner, importId: imported, localId: { type: String, required: true, maxlength: 80, immutable: true },
  name: { type: String, required: true, maxlength: 200 }, profileUrl: { type: String, maxlength: 2048 }, title: { type: String, maxlength: 300 },
}, options)
person.index({ owner: 1, importId: 1, localId: 1 }, { unique: true })

const relationship = new Schema({
  owner, importId: imported,
  from: { type: String, required: true, maxlength: 80 }, to: { type: String, required: true, maxlength: 80 },
  type: { type: String, enum: RELATIONSHIP_TYPES, required: true },
  source: { type: String, enum: ['csv'], required: true, default: 'csv' },
  verification: { type: String, enum: ['unverified', 'user_confirmed'], required: true },
  evidence: { type: String, required: true, maxlength: 500 }, observedAt: { type: Date, required: true },
  importedAt: { type: Date, required: true }, row: { type: Number, required: true },
}, options)
relationship.index({ owner: 1, importId: 1, from: 1, to: 1, type: 1 }, { unique: true })

const identity = new Schema({
  owner, importId: imported, provider: { type: String, required: true, maxlength: 100 },
  companyId: { type: String, required: true, maxlength: 200 }, candidateId: { type: String, required: true, maxlength: 200 },
  personId: { type: String, required: true, maxlength: 80 }, statement: { type: String, required: true, maxlength: 500 },
  verification: { type: String, enum: ['user_confirmed'], required: true },
}, options)
identity.index({ owner: 1, importId: 1, provider: 1, companyId: 1, candidateId: 1 }, { unique: true })

export const NetworkState = mongoose.model('NetworkState', state)
export const NetworkPerson = mongoose.model('NetworkPerson', person)
export const NetworkRelationship = mongoose.model('NetworkRelationship', relationship)
export const CandidateIdentity = mongoose.model('CandidateIdentity', identity)

export async function initializeNetworkIndexes() {
  await Promise.all([NetworkState.init(), NetworkPerson.init(), NetworkRelationship.init(), CandidateIdentity.init()])
}
