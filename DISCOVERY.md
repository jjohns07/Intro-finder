# Company and founder discovery

## Provider decision (7 November 2026)

Selected **People Data Labs (PDL)**, accessed through its documented Company Search and Person Search APIs. The existing Express/Mongoose backend and React frontend need no additional runtime provider SDK: Node 22's `fetch` supports the API directly. Test dependencies are development-only.

PDL offers company profiles and professional employment histories with persistent company IDs, titles, dates, and sometimes contributing-source counts. These fields allow a candidate's role to be tied to a specific company, including historical employment. Coverage is limited to PDL's dataset, field bundles, and account entitlements. It is not an authoritative register of founders and does not cover every private or newly created company.

Wikidata was also considered: its structured data is CC0, public and free, but coverage of smaller private companies and professional employment histories is uneven. PDL is the better first adapter for this product's company/decision-maker search. No platform scraping, LinkedIn login, or X API is used. Profile URLs supplied by PDL are references only; the backend never fetches them.

**Access and pricing:** PDL requires an account and API key. Both Search APIs charge per returned record, not per request. At review, the public pricing page advertised a free testing tier of up to 100 credits/month and paid self-service starting at $98/month. Those advertisements do not establish Company Search or Person Search entitlement for this application. Confirm the endpoint/field entitlements, search credits, and applicable price in the account dashboard or agreement. No subscription or credentials were found in this workspace.

**Limits:** both Search API references document a default of 10 requests/minute. Actual limits are per key and endpoint, visible in response headers and the account dashboard. The adapter defaults to 10 per endpoint per rolling minute, honors `Retry-After` and `x-ratelimit-reset`, and stops when `x-ratelimit-remaining.minute` is zero. It does not retry automatically. A search retrieves at most five companies and five person records per company: up to five company and 25 person credits, one or two company requests, and up to five person requests. Duplicate executions with the same idempotency key do not spend more credits. Prefix fallback only runs after an exact-name search returns no results. Results are ordered by the provider's completeness, not an invented match score. No pagination or fuzzy name matching is implemented.

**Permitted use:** PDL is licensed data, not an open-data grant. Its sourcing documentation describes public and proprietary sources and customer-use restrictions; this does not establish unrestricted redistribution rights. The operator must ensure their agreement permits Intro Finder's authenticated display and saved result snapshots, retention period, and handling of opt-outs. `PDL_ALLOW_RESULT_STORAGE=true` is an explicit deployment assertion of those rights, not a license grant. Until then the adapter makes no calls. The projection excludes email, telephone, addresses, arbitrary metadata and raw responses. The documented acceptable-use restrictions include eligibility decisions and sensitive/discriminatory profiling; this implementation performs professional company discovery only. Existing stored snapshots are not automatically synchronized with PDL deletion/opt-out feeds; any required retention/rights workflow must be arranged before enabling production storage.

Reviewed references:

