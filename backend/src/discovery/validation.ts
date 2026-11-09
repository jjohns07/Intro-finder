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

export function integerField(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
  if (value == null) return undefined
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new ProviderError('provider_error')
  return Number(value)
}

export function timestampField(value: unknown): string | undefined {
  const text = textField(value, 40)
  if (text && (!/^\d{4}-\d{2}-\d{2}T/.test(text) || !Number.isFinite(Date.parse(text)))) throw new ProviderError('provider_error')
  return text
}

export function domainField(value: unknown): string | undefined {
  const text = textField(value, 253)?.toLowerCase()
  // A provider's email domain is a separate field, never an invented website URL.
  if (!text || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z\d-]{2,63}$/.test(text)) return undefined
  return text
}
