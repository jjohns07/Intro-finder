# Company and executive discovery

## Provider and API contract

Skrapp is the default discovery provider. The adapter uses its documented REST API with the backend's `process.env.SKRAPP_API_KEY`, sent only in the `X-Access-Key` header to `https://api.skrapp.io`. Credentials are never returned, logged, committed, or placed in frontend configuration. The adapter's key is a JavaScript private field.

The existing Express/Mongoose/React architecture remains in place:

- `POST /api/discovery/search` requires the existing session JWT, an `Idempotency-Key` (8–128 letters, numbers, underscores or dashes), and JSON `{"companyName":"Example"}`.
- The backend creates an account-owned history record before contacting the provider. Replays of the same execution key reuse that record and do not make another provider request.
- `GET /api/history`, `GET /api/history/:id`, and `DELETE /api/history/:id` retain their existing ownership checks. Invalid queries and provider failures remain distinguishable saved outcomes.
- Existing PDL searches and saved snapshots remain readable. No destructive database migration is required.

A discovery execution makes these upstream requests:

1. `POST /api/v3/companies/search?size=5&start=0&lead_counts=false`, with `companyName` and `sort: "relevance"` in its JSON body.
2. For each returned company, `GET /api/v3/companies/enrich?id=<internal_id>&categories=headcount`.

The adapter preserves Skrapp's numeric-string `internal_id` without converting it to a JavaScript number. The encoded `id` in search results is a different identifier and is not passed to enrichment. Explicitly requesting `headcount` avoids the API's default of requesting all enrichment categories.

Search results are bounded to five companies. A single company with an exact normalized name is an exact match; other results use `matchMode: "relevance"` and require the user to choose. Skrapp's relevance ranking is not described as prefix matching or as a confidence score. No pagination is implemented.

## Executive evidence and limitations

The `headcount` category's `key_executives` array supplies names and titles. The adapter checks that the enrichment response's company ID matches the selected company, removes incomplete or duplicate rows, prioritizes explicit founder titles, and displays at most five candidates.

A founder candidate requires an explicit founder/co-founder title segment. CEO, owner, founding engineer, and founder's associate titles do not establish founder status. Other returned executives are decision-maker candidates.

Skrapp does not provide individual person IDs in this category. Candidate IDs are locally derived display-row identifiers scoped to the company, name and title. Evidence points to the company record and the executive-array entry. These IDs do not establish independent person identity. Current affiliation is reported by Skrapp; no employment dates, individual last-seen dates, source counts, or complete employment histories are invented.

Skrapp advertises 40M+ companies, but company and executive coverage is not universal. Fields may be absent or outdated, and executive lists are not complete founder registers. Returned names and titles are provider-supported candidates, not independently verified facts.

There is no relationship provider: `paths` is null, connections are empty, and connection status is unavailable. No mutual connections, trust scores, X-follow signals, contact emails or phone numbers are generated. LinkedIn URLs supplied by Skrapp are references; the backend does not fetch profile pages or use browser extensions, scraping, or platform credentials.

## Credentials and Render configuration

On the **backend Render web service**, open **Environment**. The provider key belongs only there:

```dotenv
DISCOVERY_PROVIDER=skrapp
SKRAPP_API_KEY=<set the secret in Render's Environment UI>
```

An unset provider defaults to Skrapp. An old `DISCOVERY_PROVIDER=pdl` setting also selects Skrapp if the PDL key is absent and a Skrapp key has been supplied. If an actual PDL key remains configured, explicitly select `skrapp`. An explicitly selected PDL adapter otherwise retains its existing configuration and storage-permission gate.

Optional settings and their defaults:

```dotenv
SKRAPP_EXECUTIVE_SEARCH_ENABLED=true
SKRAPP_SEARCH_REQUESTS_PER_MINUTE=20
SKRAPP_SEARCH_REQUESTS_PER_DAY=50
SKRAPP_VERIFY_ON_STARTUP=true
```

Missing credentials are nonfatal during local development. Authenticated searches return a saved `provider_unavailable` outcome without contacting Skrapp. No fixture or synthetic production results are substituted. The backend's normal JWT and database configuration requirements still apply.

Use Node 22.13 or newer. Render root directory: `backend`; build: `npm ci && npm run build`; start: `npm start`. Keep the existing MongoDB and JWT settings. Save and deploy after changing environment values. The frontend continues using its existing API service; `VITE_API_BASE_URL` points to the backend's `/api` base. Never put a provider key in a `VITE_*` variable.

## Real API verification on Render

After the backend starts on Render (`RENDER=true`), the configured Skrapp adapter runs a bounded verification unless `SKRAPP_VERIFY_ON_STARTUP=false`. It runs after the server begins listening and does not make startup depend on provider availability.

