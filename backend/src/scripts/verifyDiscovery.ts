import path from 'node:path'
import dotenv from 'dotenv'
import { createDiscoveryProvider } from '../discovery/provider'

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true })

async function main() {
  const provider = createDiscoveryProvider()
  if (provider.name !== 'skrapp' || !provider.verifyConnection) {
    console.error('Skrapp is not selected. Set DISCOVERY_PROVIDER=skrapp on the backend.')
    process.exitCode = 1
    return
  }
  const verification = await provider.verifyConnection()
  // Never log the provider object, configuration, responses, people, or credentials.
  console.log(JSON.stringify({ provider: 'skrapp', verification }))
  if (verification.status !== 'passed') process.exitCode = 1
}

void main().catch(() => {
  console.error('Skrapp discovery API verification could not complete.')
  process.exitCode = 1
})
