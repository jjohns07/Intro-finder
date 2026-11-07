import { StrictMode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DiscoveryWorkspace } from '../components/discovery/DiscoveryWorkspace'
import { DiscoveryMatches } from '../components/discovery/DiscoveryResults'
import { companyDiscovery, type DiscoveryResult, type DiscoveryService } from '../services/discovery'
import type { SavedSearch } from '../services/history'

const result: DiscoveryResult = { company: { id: 'test-company', name: 'Example', source: 'approved-source', website: 'https://example.com', attribution: { provider: 'Test Provider', recordId: 'test-company', retrievedAt: '2026-11-07', reliability: 'aggregated-provider-data' } }, people: [{ id: 'founder', name: 'Test Founder', title: 'Co-founder', role: 'founder', source: 'approved-source', evidence: [{ provider: 'Test Provider', recordId: 'founder', field: 'experience[0]', companyId: 'test-company', title: 'Co-founder', affiliation: 'historical', endDate: '2024-05', sourceCount: 2 }], verification: { confidence: 'provider-supported', explanation: 'Explicit title and matching company ID.', limitation: 'Not independently checked.' } }], paths: null, source: 'approved-source', peopleStatus: 'available', connectionStatus: 'unavailable' }
const saved = (overrides: Partial<SavedSearch> = {}): SavedSearch => ({ id: 'saved-1', originalQuery: 'Example', normalizedCompanyName: 'example', company: result.company, status: 'completed', outcome: 'success', updatedAt: '2026-11-07', provenance: { provider: 'test', source: 'approved-source', snapshotVersion: 2 }, result, matches: [result], totalMatches: 1, matchMode: 'exact', ...overrides })
const mount = (service: DiscoveryService, initialCompany?: string) => render(<StrictMode><MemoryRouter><DiscoveryWorkspace service={service} initialCompany={initialCompany} /></MemoryRouter></StrictMode>)
const submit = () => { fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Example' } }); fireEvent.submit(screen.getByRole('search', { name: 'Company discovery' })) }

describe('discovery workspace', () => {
  it('validates input before execution', () => {
    const search = vi.fn(); mount({ available: true, search })
    fireEvent.submit(screen.getByRole('search', { name: 'Company discovery' }))
    expect(screen.getByRole('alert').textContent).toContain('2–160')
    expect(search).not.toHaveBeenCalled()
  })

  it('shows loading, prevents duplicate submissions, then renders company, candidates and sources', async () => {
    let complete!: (record: SavedSearch) => void
    const search = vi.fn(() => new Promise<SavedSearch>(resolve => { complete = resolve }))
    mount({ available: true, search }); submit()
    expect(screen.getByRole('button', { name: /Searching/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.submit(screen.getByRole('search', { name: 'Company discovery' }))
    expect(search).toHaveBeenCalledTimes(1)
    await act(async () => complete(saved()))
    expect(screen.getByRole('heading', { name: 'Example' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Test Founder' })).toBeTruthy()
    fireEvent.click(screen.getByText('Review source evidence'))
    expect(screen.getByText(/Historical affiliation/)).toBeTruthy()
    expect(screen.getByText(/Not independently checked/)).toBeTruthy()
    expect(screen.getByText(/No relationship source is connected/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open saved search/ }).getAttribute('href')).toBe('/history/saved-1')
  })

  it.each([
    ['no_matches', 'No company found.'],
    ['provider_unavailable', 'Company searchis not connected.'],
    ['provider_error', 'We couldn’t complete your search.'],
    ['rate_limited', 'We couldn’t complete your search.'],
  ] as const)('renders recorded %s outcome', async (outcome, heading) => {
    mount({ available: true, search: vi.fn().mockResolvedValue(saved({ outcome, result: null, matches: [], status: outcome === 'no_matches' ? 'completed' : 'failed', message: 'Specific provider status' })) })
    submit()
    await waitFor(() => expect(screen.getAllByRole('heading').some(node => node.textContent === heading)).toBe(true))
    expect(screen.getByRole('link', { name: /Open saved search/ })).toBeTruthy()
  })

  it('reuses the execution key after uncertain network failure', async () => {
    const search = vi.fn().mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValueOnce(saved())
    mount({ available: true, search }); submit()
    fireEvent.click(await screen.findByRole('button', { name: /Try again/ }))
    await screen.findByRole('heading', { name: 'Example' })
    expect(search.mock.calls[0][1].requestId).toBe(search.mock.calls[1][1].requestId)
  })

  it('reuses a pending key and starts a new attempt only after a final response', async () => {
    const search = vi.fn().mockResolvedValueOnce(saved({ status: 'pending', outcome: null, result: null, matches: [] })).mockResolvedValue(saved())
    mount({ available: true, search }); submit()
    await screen.findByRole('heading', { name: 'Your search is still in progress.' })
    fireEvent.submit(screen.getByRole('search', { name: 'Company discovery' }))
    await screen.findByRole('heading', { name: 'Example' })
    expect(search.mock.calls[0][1].requestId).toBe(search.mock.calls[1][1].requestId)
    fireEvent.submit(screen.getByRole('search', { name: 'Company discovery' }))
    await waitFor(() => expect(search).toHaveBeenCalledTimes(3))
    expect(search.mock.calls[2][1].requestId).not.toBe(search.mock.calls[1][1].requestId)
  })

  it('auto-submits a route query once under Strict Mode', async () => {
    vi.useFakeTimers()
    const search = vi.fn().mockResolvedValue(saved())
    try {
      mount({ available: true, search }, 'Example')
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(screen.getByRole('heading', { name: 'Example' })).toBeTruthy()
      expect(search).toHaveBeenCalledTimes(1)
    } finally { vi.useRealTimers() }
  })

  it('ignores a response after clearing the search', async () => {
    let complete!: (record: SavedSearch) => void
    mount({ available: true, search: () => new Promise(resolve => { complete = resolve }) }); submit()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel and clear search' }))
    await act(async () => complete(saved()))
    expect(screen.queryByRole('heading', { name: 'Example' })).toBeNull()
  })
})

it('ambiguous selection uses existing results without another search or automatic selection', async () => {
  const second = { ...result, company: { ...result.company, id: 'second', name: 'Example UK' }, people: [], peopleStatus: 'no_candidates' as const }
  const search = vi.fn().mockResolvedValue(saved({ result: null, matches: [result, second], totalMatches: 10, outcome: 'ambiguous' }))
  mount({ available: true, search }); submit()
  await screen.findByRole('heading', { name: 'Which company did you mean?' })
  expect(screen.queryByRole('heading', { name: 'Test Founder' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Example UK/ }))
  expect(screen.getByRole('heading', { name: 'Example UK' })).toBeTruthy()
  expect(screen.getByText(/No founder or decision-maker candidates/)).toBeTruthy()
  expect(search).toHaveBeenCalledTimes(1)
})

it('restores a saved ambiguous result, and does not render unsafe profile links', () => {
  render(<DiscoveryMatches matches={[{ ...result, company: { ...result.company, profileUrl: 'javascript:alert(1)' } }]} total={1} matchMode="prefix" onNewSearch={() => {}} />)
  expect(screen.getByText(/No exact name matched/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Example/ }))
  expect(screen.queryByRole('link', { name: /View company profile/ })).toBeNull()
})

it('sends JWT/idempotency header and retains history on HTTP 429', async () => {
  sessionStorage.setItem('introfinder_token', 'test-jwt')
  const response = saved({ status: 'failed', outcome: 'rate_limited', result: null, matches: [], message: 'Try later.' })
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 429 }))
  vi.stubGlobal('fetch', fetcher)
  const found = await companyDiscovery.search('Example', { requestId: 'test-key', signal: new AbortController().signal })
  expect(found.id).toBe('saved-1'); expect(found.outcome).toBe('rate_limited')
  const headers = fetcher.mock.calls[0][1].headers as Headers
  expect(headers.get('authorization')).toBe('Bearer test-jwt')
  expect(headers.get('idempotency-key')).toBe('test-key')
  expect(fetcher.mock.calls[0][0]).toContain('/discovery/search')
})
