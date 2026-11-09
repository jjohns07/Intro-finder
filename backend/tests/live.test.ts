import test from 'node:test'
import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import { createDiscoveryProvider } from '../src/discovery/provider'

dotenv.config({ quiet: true })
test('LIVE Skrapp company search and executive enrichment (up to three credits)', { skip: process.env.RUN_LIVE_DISCOVERY !== 'true' }, async () => {
  const provider = createDiscoveryProvider()
  assert.equal(provider.name, 'skrapp', 'Select Skrapp before running its live test.')
  assert.ok(provider.available, 'Skrapp credentials are missing from the backend environment.')
  assert.ok(provider.verifyConnection, 'This provider has no live verification routine.')
  const result = await provider.verifyConnection()
  assert.equal(result.companySearch, 'passed', 'Live company search did not return the expected company.')
  assert.equal(result.executiveEnrichment, 'passed', 'Live executive enrichment did not return usable candidates.')
  assert.equal(result.status, 'passed')
  assert.ok(result.executiveCount && result.executiveCount > 0)
})

test('LIVE company profiles across four countries and industries (up to four credits)', { skip: process.env.RUN_LIVE_COMPANY_INFORMATION !== 'true' }, async () => {
  const provider = createDiscoveryProvider()
  assert.equal(provider.name, 'skrapp')
  assert.ok(provider.available, 'Skrapp credentials are missing from the backend environment.')
  assert.ok(provider.verifyCompanyInformation)
  const report = await provider.verifyCompanyInformation()
  assert.equal(report.companies.length, 4)
  for (const company of report.companies) {
    assert.equal(company.status, 'passed', `${company.name}: ${company.status}`)
    assert.equal(company.description, 'available')
    assert.equal(company.country, 'matched')
    assert.equal(company.industry, 'available')
  }
  assert.equal(report.status, 'passed')
})
