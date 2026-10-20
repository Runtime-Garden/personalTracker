# Personal Tracker · by Runtime Garden

**v1.0.0-rc.3 — release candidate.** Self-hosted personal and team productivity tracker: React/Vite web app, Fastify/TypeScript API, PostgreSQL 17, Docker Compose.

> Release status: build, real-PostgreSQL API integration tests, browser smoke tests, a full Compose stack rehearsal and a backup/restore drill pass locally.
> Live OAuth providers, passkeys on real devices, live AI providers, email delivery and the production TLS/proxy path must be verified on the target server before tagging `1.0.0` (see `ops/V1_RELEASE_GATES.md`).

## Features

- One-time setup token for the first administrator; email/password login, invitation-only or open signup, email verification, password reset
- TOTP two-factor authentication with single-use recovery codes, passkeys (WebAuthn), device session list and revocation
- Optional Google, GitHub and tenant-restricted Microsoft Entra sign-in, explicit account linking (never merged by email)
- Personal workspace per account and team workspaces with owner/admin/member/viewer roles enforced in the API and SQL
- Tasks with priorities, projects, labels, subtasks, dependencies, recurrence, comments, watchers, mentions, private file attachments and optimistic concurrency
- Todos with private or shared lists, reminders with timezone-aware recurrence, notifications with optional email delivery and quiet hours
- My Day, Kanban board, sprints with analytics, focus (Pomodoro) timer, personal JSON export
- Bring-your-own-key AI assistant for OpenAI, Anthropic, Google, OpenRouter, DeepSeek, Groq, Mistral, xAI, Together and any **OpenAI-compatible or Anthropic-compatible endpoint** (OpenRouter, vLLM, LiteLLM, gateways): read-only questions, streaming, read-only tool calling, and AI-proposed changes that run only after explicit human approval and are audited
- Optional **decision model** per user that sets priority and importance of new tasks left on *Automatic*, with a safe default when the model is slow or unavailable
- System administration: signup policy, users, AI provider policy, pricing and limits, audit log, worker/job health, email queue, alerts
- Responsive Runtime Garden v2 interface

## Repository structure

```text
apps/api/src/      Fastify API, auth, domain modules, AI, reminder/email worker
apps/web/src/      React + TypeScript UI
apps/web/public/   Runtime Garden v2 brand assets
db/migrations/     Ordered, forward-only PostgreSQL migrations
ops/               Migration CLI, importer, backup, staging verification and deployment guides
legacy-reference/  Original v0.1.0 code kept for comparison
.docs/             Product blueprint and brand documentation
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

## Checks

```bash
npm run typecheck
npm run build
```

## Deployment

Step-by-step guide for Ubuntu + Dockge (`/opt/stacks`) + Nginx Proxy Manager: **`ops/DEPLOY_DOCKGE_NPM.md`**.

Summary: only the web container joins the existing Nginx Proxy Manager network (`PROXY_NETWORK`, default `proxy`) and NPM forwards to `http://personal-tracker-web:3000`. PostgreSQL stays on an internal network with no published ports; a one-shot migration service runs before the web and worker containers. Containers run as a non-root user with a read-only root filesystem. Never run `docker compose down -v` on a deployed stack.

Backups: `ops/BACKUP_AND_RESTORE.md` (encrypted PostgreSQL + uploads archive with age and rclone).

## Existing v0.1 data migration

`ops/import-preview.mjs` reads the previously generated **SQLite** Engineering Preview database in read-only mode. It does **not** import the original separate PHP/MySQL application; that is an independent source requiring an approved mapping. It does not copy active sessions, OAuth states, or AI API credentials.

```bash
# Back up old and target DBs first; target must have zero users.
npm run db:import-sqlite -- --source /safe/path/tracker.sqlite
# Inspect counts and inconsistencies. To apply intentionally:
npm run db:import-sqlite -- --source /safe/path/tracker.sqlite --apply
```

Read `ops/PHASE_A_VERIFICATION.md` for counts, constraints and rollback procedure. Import is atomic (all-or-nothing transaction). Never test an importer first on production data.

## Known limitations

- Drizzle ORM is used for part of the data access; complex transactions use parameterised `pg` queries by design.
- Streaming and tool calling: streaming works for OpenAI- and Anthropic-format connections; tool calling for OpenAI-format connections only. Google uses non-streaming requests. Azure OpenAI, Bedrock and Vertex adapters are not included (an OpenAI-/Anthropic-compatible gateway can front them).
- Custom AI endpoints must be public HTTPS; private network hosts need `AI_ALLOWED_PRIVATE_HOSTS`.
- No offline/PWA mode, browser push notifications or realtime co-editing.

Security: never commit `.env`, `.backup.env`, database dumps, OAuth secrets or AI keys.
