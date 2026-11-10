import { StrictMode } from 'react'
import { it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CompanyInformation } from '../components/discovery/CompanyInformation'
import { DiscoveryMatches } from '../components/discovery/DiscoveryResults'
import { SavedSearchPage } from '../components/account/SavedSearchPage'
import { companyDiscovery, type DiscoveryCompany, type DiscoveryCompanyDetails, type DiscoveryResult, type DiscoveryService } from '../services/discovery'
import { searchHistoryService, type SavedSearch } from '../services/history'

const company: DiscoveryCompany = { id: '8342903258370330161', name: 'Test Company', source: 'approved-source',
  website: 'https://example.com', domain: 'example.com', country: 'Nigeria', city: 'Lagos', region: 'Lagos',
  attribution: { provider: 'Skrapp', recordId: '8342903258370330161', retrievedAt: '2026-11-07T00:00:00.000Z', reliability: 'aggregated-provider-data' } }
const profile: DiscoveryCompanyDetails = { status: 'available', company: { ...company,
  description: 'The description returned by the test provider.', industry: 'Test industry', location: 'Supplied headquarters address',
  employeeRange: '11-50', linkedinEmployeeCount: 0, profileUrl: 'https://www.linkedin.com/company/example',
  logoUrl: 'https://example.com/logo.png', legalName: 'Test Company Limited', companyType: 'Privately Held', foundedYear: 2000 },
  checkedAt: '2026-11-09T12:00:00.000Z', retrievedAt: '2026-11-09T12:00:00.000Z', providerUpdatedAt: '2026-11-08T00:00:00.000Z',
  cached: false, descriptionField: 'description' }
const result: DiscoveryResult = { company, people: [{ id: 'founder', name: 'Test Founder', title: 'Co-founder', role: 'founder', source: 'approved-source' }],
  paths: null, peopleStatus: 'available', source: 'approved-source' }

it('displays supplied company fields, source dates and a separately labeled LinkedIn count', () => {
  render(<CompanyInformation company={company} initialDetails={profile} />)
  expect(screen.getByRole('heading', { name: company.name })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Company details' })).toBeTruthy()
  expect(screen.getByText(profile.company!.description!)).toBeTruthy()
  expect(screen.getByText('Nigeria')).toBeTruthy()
  expect(screen.getAllByText('Lagos')).toHaveLength(2)
  expect(screen.getByText('Supplied headquarters address')).toBeTruthy()
  expect(screen.getByText('11-50')).toBeTruthy()
  expect(screen.getByText('People listed on LinkedIn')).toBeTruthy()
  expect(screen.getByText('0')).toBeTruthy()
  expect(screen.getByText(/may differ from total employees/)).toBeTruthy()
  expect(screen.getByRole('link', { name: /View company profile/ }).getAttribute('href')).toContain('linkedin.com/company/example')
  fireEvent.click(screen.getByText('Company information sources'))
  expect(screen.getByText(/Last updated by the provider/).querySelector('time')?.getAttribute('datetime')).toBe(profile.providerUpdatedAt)
})

it('preserves a long provider description and supports accessible expand and collapse controls', () => {
  const description = 'A sentence returned by the provider. '.repeat(100) + 'The final supplied sentence.'
  render(<CompanyInformation company={company} initialDetails={{ ...profile, company: { ...company, description } }} />)
  const expand = screen.getByRole('button', { name: /Read full description/ })
  expect(expand.getAttribute('aria-expanded')).toBe('false')
  const content = document.getElementById(expand.getAttribute('aria-controls')!)!
  expect(content.textContent).not.toContain('The final supplied sentence.')
  fireEvent.click(expand)
  expect(content.textContent).toBe(description)
  const collapse = screen.getByRole('button', { name: /Show less/ })
  expect(collapse.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(collapse)
  expect(content.textContent).not.toContain('The final supplied sentence.')
})

it('renders unavailable fields honestly and falls back to initials for a broken logo', () => {
  const missing = { id: company.id, name: 'Test Company', source: 'approved-source' as const, logoUrl: 'https://example.com/broken.png' }
  const { container } = render(<CompanyInformation company={missing} initialDetails={{ ...profile, company: undefined, status: 'unavailable', descriptionField: undefined }} />)
  expect(screen.getAllByText('Not provided').length).toBeGreaterThanOrEqual(6)
  expect(screen.getByText(/description was not provided/)).toBeTruthy()
  expect(screen.getByText(/returned no additional company information/)).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.error(container.querySelector('img')!)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByText('TC')).toBeTruthy()
})

it('rejects unsafe website and company profile links in saved records', () => {
  render(<CompanyInformation company={{ ...company, website: 'javascript:alert(1)', profileUrl: 'data:text/html,test' }} />)
  expect(screen.queryAllByRole('link')).toHaveLength(0)
})

it('loads a profile only after selection, once under Strict Mode, and keeps executive candidates', async () => {
  const load = vi.fn().mockResolvedValue(profile)
  render(<StrictMode><DiscoveryMatches matches={[result]} total={1} matchMode="relevance" onNewSearch={() => {}} searchId="saved-1" loadDetails={load} /></StrictMode>)
  expect(load).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Test Company/ }))
  await screen.findByText(profile.company!.description!)
  expect(load).toHaveBeenCalledTimes(1)
  expect(load.mock.calls[0][0]).toBe('saved-1'); expect(load.mock.calls[0][1]).toBe(company.id)
  expect(load.mock.calls[0][2].refresh).toBe(false)
  expect(screen.getByRole('heading', { name: 'Test Founder' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Refresh company information/ }).hasAttribute('disabled')).toBe(false)
})

