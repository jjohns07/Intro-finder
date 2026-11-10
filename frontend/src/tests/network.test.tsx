import { it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NetworkPage } from '../components/account/NetworkPage'
import { CandidateNetworkMatch } from '../components/discovery/CandidateNetworkMatch'
import { DiscoveryResults } from '../components/discovery/DiscoveryResults'
import { networkService, type NetworkStatus } from '../services/network'
import type { DiscoveryResult } from '../services/discovery'

// These are synthetic UI fixtures, never runtime demonstration discoveries.
const status: NetworkStatus = { imported: false, revision: 0, personCount: 0, relationshipCount: 0, source: null, socialIntegration: 'unavailable' }
const founder = { id: 'fixture-founder', name: 'Fixture Founder', title: 'Co-founder', role: 'founder', source: 'approved-source' as const }
const evidence = { source: 'csv' as const, verification: 'user_confirmed' as const, statement: 'Synthetic evidence from our fixture project.',
  observedAt: '2026-11-01T00:00:00.000Z', importedAt: '2026-11-10T00:00:00.000Z', updatedAt: '2026-11-10T00:00:00.000Z' }
const identity = { personId: 'founder', name: 'Fixture Founder Contact', verification: 'user_confirmed' as const, statement: 'Synthetic identity evidence for the test candidate.', confirmedAt: '2026-11-10T00:00:00.000Z' }
const result: DiscoveryResult = { company: { id: 'fixture-company', name: 'Fixture Company', source: 'approved-source' }, source: 'approved-source',
  people: [{ id: 'me', name: 'Fixture User', isCurrentUser: true, source: 'user-import' }, { id: 'a', name: 'Fixture Connector', title: 'Fixture colleague', profileUrl: 'https://example.com/a', source: 'user-import', importedAt: evidence.importedAt }, founder],
  connections: [{ id: 'one', fromPersonId: 'me', toPersonId: 'a', relationship: 'direct_connection', source: 'user-import', evidence }, { id: 'two', fromPersonId: 'a', toPersonId: founder.id, relationship: 'user_confirmed', source: 'user-import', evidence }],
  paths: [{ id: 'fixture-path', startPersonId: 'me', targetPersonId: founder.id, path: ['me', 'a', founder.id], connectionIds: ['one', 'two'], steps: 2, intermediateCount: 1, source: 'user-import', oldestEvidenceAt: evidence.observedAt }],
  introduction: { status: 'available', socialIntegration: 'unavailable', networkRevision: 1, networkUpdatedAt: evidence.importedAt, maxDepth: 4, maxPathsPerCandidate: 3, limited: false, candidates: [{ candidateId: founder.id, status: 'available', identity }] },
}
const mount = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>)

it('shows each evidenced edge, steps, intermediaries, dates and inspectable people', () => {
  mount(<DiscoveryResults result={result} onNewSearch={() => {}} />)
  expect(screen.getByText('2 steps · 1 intermediary')).toBeTruthy()
  expect(screen.getByText('Inspect Fixture Connector')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Explore this path/ }))
  expect(screen.getAllByText(evidence.statement)).toHaveLength(2)
  expect(screen.getAllByText(/Confirmed by you; not independently verified/)).toHaveLength(2)
  expect(screen.getAllByText(/Observed:/)[0].querySelector('time')?.dateTime).toBe(evidence.observedAt)
  expect(screen.getByRole('link', { name: /Manage your network/ }).getAttribute('href')).toBe('/network')
})

it('does not display a chain with missing evidence, a follow edge, or an unconfirmed target identity', () => {
  for (const invalid of [
    { ...result, connections: result.connections!.map(edge => ({ ...edge, evidence: undefined })) },
    { ...result, connections: result.connections!.map(edge => ({ ...edge, relationship: 'follows' as const })) },
    { ...result, introduction: { ...result.introduction!, candidates: [] } },
  ]) {
    const view = mount(<DiscoveryResults result={invalid} onNewSearch={() => {}} />)
    expect(screen.queryByRole('button', { name: /Explore this path/ })).toBeNull()
    expect(screen.getByText(/lack complete people, identity confirmation or relationship evidence/)).toBeTruthy()
    view.unmount()
  }
})

