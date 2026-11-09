import path from 'node:path'
import dotenv from 'dotenv'
import { createDiscoveryProvider } from '../discovery/provider'

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

async function main() {
  const provider = createDiscoveryProvider()
  if (provider.name !== 'skrapp' || !provider.available || !provider.verifyCompanyInformation) {
    console.error('Configure Skrapp in the backend environment before verifying company information.')
    process.exitCode = 1
    return
  }
  const report = await provider.verifyCompanyInformation()
  // Only fixed reference names, statuses and field presence. No response bodies,
  // descriptions, people, credentials or user history are logged.
  console.log(JSON.stringify({ provider: 'skrapp', companyInformation: report }, null, 2))
  if (report.status !== 'passed') process.exitCode = 1
}

void main().catch(() => {
  console.error('Company information verification could not complete.')
  process.exitCode = 1
})
