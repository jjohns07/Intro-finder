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

## Selected company information (10 November 2026)

Selecting a company loads `POST /api/discovery/company-details` with its saved
search ID, exact company ID, and optional `refresh` boolean. The existing JWT and
account ownership checks apply. Profiles are saved alongside the original search;
they do not replace founders, executives, other matches, or the search outcome.

The primary request is
`GET /api/v3/companies/enrich?id=<internal_id>&categories=firmographics`.
It costs at most one first-retrieval credit. If that category is denied or credits
are exhausted, the adapter tries the free
`GET /api/v3/companies/snapshot?id=<internal_id>` once. A snapshot can supply basic
details after the enrichment trial ends, but cannot supply a description.
Timeouts, rate limits, and malformed enrichment responses do not trigger this
fallback. Neither request is retried automatically.

The response includes `profileSource: firmographics | snapshot`. A successful
snapshot has `status: available` and retains the original category failure in
`enrichmentStatus`, so the UI can show basic details alongside a description
failure. If the snapshot also fails or returns another company ID, the original
failure is retained. `status: unavailable` means a successful category response
explicitly returned `data: null`, not that a request failed.

### Exact field mappings

The current [Skrapp API documentation](https://skrapp.io/api) and its JSON response
examples were retrieved and inspected on 10 November 2026. Search returns
`{ results, meta }`, enrichment returns
`{ id, last_updated_at, total_cost, categories: { firmographics: { cost, data } } }`,
and snapshot returns a flat object with nullable fields. These schemas are distinct.

| Display field | Search `results[]` | `categories.firmographics.data` | Free snapshot |
| --- | --- | --- | --- |
| Company identifier | `internal_id` (string) | response `id` (string) | `id` (string) |
| Company name | `name` | `company_name` | `company_name` |
| Logo | `logo_url` | `company_logo` | `company_logo` |
| Country | `country` | `hq_country` | `hq_country` |
| City | `city` | `hq_city` | `hq_city` |
| State / region | `geo_area` | `hq_state` | `hq_state` |
| Full location | `hq_location` | `hq_full_address`, then `hq_location` | `hq_location` |
| Description | Not supplied | `description`, then `description_short`, then `meta_description` | Not supplied |
| Industry | `industry` | `industry` | `industry` |
| Official website | `website` | `website` | `website` |
| Company domain | `domain` | `domain` | `domain` |
| Employee range | `employee_count_range` | `employees_range` | `employees_range` |
| LinkedIn member count | Not requested | `linkedin_employees_count` | Not supplied |
| Company LinkedIn | `linkedin_url` | `linkedin_url` | `linkedin_url` |
| Legal name | Not supplied | `company_legal_name` | Not supplied |
| Company type | `type` | `type` | `type` |
| Founded | `founded` | `founded_year` | `founded_year` |
| Operating status | `activity_status` | `activity_status` | `activity_status` |

Skrapp's search `domain` is documented as an email domain; it is never used to
invent an official website. Its LinkedIn count is a member count, not an exact
total employee count. `hq_region` contains world-region arrays and is **not** the
state/region field. Display location strings are never parsed to infer countries.
When there is no display location, only supplied city/state/country values are
joined. When profile headquarters fields are present, they replace the whole
search headquarters group, avoiding contradictory old and new locations.

Descriptions are displayed as plain provider text with whitespace trimmed, up to
20,000 characters. The preview is limited to six lines and 560 characters, with a
keyboard-accessible, scrollable expanded view. No products, services or company
facts are generated. Website metadata descriptions are labeled separately.

Skrapp documents additional firmographics fields such as aliases, specialities,
classification codes, office lists, other social profiles, and listing status.
Those fields are outside this display projection; arbitrary response fields are
never exposed. The table describes the fields this application uses, not an
exhaustive claim about every Skrapp category.

### Descriptions and secondary provider research

No secondary provider was introduced. Skrapp explicitly provides descriptions,
and the existing Render live report confirms a description for Stripe. Missing
descriptions remain unavailable, or are marked as a failed request when appropriate.

[People Data Labs Company Enrichment](https://docs.peopledatalabs.com/docs/company-enrichment-api)
was investigated as a possible future fallback. It matches one company to a
company record; its [company schema](https://docs.peopledatalabs.com/docs/company-schema#summary)
documents `summary` as a company description, in lowercase and limited to 1,000
characters. Using it would require a configured PDL credential and company API
access, permitted display/storage, and matching the selected company's domain or
provider identity before displaying the summary with separate attribution. No PDL
key is available in this workspace. The existing legacy PDL adapter is unchanged;
it is not silently used as a fallback for Skrapp requests.

### Freshness and sources

The in-memory profile cache defaults to one hour and 200 projected records. It
honors `no-store`, `no-cache`, shorter `max-age`, and `Age`; no credentials or raw
responses are cached. Skrapp currently documents enrichment and snapshot responses
as `private, no-store`, so those responses are not reused from the provider cache.
Fallback snapshots and failed requests are never inserted into that cache.

Search History retains an explicit application snapshot under the existing
snapshot permission policy, separately from HTTP caching. Opening a saved search
does not automatically make a provider call. The UI shows source, retrieval date,
provider update date when supplied, and cache expiry when applicable. Refresh
bypasses the cache and updates that company's profile within the existing history
record. A failed refresh retains previous details with their original date.

### Observed live evidence and request limit

Reading `https://intro-finder-api.onrender.com/api/health` returned the following
existing report (observed 10 November 2026; no API request was triggered by reading
health):

- At `2026-11-10T02:49:11.914Z`, Stripe's description and industry were available,
  its country matched the reference, and all 17 projected company fields in the
  table above except the identifier were present (the identifier is always required).
- BMW Group returned `quota_exceeded`. Shopify and Safaricom were `not_run` in
  the previous four-company probe.
- At `2026-11-10T02:49:11.470Z`, company search and executive enrichment passed,
  with five executive candidates.

This is evidence of live field availability, not a raw authenticated response or
an independent semantic review of the description. Raw company API responses are
not exposed by health. This session inspected the documented JSON examples and
the existing safe report; it made **zero direct authenticated Skrapp API requests**.
Full live checks across countries and inspection of the actual description text
remain unverified because the local key is unavailable and the observed account
quota was exhausted. Mocked country and description tests are not live verification.

Per the user's four-trial limit, the explicit company verification routine now
checks Stripe and BMW Group with at most **four API requests total** (two searches
and two firmographics calls), no retries or snapshot fallbacks. It stops on quota,
access or rate-limit failures. This routine checks supplied-description presence,
identity/domain, country and industry; it does not claim independent fact checking.
Use `npm run verify:companies` once in the configured backend environment when
ready. Do not run another probe as part of the same four-request allowance.

Startup verification is now disabled unless `SKRAPP_VERIFY_ON_STARTUP=true` is
explicitly set. If enabled, startup runs **one** probe: company profiles when
`SKRAPP_VERIFY_COMPANY_INFORMATION=true`, otherwise the two-request executive
probe. Keep `SKRAPP_VERIFY_ON_STARTUP=false` in Render while changing keys or
deploying to avoid automatic requests from the older deployed build. Ordinary user
searches have their separate documented request/credit costs.

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
SKRAPP_VERIFY_ON_STARTUP=false
```

Missing credentials are nonfatal during local development. Authenticated searches return a saved `provider_unavailable` outcome without contacting Skrapp. No fixture or synthetic production results are substituted. The backend's normal JWT and database configuration requirements still apply.

Use Node 22.13 or newer. Render root directory: `backend`; build: `npm ci && npm run build`; start: `npm start`. Keep the existing MongoDB and JWT settings. Save and deploy after changing environment values. The frontend continues using its existing API service; `VITE_API_BASE_URL` points to the backend's `/api` base. Never put a provider key in a `VITE_*` variable.

## Real API verification on Render

After the backend starts on Render (`RENDER=true`), the configured Skrapp adapter runs a bounded verification only when `SKRAPP_VERIFY_ON_STARTUP=true`. It runs after the server begins listening and does not make startup depend on provider availability. When `SKRAPP_VERIFY_COMPANY_INFORMATION=true`, the four-request company probe described above runs instead of the executive probe.

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

Current verification, 10 November 2026: **55 backend tests passed, two live tests
skipped; 29 frontend tests passed.** Both production builds and frontend lint
passed. The backend suite was run with Node 22.16 and
`--experimental-test-isolation=none` so individual results and skipped live tests
were visible. Database integration used MongoDB 4.4.29 and a temporary OpenSSL
compatibility library under `/tmp` because this host lacks AVX. The initial
sandboxed database run could not open local ports; the isolated rerun with local
port access passed. Production database and provider credentials were not used.

Coverage includes documented Stripe/Swapcard JSON examples, synthetic location
formats for Nigeria/Canada/Japan/Germany, exact company IDs, malformed and missing
fields, description precedence, snapshot fallback on quota/access errors, cache
expiry/directives, refresh recovery, persisted fallback provenance, JWT and account
isolation, concurrent requests, founder/executive results, Search History restore,
long descriptions, and the four-request verification cap. These are fixtures and
regression tests, not fresh live checks of those companies.

A headless Chromium check against the production frontend passed at 1440, 768,
390 and 320 pixels: no horizontal overflow, two-column/one-column layout,
six-visible-line description preview, keyboard-accessible expanded text, saved
history restoration without enrichment, snapshot failure feedback, refresh
recovery and retained executive candidates. Every external request was intercepted
with explicit UI test fixtures. The browser and its two missing libraries were
kept under `/tmp`; no project dependencies or system packages were changed.

Files changed for this enhancement:

- `backend/src/discovery/providers/skrapp.ts`, `skrappCompany.ts`: free snapshot
  fallback, separate response projection and four-request verification.
- `backend/src/discovery/types.ts`, `backend/src/services/history.ts`: source and
  partial-failure fields, snapshot validation and persistence.
- `backend/src/discovery/provider.ts`, `backend/src/index.ts`,
  `backend/.env.example`: explicit startup opt-in and one verification probe.
- `frontend/src/components/discovery/CompanyInformation.tsx`,
  `DiscoveryResults.tsx`: source/failure labels, country in selection cards,
  bounded descriptions and source-consistent headquarters.
- `frontend/src/services/discovery.ts`, `frontend/src/styles/discovery.css`:
  response validation, source-aware merging, focus styling and source badges.
- `backend/tests/companyDetails.test.ts`, `backend/tests/discovery.test.ts`,
  `backend/tests/skrapp.test.ts`, `backend/tests/live.test.ts`,
  `frontend/src/tests/companyInformation.test.tsx`: verification and regression coverage.
- `DISCOVERY.md`: field mappings, secondary-provider research, current checks and
  live-verification limits.

Local verification on 7 November 2026: 33 backend tests passed and the live test was skipped; 14 frontend tests passed with one worker and a 20-second test timeout. Both production builds and frontend lint passed. This host lacks AVX, so database integration tests used the existing version override with MongoDB 4.4.29 and a temporary OpenSSL compatibility library instead of the default MongoDB 7.0.24. No production database settings were changed. These results do not establish successful authenticated Skrapp access on Render.

Live verification was subsequently observed on Render for commit 4378178. The backend reported a successful real company search and executive enrichment at 2026-11-07T19:11:12.560Z, returning five executive candidates. Its health response showed provider skrapp, configured true, verification status passed, companySearch passed, executiveEnrichment passed, and database status connected. This is actual provider access evidence, separate from the mocked local tests; it does not establish exhaustive company/founder coverage or relationship data.

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
