# Technology selection and architecture decision records

All versions should be stable **at implementation time**, compatible with a supported Node LTS; pin exact dependencies and lockfile. Verify dependency license/security and avoid blindly assuming a historical version is current. Official references listed in `docs/architecture/03-OFFICIAL-REFERENCES.md`.

## ADR-001 — Node.js + TypeScript, no Go API for v1

**Decision:** unify API, AI integration and frontend contracts in TypeScript. **Alternative:** Go/Fiber/Chi backend. **Benefit:** smaller cognitive and deployment footprint for initial full-stack product. **Risk:** blocking CPU work, memory/GC, package churn. **Mitigation:** structured async IO, bounded concurrency, profiling, worker split as required. Revisit Go only with measured bottleneck or operational argument.

## ADR-002 — Fastify and React/Vite (not Next.js)

**Decision:** private app prioritizes interactivity over public SEO. Fastify for API, Vite-built React for UI and same-origin serving. **Trade-off:** no built-in SSR/Server Components. Avoid extra SSR infra unless public marketing pages become a requirement.

## ADR-003 — PostgreSQL with Drizzle

**Decision:** PostgreSQL transactions/FKs + typed query builder and versioned migrations. **Alternative:** SQLite for smaller one-person installation; rejected as initial default because multiuser concurrency/jobs/tenant constraints and migration safety matter. **Risk:** DB operations and backups. **Mitigation:** Docker-managed private DB, logical backups, restore drills and indexed queries.

## ADR-004 — Better Auth + verified plugins

**Decision:** use maintained authentication library for sessions, Google/GitHub/Microsoft and organization capabilities where appropriate. **Alternative:** custom OAuth or standalone identity server; unnecessary initial complexity/risk. Better Auth organization's default roles may not match application RBAC; keep **app policy** explicit. Fastify integration is documented but must be tested in exact installed versions. Never rely on email-only account matching.

## ADR-005 — Extensible model provider registry

**Decision:** AI SDK abstraction and registry of audited providers; provider-specific capability matrix. **Alternative:** call each model REST API manually; expensive to maintain. **Trade-off:** SDK version changes and uneven tool calling. **Mitigation:** adapter integration tests, timeout, unsupported capability response, mock provider, pinned libraries.

## ADR-006 — Postgres worker without Redis

**Decision:** durable jobs for reminders/email/AI status use Postgres. **Alternatives:** Redis/BullMQ or managed event bus; useful only at higher volume. **Trade-off:** job lease correctness; accept with transactional tests and safe retries.

## ADR-007 — Integrated system-admin route

**Decision:** system-admin settings inside main app shell and existing session. **Alternative:** separate admin frontend with separate auth; adds maintenance. **Security:** separate server capability and optional step-up for dangerous changes.

## ADR-008 — Brand reuse, not marketing site clone

**Decision:** keep v2 logo and core tokens; design app-specific dense-but-readable productivity UI, mobile-first. **Trade-off:** brand design brief focuses on editorial site; reuse visual identity not page templates.

## ADR-009 — No invisible admin content access

**Decision:** operator privilege manages instance operations but not personal/team private task content. **Trade-off:** troubleshooting requires redacted metadata, user consent and explicit secure support flows (future).

## Future ADRs to record

Exact auth membership schema ownership, encrypted key rotation policy, PWA strategy, external file storage, optional email delivery provider, calendar sync, real-time collaboration and any licensing/public release decision.