- [Company Search reference](https://docs.peopledatalabs.com/docs/reference-company-search-api)
- [Company query parameters](https://docs.peopledatalabs.com/docs/input-parameters-company-search-api)
- [Person Search reference](https://docs.peopledatalabs.com/docs/reference-person-search-api)
- [Person schema and employment fields](https://docs.peopledatalabs.com/docs/person-schema)
- [Usage limits and response headers](https://docs.peopledatalabs.com/docs/usage-limits)
- [Errors/status codes](https://docs.peopledatalabs.com/docs/errors)
- [Pricing](https://www.peopledatalabs.com/pricing)
- [Sources, compliance and permitted-use restrictions](https://docs.peopledatalabs.com/docs/data-sources)
- [Acceptable-use policy](https://privacy.peopledatalabs.com/policies?name=acceptable-data-use-policy)
- [Wikidata access and CC0 licensing](https://www.wikidata.org/wiki/Wikidata:Data_access)

## Render configuration

On the **backend Render web service**, open **Environment** and set:

```dotenv
DISCOVERY_PROVIDER=pdl
PDL_API_KEY=<your PDL secret API key>
PDL_ALLOW_RESULT_STORAGE=true
PDL_PERSON_SEARCH_ENABLED=true
PDL_REQUESTS_PER_MINUTE=10
```

Set the storage flag only after confirming the rights above. Enable Person Search only when the key has that endpoint and sufficient credits; leave it `false` for company-only discovery. Never set these values as `VITE_*` variables or in frontend source. Keep the existing `MONGODB_URI`, `JWT_SECRET` (at least 32 characters), `JWT_EXPIRES_IN`, and Render `PORT` configuration. Use Node 22 or newer. Save and redeploy the backend. Backend build/start commands remain `npm ci && npm run build` and `npm start`, with `backend` as the root directory.

The frontend's `VITE_API_BASE_URL` must point to the backend's `/api` base (the existing Render URL remains the default). No provider key belongs on the frontend. Frontend build command: `npm ci && npm run build`, root directory `frontend`, publish directory `dist`.

The local limiter is per backend process. For multiple Render instances or a key shared with other applications, divide the rate allowance or replace it with a shared limiter before scaling. The provider's own 429 responses remain authoritative. No environment settings or Render deployment were changed by this implementation.

## Endpoint and response

`POST /api/discovery/search` uses the existing JWT middleware and requires a connected account database. It requires:

```http
Authorization: Bearer <session JWT>
Idempotency-Key: <unique 8–128 character key; letters, digits, underscore or dash>
Content-Type: application/json

{"companyName":"People Data Labs"}
```

Company names are validated (2–160 characters, letter/number required, no control/format characters), Unicode NFKC normalized, whitespace collapsed and lowercased for provider lookup. The provider receives structured Elasticsearch term/prefix queries, never interpolated SQL. The request body is limited to 8 KB. User ownership, outcomes and result snapshots cannot be supplied by the client.

The response is a saved-search object: `id`, `originalQuery`, `normalizedCompanyName`, `status`, `outcome`, `message`, `matches`, `totalMatches`, `matchMode`, `provenance`, and timestamps. Each match contains its company, people with evidence, `peopleStatus`, warnings, `connectionStatus: "unavailable"`, `paths: null` and empty connections. `result` remains populated for a single exact company for compatibility with earlier saved searches. For multiple or prefix matches, `result` and the summary `company` are null; the user must choose from `matches`. Selection is local to the saved response and creates no request or history record. Truncated company/person results are labeled.

| Outcome | HTTP on first execution | Meaning |
| --- | --- | --- |
| `success` | 201 | Single exact company; people may be absent or unavailable |
| `ambiguous` | 201 | Multiple companies, or a prefix-only match requiring review |
| `no_matches` | 201 | Completed query with no company matches in this source |
| `invalid_query` | 400 | Invalid company input, recorded if the execution key is valid |
| `provider_unavailable` | 503 | Missing provider/key or storage authorization configuration |
| `rate_limited` | 429 | Local/provider request limit; includes `Retry-After` |
| `provider_timeout` | 504 | Company lookup or overall execution timed out |
| `provider_access_denied` | 503 | Provider credentials or endpoint entitlement rejected |
| `quota_exceeded` | 503 | Provider credits exhausted |
| `provider_error` | 502 | Network failure, provider failure or malformed response |

A completed duplicate returns 200 for completed searches or the same failure HTTP status, with the same saved record. An in-progress duplicate returns 202. Reusing a key with different input returns 409. JWT failures return 401; unavailable account/database services return 503. A delete racing with execution is never undone by the final write.

All accepted authenticated execution attempts, including invalid company input and provider failures, have one Search History record. Client-side validation, unauthenticated requests, invalid/missing idempotency keys, malformed/oversized JSON, and database outages cannot create an executable discovery attempt. The backend does not call a provider if it cannot first create history. The browser reuses its key after uncertain network failures and creates a new key after a confirmed completed outcome. Clearing the UI does not cancel a server-side attempt already recorded; its final outcome remains in history.

Existing `GET /api/history`, `GET /api/history/:id` and `DELETE /api/history/:id` continue to work, including restoring the new match arrays. Old single-result snapshots remain readable. New schema fields are additive; no destructive migration is needed. The existing unique `(user, requestId)` index is initialized at server startup.

## Evidence and reliability

A founder candidate needs an explicit `founder`/`co-founder` role segment and the exact PDL company ID on the same employment record (or matching current-job fields). Merely mentioning a company, a founder at a different employer, a derived `owner` level, or a “founder's associate” title does not qualify. Elasticsearch array matches are verified again entry by entry after retrieval.

Senior title levels can support a decision-maker candidate, but never prove founder status. Employment end dates indicate historical affiliation. A primary/current job field indicates current affiliation **as reported by PDL**; undated non-primary employment is marked unknown. Available start/end/last-seen dates and source counts are retained. All candidates carry the qualitative indicator `provider-supported`, with the evidence rule and a limitation: source documents were not independently checked and the data may be outdated. Source counts are provider claims, not probability scores or proof of independent corroboration.

Each HTTP provider request is capped at four seconds; optional people lookup has a shared five-second budget. Overall execution is capped at 15 seconds; the browser timeout is 20 seconds. People timeouts/errors preserve company matches. Responses are bounded to 2 MB decompressed and validated before projection. Redirects are rejected so the API key cannot be forwarded to another host. Raw upstream errors are never sent to clients. URL fields allow only HTTP(S) without embedded credentials.

There is no relationship-data provider. No introduction paths, X-follow-derived trust, synthetic production companies, or fabricated people are generated. The existing introduction-path display contract is retained for a future relationship source.

## Verification

```sh
cd backend
npm ci
npm test
npm run build

cd ../frontend
npm ci
npm test
npm run lint
npm run build
```

Backend tests use Node's test runner and an ephemeral real MongoDB via `mongodb-memory-server` (MongoDB 7.0.24). The first run downloads the test binary into `/tmp/intro-finder-mongodb`; it never connects to a configured production database. HTTP integration tests exercise JWT protection, persistent outcomes, cross-account isolation, duplicate and concurrent execution keys, saved ambiguity and concurrent deletion. Adapter tests inject clearly labeled test responses for evidence, partial results, empty results, invalid configuration, rate limits, timeouts and malformed data. Frontend tests exercise DOM behavior with Vitest/jsdom, including authenticated requests, loading, errors, no results, ambiguous selection, source evidence, Strict Mode and retry identity.

After configuring a real PDL account, run from `backend`:

```sh
npm run test:live
```

This explicitly enabled test searches `people data labs` using the real adapter and consumes credits (including optional person searches if enabled). It is skipped without a configured provider; ordinary `npm test` does not make paid provider calls. A skipped test is **not** a live success. This workspace currently has no PDL credentials, so live search and actual account coverage/entitlements remain unverified.
