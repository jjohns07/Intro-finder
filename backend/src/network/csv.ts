import { NETWORK_LIMITS, NetworkInputError, RELATIONSHIP_TYPES, type ImportedPerson, type ImportedRelationship, type NetworkRelationshipType, type RelationshipVerification } from './types'

export const CSV_COLUMNS = ['source_id', 'source_name', 'source_profile_url', 'destination_id', 'destination_name', 'destination_profile_url',
  'relationship_type', 'verification_status', 'evidence', 'observed_at'] as const

// Bounded RFC 4180-style parser: quoted commas/newlines and escaped quotes are
// accepted. No spreadsheet evaluation, URLs fetched, or names used as identity.
function rows(csv: string) {
  if (Buffer.byteLength(csv, 'utf8') > 1_000_000) throw new NetworkInputError('CSV must be at most 1 MB.', 413)
  if (csv.includes('\ufffd')) throw new NetworkInputError('CSV contains invalid or unsupported UTF-8 characters.')
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(csv)) throw new NetworkInputError('CSV contains unsupported control characters.')
  const result: string[][] = []
  let row: string[] = [], cell = '', quoted = false, closed = false
  const endCell = () => { row.push(cell); cell = ''; closed = false; if (row.length > 12) throw new NetworkInputError('CSV has too many columns.') }
  const endRow = () => { endCell(); if (row.some(value => value.trim())) result.push(row); row = []; if (result.length > NETWORK_LIMITS.rows + 1) throw new NetworkInputError(`CSV must have at most ${NETWORK_LIMITS.rows} relationships.`) }
  const input = csv.replace(/^\ufeff/, '').replace(/\r\n/g, '\n')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') { quoted = false; closed = true }
      else cell += char
    } else if (char === ',') endCell()
    else if (char === '\n') endRow()
    else if (char === '"' && !cell && !closed) quoted = true
    else if (closed || char === '"' || char === '\r') throw new NetworkInputError(`Malformed CSV near record ${result.length + 1}.`)
    else cell += char
    if (cell.length > 2048) throw new NetworkInputError(`CSV field is too long near record ${result.length + 1}.`)
  }
  if (quoted) throw new NetworkInputError('CSV has an unclosed quoted field.')
  if (cell || row.length || closed) endRow()
  return result
}

export function profileUrl(value: string) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || url.hash || url.search) throw new Error()
    return url.href.replace(/\/$/, '')
  } catch { throw new NetworkInputError('Profile URLs must be HTTPS, without credentials, fragments or query strings.') }
}

export function evidenceText(value: unknown) {
  if (typeof value !== 'string' || value.trim().length < 10 || value.length > 500 || /[\p{Cc}\p{Cf}]/u.test(value)) throw new NetworkInputError('Evidence must be 10–500 characters of plain text.')
  return value.trim()
}

export function parseNetworkCsv(csv: unknown, now = Date.now()) {
  if (typeof csv !== 'string') throw new NetworkInputError('Send a UTF-8 CSV file with Content-Type: text/csv.')
  const [header, ...data] = rows(csv)
  if (!header || new Set(header).size !== header.length || CSV_COLUMNS.some(column => !header.includes(column))
    || header.some(column => ![...CSV_COLUMNS, 'source_title', 'destination_title'].includes(column as typeof CSV_COLUMNS[number]))) throw new NetworkInputError('CSV headers must match the documented connection-import template.')
  if (!data.length) throw new NetworkInputError('CSV has no relationship records.')
  const people = new Map<string, ImportedPerson>()
  const seen = new Set<string>()
  const relationships: ImportedRelationship[] = []
  for (const [index, values] of data.entries()) {
    const rowNumber = index + 2
    try {
      if (values.length !== header.length) throw new NetworkInputError('Column count does not match the header.')
      const row = Object.fromEntries(header.map((key, i) => [key, values[i].trim()]))
      for (const side of ['source', 'destination']) {
        const localId = row[`${side}_id`]
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(localId)) throw new NetworkInputError('Person IDs must be 1–80 letters, digits, dots, colons, dashes or underscores.')
        const name = row[`${side}_name`], title = row[`${side}_title`] || undefined
        const url = profileUrl(row[`${side}_profile_url`])
        if (localId === 'me') {
          if (name || title || url) throw new NetworkInputError('Leave name, title and profile URL blank for me; your identity comes from your signed-in account.')
          continue
        }
        if (!name || name.length > 200 || /[\p{Cc}\p{Cf}]/u.test(name) || (title && (title.length > 300 || /[\p{Cc}\p{Cf}]/u.test(title)))) throw new NetworkInputError('Each contact needs a name of at most 200 characters and an optional title of at most 300 characters.')
        const person = { localId, name, profileUrl: url, title }
        const previous = people.get(localId)
        if (previous && JSON.stringify(previous) !== JSON.stringify(person)) throw new NetworkInputError('The same person ID has conflicting names, titles or profile URLs.')
        people.set(localId, person)
      }
      if (row.source_id === row.destination_id) throw new NetworkInputError('Self-relationships are not allowed.')
      if (!RELATIONSHIP_TYPES.includes(row.relationship_type as NetworkRelationshipType)) throw new NetworkInputError('Unknown relationship type.')
      if (!['unverified', 'user_confirmed'].includes(row.verification_status)) throw new NetworkInputError('Verification must be unverified or user_confirmed; CSV cannot claim provider verification.')
      const date = new Date(row.observed_at)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.observed_at) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.observed_at || date.getTime() > now) throw new NetworkInputError('observed_at must be a valid YYYY-MM-DD date that is not in the future.')
      const key = JSON.stringify([row.source_id, row.destination_id, row.relationship_type])
      if (seen.has(key)) throw new NetworkInputError('Duplicate directed relationship; include each source/destination/type only once.')
      seen.add(key)
      relationships.push({ from: row.source_id, to: row.destination_id, type: row.relationship_type as NetworkRelationshipType,
        verification: row.verification_status as RelationshipVerification, evidence: evidenceText(row.evidence), observedAt: date.toISOString(), row: rowNumber })
    } catch (error) { throw new NetworkInputError(`Record ${rowNumber}: ${error instanceof NetworkInputError ? error.message : 'Invalid relationship.'}`) }
  }
  if (people.size > NETWORK_LIMITS.people) throw new NetworkInputError(`A network may contain at most ${NETWORK_LIMITS.people} contacts.`)
  if (!relationships.some(edge => edge.from === 'me' || edge.to === 'me')) throw new NetworkInputError('Include me as an endpoint to anchor this network to your account.')
  const urls = [...people.values()].flatMap(person => person.profileUrl ? [person.profileUrl] : [])
  if (new Set(urls).size !== urls.length) throw new NetworkInputError('A profile URL belongs to multiple person IDs. Use one stable ID per person.')
  return { people: [...people.values()], relationships }
}
