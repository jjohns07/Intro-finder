import type { Company, Connection, IntroductionPath, Person } from './types'

export const LOCAL_FIXTURE_COMPANY: Company = {
  id: 'company-fixture-001',
  name: 'Northstar Labs',
  website: 'https://example.com',
  industry: 'B2B SaaS',
  source: 'local-fixture',
  metadata: {
    fixtureLabel: 'Local test fixture only; not a real customer or user relationship.',
  },
}

export const LOCAL_FIXTURE_PEOPLE: Person[] = [
  {
    id: 'person-fixture-001',
    name: 'Priya Shah',
    title: 'VP of Product',
    companyId: 'company-fixture-001',
    role: 'executive',
    source: 'local-fixture',
    isFixture: true,
    metadata: {
      fixtureLabel: 'Synthetic fixture for engine testing only.',
    },
  },
  {
    id: 'person-fixture-002',
    name: 'Marco Diaz',
    title: 'Engineering Manager',
    companyId: 'company-fixture-001',
    role: 'operator',
    source: 'local-fixture',
    isFixture: true,
  },
  {
    id: 'person-fixture-003',
    name: 'Renee Patel',
    title: 'Advisor',
    role: 'advisor',
    source: 'local-fixture',
    isFixture: true,
    metadata: {
      fixtureLabel: 'Synthetic fixture for engine testing only.',
    },
  },
]

export const LOCAL_FIXTURE_CONNECTIONS: Connection[] = [
  {
    id: 'connection-fixture-001',
    fromPersonId: 'person-fixture-003',
    toPersonId: 'person-fixture-001',
    relationship: 'vouched',
    strength: 0.85,
    source: 'local-fixture',
    notes: 'Synthetic route used for discovery-engine tests only.',
  },
  {
    id: 'connection-fixture-002',
    fromPersonId: 'person-fixture-002',
    toPersonId: 'person-fixture-001',
    relationship: 'warm',
    strength: 0.7,
    source: 'local-fixture',
    notes: 'Synthetic route used for discovery-engine tests only.',
  },
]

export const LOCAL_FIXTURE_PATHS: IntroductionPath[] = [
  {
    id: 'path-fixture-001',
    startPersonId: 'person-fixture-003',
    targetPersonId: 'person-fixture-001',
    path: ['person-fixture-003', 'person-fixture-001'],
    pathType: 'warm',
    confidence: 0.82,
    explanation: 'Local fixture path for engine validation only; not a real introduction recommendation.',
    source: 'local-fixture',
    isFixture: true,
  },
]
