# Introduction path discovery

## Availability and evidence

The repository already contained a private CSV network importer, MongoDB graph
models, candidate identity confirmations and discovery UI. This implementation
completes their limit reporting, relationship provenance, freshness checks and
contact selection, and expands their regression coverage.

No genuine relationship dataset, authorised social connection integration or
production database credentials were available in this workspace. LinkedIn and
X network integrations remain **unavailable**. Skrapp company and executive
records are not relationship records. Its current headcount response supplies
executive names and titles, without individual person IDs or profile URLs; the
adapter's candidate ID is a hash of company ID, name and title, not a verified
person identifier. Matching a name cannot establish a connection.

**Real-world introduction discovery has not been verified.** Tests use explicitly
labelled synthetic records in isolated MongoDB and mocked provider responses.
They never populate application users' networks or return fixture discoveries.
No LinkedIn/X scraping, profile fetching, or bypass of platform access is used.

## Using your own data

1. Open **Your network** (`/network`) and download the empty CSV template.
2. Supply only relationships you are authorised to use. Preview validates the
   whole file without writing it. Review the contacts and explicitly confirm the
   import. A new file replaces your network and clears identity confirmations;
   importing the identical file again does not create duplicates.
3. Search for a company and select the correct company result.
4. Choose **Match to your network** for a founder/executive. Search or page
   through your imported contacts, inspect the profile reference, write the
   identity evidence and explicitly confirm the person. This confirmation is
   separate from confirmation of each relationship.
5. Inspect the returned chains, each person's details and each edge's evidence.
   **Refresh introduction paths** recomputes from the current network without
   calling Skrapp. Saved search detail also recomputes paths on read.

A normal LinkedIn first-degree export, if the user is authorised to use it,
can provide only the user's own direct contacts. It must be converted into this
schema and supplemented with genuine evidence and observation dates. It does
not establish who those contacts know. Multi-intermediary paths require supplied
evidence for **every** additional edge; the engine does not infer them from
employment, profile URLs, matching names or social follows.

## CSV contract

UTF-8 CSV with this required header (order may vary):

```csv
source_id,source_name,source_profile_url,destination_id,destination_name,destination_profile_url,relationship_type,verification_status,evidence,observed_at
```

| Field | Validation |
| --- | --- |
| `source_id`, `destination_id` | Stable local identifiers, 1–80 letters/digits/`.`/`:`/`-`/`_`, beginning with a letter or digit. Reserve `me` for the authenticated account. |
| `source_name`, `destination_name` | Required for contacts, at most 200 characters; leave blank for `me`. Repeated IDs must have identical details. |
| Profile URL fields | May be empty; otherwise HTTPS without credentials, fragments or query strings. One URL cannot identify two contact IDs. URLs are not fetched. Leave blank for `me`. |
| `relationship_type` | `direct_connection`, `user_confirmed`, `follows`, or `mutual_follow`. Each row records only its stated direction. |
| `verification_status` | `unverified` or `user_confirmed`. CSV cannot claim independent/provider verification. |
| `evidence` | 10–500 characters of plain text describing the supporting observation. Required even for ineligible relationship types. |
| `observed_at` | Valid non-future `YYYY-MM-DD`; use the genuine observation date, not the upload date. |
| Optional `source_title`, `destination_title` | At most 300 characters; blank for `me`. |

Maximum 1,000,000 UTF-8 bytes, 1,000 relationships and 1,500 contacts. At least
one edge must reference `me`. Quoted commas, escaped quotes, BOM and CRLF are
supported. Unknown/duplicate headers, inconsistent columns, control characters,
self-edges, duplicate `(source, destination, type)` records, conflicting contact
details and invalid dates are rejected before any network is published.

Every relationship is directed. Add the reverse direction only with supporting
evidence; mutual social following still does not qualify as a trusted connection.

| Relationship | Eligible for introduction paths |
| --- | --- |
| `direct_connection` | Only when explicitly `user_confirmed` and evidence is at most 365 days old. |
| `user_confirmed` | Same verification and freshness requirements. Represents a personal relationship the importer confirms. |
| `follows` | Never. A follow does not establish an introduction relationship. |
| `mutual_follow` | Never, including when the follow observation is confirmed. |