it('cancels an obsolete selection and ignores late responses for another company', async () => {
  let complete!: (value: DiscoveryCompanyDetails) => void
  const second = { ...result, company: { ...company, id: '123456789', name: 'Second Company' } }
  const load = vi.fn().mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    .mockResolvedValueOnce({ ...profile, company: { ...profile.company!, id: second.company.id, name: second.company.name, description: 'Second description.' } })
  render(<DiscoveryMatches matches={[result, second]} total={2} onNewSearch={() => {}} searchId="saved-1" loadDetails={load} />)
  fireEvent.click(screen.getByRole('button', { name: /^Test Company/ }))
  await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: /^Second Company/ }))
  await screen.findByText('Second description.')
  expect(load.mock.calls[0][2].signal.aborted).toBe(true)
  await act(async () => complete(profile))
  expect(screen.queryByText(profile.company!.description!)).toBeNull()
  expect(screen.getByRole('heading', { name: 'Second Company' })).toBeTruthy()
})

it('refresh bypasses the cache without another search, disables duplicate clicks and keeps old details on failure', async () => {
  let complete!: (value: DiscoveryCompanyDetails) => void
  const load = vi.fn<NonNullable<DiscoveryService['getCompanyDetails']>>(() => new Promise<DiscoveryCompanyDetails>(resolve => { complete = resolve }))
  render(<DiscoveryMatches matches={[{ ...result, companyDetails: { ...profile, cached: true } }]} total={1} onNewSearch={() => {}} searchId="saved-1" loadDetails={load} />)
  expect(load).not.toHaveBeenCalled()
  expect(screen.getByText(/Cached company information/)).toBeTruthy()
  const button = screen.getByRole('button', { name: /Refresh company information/ })
  fireEvent.click(button)
  expect(button.hasAttribute('disabled')).toBe(true)
  expect(load.mock.calls[0][2].refresh).toBe(true)
  expect(screen.getByText(profile.company!.description!)).toBeTruthy()
  await act(async () => complete({ ...profile, status: 'provider_timeout', cached: false }))
  expect(screen.getByRole('alert').textContent).toContain('did not respond in time')
  expect(screen.getByRole('alert').textContent).toContain('original source date')
  expect(screen.getByText(profile.company!.description!)).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Test Founder' })).toBeTruthy()
  expect(button.hasAttribute('disabled')).toBe(false)
})

it('network failure is separate from an unavailable description, and refresh can recover', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('Network interrupted.')).mockResolvedValueOnce(profile)
  render(<CompanyInformation company={company} searchId="saved-1" loadDetails={load} />)
  expect((await screen.findByRole('alert')).textContent).toContain('Network interrupted')
  expect(screen.getByText('A company description could not be retrieved.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Refresh company information/ }))
  await screen.findByText(profile.company!.description!)
  expect(screen.queryByRole('alert')).toBeNull()
})

it('restores saved profiles without a provider call and allows refreshing from Search History', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const saved: SavedSearch = { id: 'saved-1', originalQuery: 'Test Company', normalizedCompanyName: 'test company',
    company, status: 'completed', outcome: 'success', updatedAt: '2026-11-09T12:00:00.000Z',
    result: { ...result, companyDetails: profile }, matches: [{ ...result, companyDetails: profile }], totalMatches: 1, matchMode: 'exact',
    provenance: { provider: 'skrapp', source: 'approved-source', snapshotVersion: 3 } }
  vi.spyOn(searchHistoryService, 'get').mockResolvedValue(saved)
  const load = vi.spyOn(companyDiscovery, 'getCompanyDetails').mockResolvedValue({ ...profile, company: { ...profile.company!, description: 'Refreshed saved description.' } })
  render(<MemoryRouter initialEntries={['/history/saved-1']}><Routes><Route path="/history/:id" element={<SavedSearchPage user={{ id: 'test-user', name: 'Test User', email: 'test@example.com' }} logo={null} onLogout={() => {}} />} /></Routes></MemoryRouter>)
  await screen.findByText(profile.company!.description!)
  expect(load).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: /Search again/ }).getAttribute('href')).toBe('/find-introductions?company=Test%20Company')
  fireEvent.click(screen.getByRole('button', { name: /Refresh company information/ }))
  await screen.findByText('Refreshed saved description.')
  expect(load).toHaveBeenCalledTimes(1)
  expect(load.mock.calls[0].slice(0, 2)).toEqual(['saved-1', company.id])
  expect(screen.getByRole('heading', { name: 'Test Founder' })).toBeTruthy()
})

