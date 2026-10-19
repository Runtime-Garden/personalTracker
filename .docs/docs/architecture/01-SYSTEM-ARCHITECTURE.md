# System architecture — modular monolith

## Components

```text
Browser (React/Vite SPA; same-origin cookies)
      |
 HTTPS via NPM/Cloudflare (configured only on approved deployment)
      |
Fastify Node app [web assets + /api/v1 + Better Auth /api/auth]
      |  session + CSRF + validation + RBAC + domain services
      |  tasks / projects / workspace / agile / reminders / admin / AI
      |  provider adapters, rate limits, structured logs
      +-------------------+------------------+
                          |                  |
                   PostgreSQL          outbound AI/OIDC/email
                 [private network]     [controlled hosts]
                          ^
                          |
                Worker (same source/image)
                job leases, notifications,
                reminders, retained AI status
```

Browser talks to one origin where possible. No separate public API subdomain needed. Production DB has no `ports:` host mapping. Public web app on shared `proxy` Docker network. DB on dedicated private network shared with web and worker. Avoid independent API and React proxies unless a tangible reason emerges.

## Suggested layout (code generated later)

```text
apps/
  api/                Fastify routes, bootstrap, auth adapter
  web/                React, routes, components, design tokens
  worker/             Scheduled job consumer, health heartbeat
packages/
  contracts/          Validation schema, API types
  domain/             Business rules and policy ports (optional if justified)
  ui/                 Shareable UI primitives (optional)
database/             Drizzle schema, migrations, import tools
tests/                Integration/contract/E2E tests
infra/                Container and safe deploy configuration
docs/                 Product and operational docs
```

Avoid creating `packages/domain` or `packages/ui` until clear reuse exists; extraction should reduce duplication, not add build overhead.

## Backend boundaries

- **HTTP edge:** session resolution, CSRF/origin, schema validation, rate limits, `requestId`, error mapper.
- **Authorization:** typed action/resource policy, DB-scoped query helpers and explicit membership lookup on every operation.
- **Domain services:** transactions, invariants, audit event production. UI, API endpoints and AI tools call these same services.
- **Repositories:** query builders/Drizzle access, no unscoped `findById` leak for workspace resources.
- **Jobs:** outbox pattern for atomic notification dispatch, leases/idempotency.
- **AI gateway:** adapter registry, capability probing, token/time/cost budgets, prompt safety, tool policy.
- **Storage:** database for metadata; private volume/Object storage for attachments later. Do not expose raw file paths.

## Failure isolation

AI API failure must not take down task CRUD. Email failure must not roll back task creation, but durable notification event must be queued. Worker can be restarted independently. On DB unavailability return degraded health/controlled 503, not unhandled errors. Distinguish liveness vs readiness endpoints and protect detailed health behind auth.

## Security and scale notes

First release is one app instance, one Postgres service and optionally one worker. DB connection pool bounded; use a unique worker lease owner; horizontal scaling later if justified. Prefer SSE for AI streaming, ordinary polling for notifications initially. No separate Redis or message broker by default. Verify reverse-proxy trusted-hop headers to avoid spoofed HTTPS/cookie settings.

## Runtime Garden infrastructure fit

Potential path `/opt/stacks/personal-tracker` (only a proposed path, never assume created). External `proxy` network for web only; `personal-tracker-private` network for DB/web/worker. NPM proxy host forwards to unique service alias and app port. Cloudflare Access is for internal panels if chosen, **not a substitute for app authorization**. Limit origin bypass for admin endpoints and recognize that browser OAuth callback must be publicly reachable to logged-in users under the selected access model.
