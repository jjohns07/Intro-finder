# Intro Finder implementation plan

## Goal

Build the Intro Finder discovery engine around a completely free, local-first development and testing workflow. The project should remain fully functional without paid API access, while keeping the data-source layer modular and ready for an approved provider when the product has explicit permission.

## Core constraints

1. Do not integrate paid X API endpoints or any paid social-platform request flow.
2. Do not make live requests to X, LinkedIn, or any other external social platform during development or testing.
3. Keep social-platform integration behind a clearly defined adapter boundary so it can be enabled later with an approved source.
4. Design the core discovery engine independently of X, LinkedIn, and all platform-specific assumptions.
5. Use clearly labelled local fixtures for engine tests and demos, and ensure they are never presented as real user connections.
6. Define typed data structures for people, companies, connections, and introduction paths.
7. Keep real platform integration disabled until a permitted data source is available.
8. Document and enforce the limitation to avoid scraping, bypassing access controls, or relying on unapproved data ingestion.
9. Do not add unnecessary dependencies or modify the existing authentication flow.

## Architecture approach

### 1. Discovery engine remains platform-agnostic

The engine should consume normalized records rather than raw X or LinkedIn payloads.

- Input: normalized company name, optional filters, and connection graph data.
- Processing: rank reachable paths, score warm introductions, and identify likely next steps.
- Output: a list of introduction paths with confidence and explanation text.

The engine should operate on domain models only, not on platform-specific objects.

### 2. Social adapters stay modular

Add a small adapter interface with one implementation for local fixtures and a placeholder for an approved provider.

- Local fixture adapter: used for offline development and verification.
- Approved-source adapter: disabled by default and only enabled after policy and access approval.
- Platform-specific integrations: deferred; no external requests are allowed in this phase.

### 3. Local fixtures are explicitly labelled and isolated

Fixtures must be easy to identify in logs, tests, and UI metadata.

- Use a `source: 'local-fixture'` flag in typed records.
- Add clear warnings such as: "Synthetic fixture for engine testing only; not a real connection."
- Keep fixture data outside any production or user-data pipeline.

### 4. Domain model

The project should define canonical types for the core graph and path discovery layer.

- Person
- Company
- Connection
- IntroductionPath
- DiscoveryRequest
- DiscoveryResult

A concrete source file in the backend discovery layer holds these interfaces and fixture data for TypeScript validation. See the typed definitions in `backend/src/discovery/types.ts` and `backend/src/discovery/localFixtures.ts`.

## Delivery phases

### Phase 1: Free and safe foundation

- Keep authentication and the existing frontend flow unchanged.
- Add discovery engine typings and local fixture dataset.
- Validate TypeScript builds without external dependencies.
- Document the limitation that real platform integration remains disabled.

### Phase 2: Engine-only logic

- Implement path-ranking and warm-intro scoring independent of any social platform.
- Test using local fixtures instead of live data.
- Ensure output explains whether a result is from a fixture or an approved source.

### Phase 3: Approved data source only

- Enable a provider only after explicit permission and policy review.
- Add a dedicated adapter under a modular integration boundary.
- Keep disabled-by-default safeguards in place.

## Restrictions and guardrails

- No scraping or evasion of platform access controls.
- No reliance on paid tiers or API keys during implementation.
- No changes to the current auth system, user flows, or session handling.
- No added dependencies unless absolutely required for the local-only discovery architecture.

## Acceptance checklist

- [ ] No paid X API integration has been added.
- [ ] Social data integration is modular and disabled by default.
- [ ] Core discovery logic is decoupled from platform-specific code.
- [ ] Local fixtures are clearly labelled and never described as live user connections.
- [ ] Typed domain models exist for people, companies, connections, and paths.
- [ ] Build passes with the current TypeScript configuration.

## Notes

This plan intentionally delays platform integration until an approved, lawful data source is available. The implementation is intentionally conservative: free local development first, then a controlled provider integration only when permitted.