it('distinguishes missing network, unresolved identity, candidate failure and bounded no-path outcomes', () => {
  for (const [kind, text] of [
    ['network_not_imported', /No private network has been imported/], ['identity_unresolved', /Matching names alone cannot establish an identity/],
    ['candidate_provider_error', /provider could not retrieve founder/], ['search_limited', /No path was found within the bounded search/],
  ] as const) {
    const view = mount(<DiscoveryResults result={{ ...result, paths: [], connections: [], introduction: { ...result.introduction!, status: kind } }} onNewSearch={() => {}} />)
    expect(screen.getByText(text)).toBeTruthy()
    view.unmount()
  }
})

it('CSV preview writes nothing and requires explicit confirmation before importing', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(networkService, 'status').mockResolvedValue(status)
  const preview = vi.spyOn(networkService, 'preview').mockResolvedValue({ personCount: 1, relationshipCount: 1, confirmedCount: 1, people: [{ localId: 'a', name: 'Fixture Contact' }] })
  const save = vi.spyOn(networkService, 'importCsv').mockResolvedValue({ ...status, imported: true, revision: 1, personCount: 1, relationshipCount: 1, source: 'csv', unchanged: false })
  mount(<NetworkPage user={{ id: 'fixture-user', name: 'Fixture User', email: 'fixture@example.com' }} logo={null} onLogout={() => {}} />)
  await screen.findByText('No network imported yet.')
  const file = new File(['fixture CSV'], 'fixture.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'text', { value: async () => 'fixture CSV' })
  fireEvent.change(screen.getByLabelText('Choose your authorised CSV'), { target: { files: [file] } })
  await screen.findByText('Review fixture.csv')
  expect(preview).toHaveBeenCalledWith('fixture CSV'); expect(save).not.toHaveBeenCalled()
  const button = screen.getByRole('button', { name: 'Import private network' })
  expect(button.hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /I am authorised to use this data/ }))
  fireEvent.click(button)
  await screen.findByText(/Your private network was imported/)
  expect(save).toHaveBeenCalledWith('fixture CSV', 0)
})

it('candidate matching requires selected contact, written evidence and explicit identity confirmation', async () => {
  vi.spyOn(networkService, 'people').mockResolvedValue({ ...status, imported: true, revision: 7, people: [{ localId: 'founder', name: 'Fixture Founder Contact' }], total: 1 })
  const link = vi.spyOn(networkService, 'link').mockResolvedValue(result)
  const onResult = vi.fn()
  mount(<CandidateNetworkMatch person={founder} companyId="fixture-company" searchId="saved-fixture" onResult={onResult} />)
  fireEvent.click(screen.getByRole('button', { name: 'Match to your network' }))
  await screen.findByRole('option', { name: 'Fixture Founder Contact · founder' })
  const save = screen.getByRole('button', { name: 'Confirm identity and find paths' })
  expect(save.hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('Contact for Fixture Founder'), { target: { value: 'founder' } })
  fireEvent.change(screen.getByLabelText('Evidence for this identity'), { target: { value: identity.statement } })
  expect(save.hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm this imported contact/ }))
  fireEvent.click(save)
  await waitFor(() => expect(onResult).toHaveBeenCalledWith(result))
  expect(link).toHaveBeenCalledWith({ searchId: 'saved-fixture', companyId: 'fixture-company', candidateId: founder.id, personId: 'founder', revision: 7, statement: identity.statement, confirmed: true })
})

it('refreshing paths uses the saved company ID and preserves the company overview', async () => {
  const refresh = vi.spyOn(networkService, 'refreshPaths').mockResolvedValue(result)
  mount(<DiscoveryResults result={{ ...result, paths: [], connections: [] }} searchId="saved-fixture" onNewSearch={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh introduction paths' }))
  await screen.findByRole('button', { name: /Explore this path/ })
  expect(refresh).toHaveBeenCalledWith('saved-fixture', 'fixture-company')
  expect(screen.getByRole('heading', { name: 'Fixture Company' })).toBeTruthy()
})