User confirmation is an assertion backed by the supplied statement, not
independent verification of trust or willingness to introduce.

## Persistence and privacy

`backend/src/models/Network.ts` defines:

- `NetworkPerson`: owner, import ID, local person ID, name, optional title/profile
  reference and creation/update timestamps. Unique `(owner, importId, localId)`.
- `NetworkRelationship`: owner, import ID, source/destination local person IDs,
  relationship type, data source, verification status, evidence statement,
  observation date, import date, CSV record number and creation/update timestamps.
  Unique `(owner, importId, from, to, type)`.
- `CandidateIdentity`: owner/import/provider/company/candidate scope, imported
  person ID, confirmation evidence, verification and timestamps. The full scope
  is uniquely indexed; confirmations do not cross users, imports or providers.
- `NetworkState`: uniquely indexed owner, active import pointer, revision, file
  digest and counts. Complete imports are staged before an atomic revision-checked
  pointer switch. Failed writes never publish partial graphs, including on
  standalone MongoDB. Old imports become inaccessible when the pointer changes.

The reserved `me` vertex is resolved to the verified JWT account, using the
server-loaded account name. Ownership is never accepted from CSV or request
bodies. Every graph/contact/identity query includes the owner and active import.
Network documents and private paths are not copied into durable company search
snapshots. Replacing/deleting a network removes paths from subsequent saved-search
reads. Already downloaded browser responses cannot be recalled.

MongoDB queries use the owner/import index prefixes, bounded result limits and
1.5-second read limits. Graph reads reject over-limit collections and dangling
relationships cannot produce paths. Network endpoints require JWT authentication,
disable response caching, validate revisions on mutations, bound request bodies
and allow at most 60 requests/account/minute per process. Multiple application
instances need a shared rate limiter for a global quota.

## Shortest-path algorithm

`backend/src/network/shortestPaths.ts` performs directed, unweighted breadth-first
search from `me`. It filters out follows, mutual follows, unconfirmed evidence,
missing statements, and stale/future observation dates. When multiple eligible
records describe the same directed pair, the newest evidence is selected, with
a deterministic record-ID tie break. Distinct relationship types remain stored
and are returned accurately; they are not converted to a generic trust score.

BFS records minimum distances and all predecessors at the same shortest
distance. Backtracking this acyclic predecessor graph yields distinct shortest
person chains for each target, even when the original graph has cycles. It stops
after three returned alternatives plus one additional path to detect truncation.
Limits are four edges (three intermediaries), five targets/company, 1,000 edges
and 10,000 traversal operations. Search supports up to five company matches from
the existing provider flow. Traversal is O(V + E), followed by bounded path
enumeration. Excess input is rejected rather than returning a potentially longer
route from a truncated edge set.

The report distinguishes traversal limits from the cap on alternatives. A cap
for one founder cannot change an exhausted, unreachable sibling's status from
`no_path` to `search_limited`. Cycles back into visited vertices at the depth
boundary do not falsely indicate unexplored paths. Once every selected target
has been reached, BFS completes their predecessor level and stops.

## API and UI contract

All routes below are under `/api` and require `Authorization: Bearer <JWT>`.

| Endpoint | Purpose |
| --- | --- |
| `GET /network` | Owned network/import status and revision. |
| `POST /network/preview` | Validate a `text/csv` body; returns counts and up to five preview contacts; no writes. |
| `POST /network/import` | `text/csv`, `X-Network-Revision` and `X-Import-Confirmed: true`; atomically replace the network. |
| `GET /network/people?q=...&page=1` | Search owned contacts; 50/page. |
| `DELETE /network` | JSON `{ revision }`; remove the active network. |
| `POST /network/candidate-links` | JSON `{ searchId, companyId, candidateId, personId, revision, statement, confirmed: true }`. |
| `DELETE /network/candidate-links` | JSON `{ searchId, companyId, candidateId, revision }`; remove the identity match. |
| `POST /discovery/search` | Existing `{ companyName }` and `Idempotency-Key`; company/candidates plus computed introduction report. |
| `POST /discovery/paths` | JSON `{ searchId, companyId }`; recompute paths without provider requests. |