it('profile API sends the stored JWT and exact company ID, and rejects a mismatched response', async () => {
  sessionStorage.setItem('introfinder_token', 'test-jwt')
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(profile)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...profile, company: { ...company, id: 'wrong' } })))
  vi.stubGlobal('fetch', fetcher)
  const options = { signal: new AbortController().signal, refresh: true }
  const found = await companyDiscovery.getCompanyDetails!('saved-1', company.id, options)
  expect(found.company?.id).toBe(company.id)
  expect(fetcher.mock.calls[0][0]).toContain('/discovery/company-details')
  expect(new Headers(fetcher.mock.calls[0][1].headers).get('authorization')).toBe('Bearer test-jwt')
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ searchId: 'saved-1', companyId: company.id, refresh: true })
  expect(fetcher.mock.calls[0][1].cache).toBe('no-store')
  await expect(companyDiscovery.getCompanyDetails!('saved-1', company.id, options)).rejects.toThrow('invalid company information')
})

it('shows a successful basic snapshot separately from its failed description request', () => {
  render(<CompanyInformation company={company} initialDetails={{ ...profile, company: { ...company, employeeRange: '11-50' },
    profileSource: 'snapshot', enrichmentStatus: 'quota_exceeded', descriptionField: undefined }} />)
  expect(screen.getByText('Skrapp · Company snapshot')).toBeTruthy()
  expect(screen.getByText('Nigeria')).toBeTruthy()
  expect(screen.getByText('11-50')).toBeTruthy()
  expect(screen.getByText('A company description could not be retrieved.')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('no company information credits')
  expect(screen.getByRole('alert').textContent).toContain('Basic details were retrieved')
  expect(screen.queryByText(/description was not provided/)).toBeNull()
})

it('does not combine headquarters fields from different source snapshots', () => {
  const { rerender } = render(<CompanyInformation company={{ ...company, location: 'Lagos, Nigeria' }}
    initialDetails={{ ...profile, company: { id: company.id, name: company.name, source: 'approved-source', country: 'Canada', city: 'Ottawa' } }} />)
  expect(screen.getByText('Ottawa, Canada')).toBeTruthy()
  expect(screen.queryByText('Lagos')).toBeNull()
  expect(screen.queryByText('Nigeria')).toBeNull()
  rerender(<CompanyInformation key="address-only" company={company}
    initialDetails={{ ...profile, company: { id: company.id, name: company.name, source: 'approved-source', location: 'Provider-supplied full address' } }} />)
  expect(screen.getByText('Provider-supplied full address')).toBeTruthy()
  expect(screen.queryByText('Nigeria')).toBeNull()
})

it('marks an expired profile for refresh without spending another request from Search History', () => {
  const load = vi.fn()
  render(<CompanyInformation company={company} initialDetails={{ ...profile, expiresAt: '2020-01-01T00:00:00.000Z', cached: true }} searchId="saved-1" loadDetails={load} autoLoadDetails={false} />)
  expect(screen.getByText(/past their cache lifetime/)).toBeTruthy()
  expect(load).not.toHaveBeenCalled()
})

it('limits descriptions with many short lines and makes the expanded text keyboard accessible', () => {
  render(<CompanyInformation company={company} initialDetails={{ ...profile, company: { ...company, description: 'One line.\n'.repeat(50) } }} />)
  const expand = screen.getByRole('button', { name: /Read full description/ })
  const content = document.getElementById(expand.getAttribute('aria-controls')!)!
  expect(content.textContent!.split('\n').length).toBeLessThanOrEqual(6)
  fireEvent.click(expand)
  expect(content.getAttribute('tabindex')).toBe('0')
  expect(content.textContent!.split('\n').length).toBe(51)
})

it('rejects malformed optional profile fields and unsupported snapshot descriptions', async () => {
  for (const invalid of [
    { ...profile, company: { ...company, country: { name: 'Nigeria' } } },
    { ...profile, company: { ...company, linkedinEmployeeCount: -1 } },
    { ...profile, company: { ...company, description: ['unexpected'] } },
    { ...profile, profileSource: 'snapshot' },
    { ...profile, enrichmentStatus: 'quota_exceeded' },
    { ...profile, expiresAt: 'invalid date' },
  ]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(invalid))))
    await expect(companyDiscovery.getCompanyDetails!('saved-1', company.id, { signal: new AbortController().signal })).rejects.toThrow('invalid company information')
  }
})