The check performs a real company search for Stripe, restricted to `stripe.com` with a page size of one, then requests that company's headcount enrichment. It uses the same adapter, authentication, response validation and executive projection as discovery. It does not access user accounts or save test searches to MongoDB.

The probe uses one search request and at most three credits for that company's headcount category on first retrieval. Skrapp documents repeat category retrievals as free of additional credit charges; active endpoint access is still required.

`GET /api/health` includes a nonsecret report:

```json
{
  "discovery": {
    "provider": "skrapp",
    "configured": true,
    "verification": {
      "status": "not_run",
      "companySearch": "not_run",
      "executiveEnrichment": "not_run"
    }
  }
}
```

- `configured: true` means a key is present, not that an API call succeeded.
- `status: "passed"` requires a valid real company response and usable executive candidates.
- `partial` means company search succeeded but enrichment was denied, failed, disabled or returned no candidates.
- `failed` means the company check could not be completed.
- Completed reports include a timestamp, fixed status codes, and an executive count when available. They contain no credentials, upstream error text, company profiles or personal names.
- Reading health never triggers a provider request. This is the last dedicated verification report for the current backend process.

To rerun verification from the backend's Render Shell, without copying the key:

```sh
npm run verify:discovery
```

This compiled CLI prints only the safe report and exits nonzero unless both checks pass. It runs in a separate process and does not overwrite the web service's startup report. An unavailable key or skipped test is not a live integration success. The development-only `npm run test:live` also runs the real check; when explicitly requested it fails on missing configuration rather than silently skipping.

## Limits, pricing and permitted usage

The API reference documents company search as zero-credit, with default limits of 20 requests/minute and 50/day on Free, or 100/minute and 2,000/day on paid plans. Search limits are enforced conservatively per backend process, including UTC daily limits. With multiple Render instances or a shared key, allocate the allowance across processes or use a shared limiter.

Headcount enrichment costs three credits per company/category the first time the account retrieves it. A normal search can therefore consume up to 15 credits across five companies. Free-plan enrichment is limited to a 14-day trial. The API reference describes free-plan API access while the pricing page lists API Integration under Enterprise; account access and applicable pricing must be verified, not inferred from advertising or the presence of a key.

The adapter honors company-search remaining-quota headers and `Retry-After`. It distinguishes access denial, exhausted credits, rate limits, timeouts and other provider failures. An enrichment failure keeps company results and stops further enrichment for that execution. It makes no automatic retries.

Each HTTP request has a four-second timeout; all optional enrichment shares an eight-second budget. The existing controller caps the overall execution at 15 seconds and the browser at 20 seconds. Responses are limited to 2 MB after decompression, redirects are rejected, and only allowlisted fields are stored or sent to the browser. Raw provider responses and exceptions are never logged or returned.

The application stores limited company/executive snapshots. The operator must ensure their Skrapp agreement permits display to application users, retention and any redistribution. An API key is not a license grant. Automated opt-out/deletion synchronization with the provider is not implemented; required retention and rights handling must be arranged operationally.

## Verification and files

Ordinary tests use explicitly fake responses and an isolated MongoDB test instance, never the configured production database. They do not consume Skrapp credits.

```sh
cd backend
npm test
npm run build

cd ../frontend
npm test
npm run lint
npm run build
```

Backend tests cover the documented Skrapp request formats, lossless IDs, founder evidence, bounded projection, missing credentials, partial results, quotas, timeouts, malformed responses, safe verification reports, JWT protection, MongoDB persistence, replay prevention, and cross-account isolation. Frontend tests cover selecting a relevance match and restoring saved results.

Primary files:

- `backend/src/discovery/providers/skrapp.ts`: provider adapter, limits, projection and bounded API verification.
- `backend/src/discovery/provider.ts`: provider selection and Render verification guard.
- `backend/src/controllers/discoveryController.ts`: existing authenticated execution and saved outcomes.
- `backend/src/app.ts`, `backend/src/index.ts`: safe health report and Render startup verification.
- `backend/src/scripts/verifyDiscovery.ts`: operator CLI using the server environment.
- `backend/tests/skrapp.test.ts`, `backend/tests/live.test.ts`: isolated adapter tests and explicitly enabled live checks.

References:

- [Skrapp API, authentication and errors](https://skrapp.io/api)
- [Company search and quotas](https://skrapp.io/api#company-search)
- [Company enrichment](https://skrapp.io/api#company-enrich)
- [Headcount executive fields](https://skrapp.io/api#cat-headcount)
- [Pricing](https://skrapp.io/pricing)
- [Terms](https://skrapp.io/terms)
- [Render environment variables](https://render.com/docs/configure-environment-variables)
