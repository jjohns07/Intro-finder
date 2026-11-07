import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import type { DiscoveryResult } from '../discovery/types'

const companySchema = new Schema({
  id: String, name: String, website: String, industry: String,
  description: String, logoUrl: String, source: String,
}, { _id: false })
const personSchema = new Schema({
  id: String, name: String, title: String, role: String,
  imageUrl: String, profileUrl: String, source: String,
}, { _id: false })

const searchHistorySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  requestId: { type: String, required: true, maxlength: 128, immutable: true },
  originalQuery: { type: String, required: true, maxlength: 160, immutable: true },
  normalizedCompanyName: { type: String, required: true, maxlength: 320, immutable: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], required: true, default: 'pending' },
  outcome: { type: String, enum: ['success', 'no_matches', 'provider_unavailable', 'provider_error'], default: null },
  message: { type: String, maxlength: 500 },
  company: { type: companySchema, default: null },
  target: { type: personSchema, default: null },
  founders: { type: [personSchema], default: [] },
  provenance: {
    provider: { type: String, required: true },
    source: { type: String, enum: ['approved-source', 'disabled'], required: true },
    snapshotVersion: { type: Number, default: 1 },
  },
  // Only the server-side provider projection may populate this. The API never
  // accepts snapshots, statuses or ownership information from a client.
  result: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true, bufferCommands: false })

searchHistorySchema.index({ user: 1, requestId: 1 }, { unique: true })
searchHistorySchema.index({ user: 1, createdAt: -1, _id: -1 })

export type HistoryDocument = InferSchemaType<typeof searchHistorySchema> & {
  _id: mongoose.Types.ObjectId
  result: DiscoveryResult | null
}
const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema)
export default SearchHistory
