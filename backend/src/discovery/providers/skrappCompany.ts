import type { Company, CompanyDetails } from '../types'
import { ProviderError } from '../errors'
import { domainField, integerField, object, textField, urlField } from '../validation'

export function skrappCompanyId(value: unknown) {
  // Internal IDs exceed 2^53. The encoded search `id` is a different identifier.
  const id = textField(value, 64, true)!
  if (!/^\d+$/.test(id)) throw new ProviderError('provider_error')
  return id
}

function location(parts: (string | undefined)[]) {
  return [...new Set(parts.filter(Boolean))].join(', ') || undefined
}

export function searchCompany(value: unknown, retrievedAt: string): Company {
  const row = object(value)
  const id = skrappCompanyId(row.internal_id)
  const city = textField(row.city, 200), region = textField(row.geo_area, 200), country = textField(row.country, 200)
  return {
    id, name: textField(row.name, 200, true)!, source: 'approved-source',
    website: urlField(row.website), domain: domainField(row.domain), industry: textField(row.industry, 200),
    country, city, region, location: textField(row.hq_location, 1000) ?? location([city, region, country]),
    employeeRange: textField(row.employee_count_range, 100),
    companyType: textField(row.type, 200), foundedYear: integerField(row.founded, 1, 9999),
    activityStatus: textField(row.activity_status, 200),
    logoUrl: urlField(row.logo_url), profileUrl: urlField(row.linkedin_url),
    attribution: { provider: 'Skrapp', recordId: id, retrievedAt, reliability: 'aggregated-provider-data' },
  }
}

// Field names below are from the v3 firmographics category, not the search or
// snapshot schemas: https://skrapp.io/api#cat-firmographics (reviewed 2026-11-10).
export function firmographicsCompany(value: unknown, base: Company, retrievedAt: string) {
  const row = object(value)
  const country = textField(row.hq_country, 200), city = textField(row.hq_city, 200), region = textField(row.hq_state, 200)
  let description: string | undefined, descriptionField: CompanyDetails['descriptionField']
  for (const field of ['description', 'description_short', 'meta_description'] as const) {
    const supplied = textField(row[field], 20_000)
    if (supplied) { description = supplied; descriptionField = field; break }
  }
  const company: Company = {
    id: base.id, name: textField(row.company_name, 200) ?? base.name, source: 'approved-source',
    description, industry: textField(row.industry, 200),
    website: urlField(row.website), domain: domainField(row.domain),
    country, city, region,
    location: textField(row.hq_full_address, 1000) ?? textField(row.hq_location, 1000) ?? location([city, region, country]),
    employeeRange: textField(row.employees_range, 100), linkedinEmployeeCount: integerField(row.linkedin_employees_count),
    legalName: textField(row.company_legal_name, 300), companyType: textField(row.type, 200),
    foundedYear: integerField(row.founded_year, 1, 9999), activityStatus: textField(row.activity_status, 200),
    logoUrl: urlField(row.company_logo), profileUrl: urlField(row.linkedin_url),
    attribution: { provider: 'Skrapp', recordId: base.id, retrievedAt, reliability: 'aggregated-provider-data' },
  }
  return { company, descriptionField }
}

// The free snapshot is a flat object, not an enrichment category. Project only
// its documented fields; it does not supply a description or a LinkedIn count.
// https://skrapp.io/api#company-snapshot (reviewed 2026-11-10).
export function snapshotCompany(value: unknown, base: Company, retrievedAt: string): Company {
  const row = object(value)
  if (skrappCompanyId(row.id) !== base.id) throw new ProviderError('provider_error')
  textField(row.company_name, 200, true)
  const fields = ['company_name', 'domain', 'website', 'linkedin_url', 'company_logo', 'industry', 'type',
    'employees_range', 'hq_location', 'hq_country', 'hq_state', 'hq_city', 'founded_year', 'activity_status']
  return firmographicsCompany(Object.fromEntries(fields.map(field => [field, row[field]])), base, retrievedAt).company
}
