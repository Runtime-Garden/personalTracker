> **v1.0.0-rc.1 (2026-10-19): source release candidate, not production approved.**
> New: passkeys, explicit OAuth account linking, read-only AI streaming, encrypted backup templates, corrected worker outbound networking. See `PHASE_COVERAGE.md`, `RELEASE_STATUS.md`, `TEST_REPORT.md` and `ops/V1_RELEASE_GATES.md`.

# Personal Tracker · by Runtime Garden

**v0.3.0 — B–E development snapshot (not a production release)**

A personal + team productivity tracker developed as a modular TypeScript application. The existing v0.1.0 Engineering Preview is preserved in `legacy-reference/` for comparison. This package is a **new implementation** using React/Vite, Fastify/TypeScript and PostgreSQL with versioned SQL migrations and a Drizzle schema. It does not overwrite any currently deployed Runtime Garden project.

> **Release status:** Phase A source plus selected B–E modules implemented, static/domain tests passed; dependency installation, real API/database execution, browser E2E, Docker builds, live OAuth/AI providers, and production deployment **were not performed** in this offline authoring environment. See `RELEASE_STATUS.md` and `PHASE_COVERAGE.md`. Do not expose publicly until `ops/PHASE_A_VERIFICATION.md` passes.

## Included capabilities (development, not fully verified)

- Setup-only bootstrap admin, password/session auth, optional Google and GitHub sign-in, invitation-based registration, email verification, password reset, TOTP MFA, recovery codes and session revocation
- Personal workspace per account, team workspace membership, invite/accept, role check on scoped operations
- Tasks, priorities, project assignment, optimistic version checking, task comments, archiving, labels, subtasks, dependency cycles, recurrence and watchers
- Projects, todos and private/shared todo lists, reminders, notifications, My Day, sprint assignment, Kanban and focus sessions
- AI connections, usage records, read-only Q&A and explicit approval of bounded AI-proposed mutations (not a full tool-calling agent platform)
- Integrated system administration (signup policy, user activation, audit event list, health, worker status and AI usage endpoints)
- Responsive React UI with Runtime Garden v2 assets and a PostgreSQL reminder worker
- Versioned, checksummed Postgres migrations and a non-destructive, operator-controlled SQLite importer

## Repository structure

```text
apps/api/src/      Fastify API, auth, workflow, AI, worker, Drizzle schema
apps/web/src/      React + TypeScript UI
apps/web/public/   Runtime Garden v2 brand assets
db/migrations/     Ordered PostgreSQL migration SQL
ops/               Migration CLI, importer, backup and deployment instructions
tests/             Source/contract/domain tests
legacy-reference/  Original v0.1.0 code and its original integration test
.docs/             Original OpenCode blueprint and brand documentation
```

## Local development

Prerequisites: Node.js 22.16+, npm 10+, Docker with Compose (for PostgreSQL).

```bash
cp .env.example .env
# Set a secure SETUP_TOKEN of at least 32 characters, and APP_ENCRYPTION_KEY of 64 hex chars.
# DATABASE_URL in .env.example matches the local dev-only Postgres password.
docker compose -f compose.dev-db.yaml up -d
npm install
set -a; . ./.env; set +a
npm run db:migrate
npm run dev:api     # terminal 1, API :3000
npm run dev:web     # terminal 2, UI http://127.0.0.1:5173
npm run dev:worker  # terminal 3, reminder delivery
```

**For the Vite development browser on port 5173**, requests are proxied to the backend on port 3000. Development API origin checks use `APP_URL` when an `Origin` header is present. Set `APP_URL=http://127.0.0.1:5173` in `.env` for Vite, and visit `http://127.0.0.1:5173`. For testing the compiled same-origin app, set `APP_URL=http://127.0.0.1:3000`, `npm run build`, `npm start`, then open port 3000.

Initial setup: open the app, enter the one-time `SETUP_TOKEN`, admin name, email and password of 12+ characters. Store secrets outside source control. The setup endpoint is blocked after the first user exists.

### Tests