Each path returns ordered person IDs, ordered connection IDs, target/start IDs,
`steps`, `intermediateCount`, latest relationship `updatedAt` and
`oldestEvidenceAt`. Every connection returns its relationship type and evidence:
`source`, `verification`, `statement`, `observedAt`, `importedAt`, `updatedAt`,
`recordId`, `importId` and CSV `recordNumber` (including the header). People in
the path have inspectable details and optional profile references.

The introduction report includes the check timestamp, network availability and
revision, network update time, evidence age policy, bounds, exclusion counts,
specific limit reasons, and individual candidate statuses/identity evidence.
Provider company/candidate data remains available when there is no path.

| State | Where reported |
| --- | --- |
| No matching company | Search `outcome: no_matches`, no company matches. |
| Founder/executive not identified | `introduction.status: candidate_not_identified`; existing `peopleStatus` also distinguishes disabled enrichment and no candidates. |
| Candidate provider failure | `candidate_provider_error`, with the existing precise `peopleStatus`/source notes. |
| No network imported | `networkStatus: not_imported`; `status: network_not_imported` when candidates exist. |
| Social integration unavailable | Independent `socialIntegration: unavailable`, even with usable CSV paths. |
| Candidate identity unconfirmed | `identity_unresolved`, globally and/or per candidate. |
| Exhausted graph without a path | `no_path`; company and candidate remain visible. |
| Search bounds reached | `search_limited` for unresolved paths; `limits` identifies the reason. `pathsLimited` flags capped alternatives per candidate. |
| Network read failed/changed during traversal | `network_error`, no private paths; company and candidates retained. |
| Company provider failed | Existing discovery provider error outcome and HTTP status, including rate limits, timeouts, denied access and exhausted credits. |

`DiscoveryResults.tsx` shows visual chains, relationship labels, step/intermediary
counts, per-edge evidence and CSV record numbers, observation/import/update dates,
and per-person inspection. It hides imported paths with incomplete evidence,
ineligible edge types, invalid dates, unconfirmed targets or excess depth.
Freshness is checked against the server's reported check time. Candidate statuses
remain visible when other candidates have available paths. Contact selection is
paginated and changing contacts clears the previous evidence and confirmation.

## Verification and remaining requirements

Regression coverage includes direct paths, one and three intermediaries,
alternative shortest paths, exclusion of longer routes, cyclic/reverse/duplicate
edges, multiple candidates, missing data, confirmation requirements, stale and
follow evidence, invalid/duplicate CSVs, concurrent imports, failed database
writes, replacement/deletion, and account isolation even with identical local
contact IDs. Fixtures remain confined to tests.

Verified on 10 November 2026: **75 backend tests passed, two live provider tests
skipped; 37 frontend tests passed. Both production builds and frontend lint
passed.** Backend tests used Node 22.16 with
`--experimental-test-isolation=none`, an explicit MongoDB 4.4.29 Ubuntu binary
and its OpenSSL compatibility library under `/tmp`. This host lacks AVX; the
default MongoDB 7 binary cannot run here. Local port access was required for the
isolated MongoDB instance. No application dependency versions, system packages
or production database settings were changed. The full regression run passed
after allowing freshly computed network-check timestamps in history assertions;
provider snapshots are still compared exactly.

Run backend and frontend checks:

```sh
cd backend
npm test
npm run build
cd ../frontend
npm test -- --maxWorkers=1 --testTimeout=20000
npm run lint
npm run build
```

CSV discovery needs the existing `MONGODB_URI`, JWT configuration and genuine
authorised relationship records, but no new external API credentials. Company
and executive lookup still needs the configured Skrapp API key and executive
enrichment access/credits. Automatic social imports would additionally require
an implemented approved integration, provider-granted connection-reading access
and appropriate user consent/tokens. None of that access is assumed from the
presence of a Skrapp key. Live validation still requires a consenting user's
genuine network, an evidenced candidate identity and inspection of every returned
edge. No production deployment or real relationship verification was performed.
