import mongoose from 'mongoose'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import SearchHistory, { type HistoryDocument } from '../models/SearchHistory'
import { historySummary, historyDetail, settleInterruptedSearches } from '../services/history'

function pageNumber(value: unknown, fallback: number, maximum: number) {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number <= maximum ? number : null
}

export async function listHistory(req: AuthenticatedRequest, res: Response) {
  const page = pageNumber(req.query.page, 1, 100_000)
  const pageSize = pageNumber(req.query.pageSize, 20, 50)
  const q = req.query.q ?? ''
  const status = req.query.status ?? 'all'
  const sort = req.query.sort ?? 'recent'
  if (!page || !pageSize || typeof q !== 'string' || q.length > 160
    || !['all', 'pending', 'completed', 'failed'].includes(String(status)) || typeof status !== 'string'
    || !['recent', 'oldest'].includes(String(sort)) || typeof sort !== 'string') {
    res.status(400).json({ message: 'Invalid history filters or pagination.' }); return
  }
  const user = req.user!.id
  await settleInterruptedSearches(user)
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const filter: mongoose.QueryFilter<HistoryDocument> = {
    user, ...(status !== 'all' ? { status: status as 'pending' | 'completed' | 'failed' } : {}),
    ...(escaped ? { $or: ['originalQuery', 'company.name', 'matches.company.name', 'target.name', 'target.title', 'founders.name'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } })) } : {}),
  }
  const direction = sort === 'oldest' ? 1 : -1
  const [records, total] = await Promise.all([
    SearchHistory.find(filter).select('-result -matches -requestId -queryFingerprint -user').sort({ createdAt: direction, _id: direction }).skip((page - 1) * pageSize).limit(pageSize),
    SearchHistory.countDocuments(filter),
  ])
  res.json({ records: records.map(record => historySummary(record)), source: 'account', page, pageSize, total, totalPages: Math.ceil(total / pageSize) })
}

export async function getHistory(req: AuthenticatedRequest, res: Response) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) { res.status(404).json({ message: 'Saved search not found.' }); return }
  await settleInterruptedSearches(req.user!.id)
  const record = await SearchHistory.findOne({ _id: req.params.id, user: req.user!.id })
  if (!record) { res.status(404).json({ message: 'Saved search not found.' }); return }
  res.json(historyDetail(record))
}

export async function deleteHistory(req: AuthenticatedRequest, res: Response) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) { res.status(404).json({ message: 'Saved search not found.' }); return }
  const record = await SearchHistory.findOneAndDelete({ _id: req.params.id, user: req.user!.id })
  if (!record) { res.status(404).json({ message: 'Saved search not found.' }); return }
  res.status(204).end()
}
