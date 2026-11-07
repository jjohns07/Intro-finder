import { ProviderError } from './errors'

export function normalizeQuery(value: string) { return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() }
export function validQuery(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 160 || /[\p{Cc}\p{Cf}]/u.test(value)) return false
  const normalized = normalizeQuery(value)
  return normalized.length >= 2 && normalized.length <= 160 && /[\p{L}\p{N}]/u.test(normalized)
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderError('provider_error')
  return value as Record<string, unknown>
}
export function optionalObject(value: unknown) { return value == null ? {} : object(value) }
export function textField(value: unknown, max = 300, required = false): string | undefined {
  if (value == null && !required) return undefined
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new ProviderError('provider_error')
  return value.trim() || undefined
}
export function arrayField(value: unknown, max = 200): unknown[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > max) throw new ProviderError('provider_error')
  return value
}
export function urlField(value: unknown): string | undefined {
  const text = textField(value, 2048)
  if (!text) return undefined
  try {
    const url = new URL(/^[\w+.-]+:/.test(text) ? text : `https://${text}`)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.') ? url.href : undefined
  } catch { return undefined }
}
export function dateField(value: unknown): string | undefined {
  const date = textField(value, 10)
  if (date && (!/^\d{4}(-\d{2}){0,2}$/.test(date) || !Number.isFinite(Date.parse(date)))) throw new ProviderError('provider_error')
  return date
}