```bash
npm run typecheck && npm test && npm run build
npm run test:integration   # starts a throwaway PostgreSQL 17 container (tmpfs), migrates, runs API tests, removes it
```

The integration suite refuses to run against a database that already contains users. It never touches the dev database volume.

## Production-oriented Compose structure

Stack path: `/opt/stacks/personal-tracker`. NPM upstream on existing Docker network: `http://personal-tracker-web:3000`. Only the web service is attached to the external `proxy` network. PostgreSQL remains in an isolated internal network with a persistent volume. A separate migration service runs before the API/worker. **This is prepared, not VPS-verified.**

```bash
cp .env.example .env
# Edit APP_URL to your real HTTPS hostname and fill DB_PASSWORD, SETUP_TOKEN, APP_ENCRYPTION_KEY.
# Verify that 'proxy' exists: docker network inspect proxy
# Never publish DB ports or check your .env into Git.
docker compose config --quiet
docker compose build
docker compose up -d
# Check readiness via a browser or NPM: https://YOUR_HOST/readyz
```

For a first-time deployment, deploy to an **unshared staging hostname**, run the full verification checklist, confirm the reverse proxy and Cloudflare origin protections, and only then consider public availability. Do not run a destructive `down -v` on existing volumes.

## Existing v0.1 data migration

`ops/import-preview.mjs` reads the previously generated **SQLite** Engineering Preview database in read-only mode. It does **not** import the original separate PHP/MySQL application; that is an independent source requiring an approved mapping. It does not copy active sessions, OAuth states, or AI API credentials.

```bash
# Back up old and target DBs first; target must have zero users.
npm run db:import-sqlite -- --source /safe/path/tracker.sqlite
# Inspect counts and inconsistencies. To apply intentionally:
npm run db:import-sqlite -- --source /safe/path/tracker.sqlite --apply
```

Read `ops/PHASE_A_VERIFICATION.md` for counts, constraints and rollback procedure. Import is atomic (all-or-nothing transaction). Never test an importer first on production data.

## Testing

```bash
npm test                 # source/static/domain checks (includes dependency-free tests)
npm run typecheck        # requires successful dependency installation
npm run build            # API and React assets
node --experimental-sqlite --test legacy-reference/tests/integration.test.js
```

**Tests requiring a running PostgreSQL service and browser are acceptance gates, not claimed results.** Re-run API auth, roles, project/task/todo CRUD, sprint membership, reminder worker, AI approve/reject and migration validation against an isolated PostgreSQL DB.

## Current architectural exceptions / future phases

- Runtime uses parameterized `pg` queries for several transactions, alongside a typed Drizzle schema and Drizzle-based read path. Completing a consistent Drizzle repository layer is recommended before declaring architecture migration fully complete.
- Sessions still use custom scrypt/cookie primitives; Better Auth migration is not yet implemented. Password reset, GitHub OAuth and TOTP were added as source only, while Microsoft OIDC and passkeys remain missing.
- True native tool calling, streaming, broad provider registry, attachment uploads, enterprise collaboration, complete admin operations and comprehensive live integration tests remain unfinished.
- No complete npm lockfile could be generated due to lack of network access. Dependencies are exact-pinned, but their transitive resolution is not frozen. **Generate and commit `package-lock.json` in an online, trusted environment using `npm install`, then switch Docker builds to `npm ci` for reproducibility.**

Security: never upload private `.env`, legacy database, OAuth tokens or AI keys to public repositories. Avoid treating a green container health check as proof of application correctness.

## v0.4.0 development snapshot updates

New: Microsoft tenant-specific OAuth, per-task private file attachments, read-only AI tools, AI provider admin policies and preview, email delivery outbox, sprint snapshots, timezone-aware recurring reminders, personal JSON export and operator backup runbook. See `PHASE_COVERAGE.md`.

**This is not a verified release.** Obtain a lockfile and run all semantic type checks, real PostgreSQL/API integration tests and staging migration rehearsal before using. `ops/RELEASE_GATE.md` is the source of truth. The web container additionally needs the `personal_tracker_uploads` persistent volume.
