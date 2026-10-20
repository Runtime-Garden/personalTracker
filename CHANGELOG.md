# Changelog

## 1.0.0-rc.3 — 2026-10-20

### Added
- OpenAI-compatible and Anthropic-compatible custom endpoints (OpenRouter, vLLM, LiteLLM, gateways) with optional display name; connection list with test and delete in the UI. SSRF protection: HTTPS only, private/reserved addresses blocked at DNS resolution and connect time, redirects refused; `AI_ALLOWED_PRIVATE_HOSTS` for self-hosted gateways. Admin provider policies apply to custom endpoints.
- Decision model: per-user opt-in automatic classification of priority and importance for new tasks left on *Automatic*; strict JSON validation, 8 s timeout (`AI_TRIAGE_TIMEOUT_MS`), budget-aware, falls back to medium priority. Result and reason shown on the task.
- Streaming for Anthropic-format connections; usage recorded for tests, streams and triage.
- Migration `0010`: per-occurrence notifications, reminder series anchor, hot-path indexes, AI triage tables.
- Worker heartbeat healthcheck, graceful shutdown (`init`, `stop_grace_period`), hourly cleanup of expired auth records.

### Fixed
- Editing a task, todo or sprint no longer clears its dates; dates no longer display a day early.
- Snoozed or rescheduled reminders notify again; recurring series keep their original time after a snooze; missed occurrences are skipped instead of replayed; reminders of removed members are silenced.
- Quiet hours no longer use up email retries; disabling email stops queued sends.
- OAuth invitations are honoured only for the invited address, also in open signup mode.
- Forms no longer lose typed input while open; errors are shown inside the dialog with a "load latest version" option on edit conflicts.
- My Day uses the user's timezone; viewers no longer see actions the API rejects; attachments can be deleted only by the uploader or an admin; sign-out no longer shows an error.
- AI answers and costs stay on screen; proposal approval follows normal task rules (recurrence, events, timezone) and is hidden after expiry.
- Passwords are never requested through `window.prompt`; one-time tokens and recovery codes are shown in a dialog with copy.
- Accessibility: dialogs trap focus, close with Escape and restore focus; current page announced; mobile drawer hidden from keyboard when closed; contextual button names; AA text contrast and visible focus ring using brand tokens.
- Layout: long names, emails, secrets and kanban titles wrap on small screens; sidebar scrolls on short screens; missing favicon added; mobile menu icon independent of fonts.
- Static serving returns 404 for missing assets; hashed bundles cached immutably.
- Backups: systemd PrivateTmp and pipe failures no longer corrupt archives; plain backups include uploads and are private.
- Error responses keep application messages (e.g. provider HTTP status) while hiding unexpected errors.

## 1.0.0-rc.2 — 2026-10-20

### Fixed
- Search treats `%` and `_` literally instead of as wildcards.
- Sprint updates reject `start_date` after `end_date` and null dates (previously a server error).
- Database errors are returned as generic messages; constraint and table names are no longer exposed. NOT NULL, date and range errors return 400 instead of 500.
- Session cookie lifetime follows `SESSION_DAYS` (was fixed at 7 days); session `last_seen_at` is now updated (at most every 5 minutes).
- Compose web service now receives `SESSION_DAYS` and `TRUST_PROXY` (its own environment block overrode the shared one).

### Added
- `PROXY_NETWORK` to select the existing Nginx Proxy Manager network.
- `pull_policy: build` so Dockge "Update" rebuilds from source instead of pulling.
- `ops/DEPLOY_DOCKGE_NPM.md` deployment guide for Ubuntu + Dockge + Nginx Proxy Manager.
- `ops/verify-staging.mjs` checks HTTPS origin, HSTS, frame/nosniff headers and HTTP→HTTPS redirect.

### Verified locally
- Full Compose stack (read-only containers, migrate → web/worker ordering, worker reminder delivery, uploads volume) on an isolated project.
- Encrypted backup → restore drill (pg_dump + uploads, age round trip, checksums, row counts, attachment hash).

### First stabilisation pass (also in 1.0.0-rc.2)

### Fixed
- 14 TypeScript errors: typed/validated route parameters, typed reader loop for provider SSE streams, exported `base32Encode` (MFA enrolment import previously broke module linking), safe JWK → RSA key construction for Google/Microsoft ID tokens, removed dynamic `db.js` imports in auth.
- AI approval executed only known actions but silently skipped unknown ones and still marked the proposal approved; unknown actions now abort the whole transaction (422).
- Passkey login options throttle was never cleared on success, progressively locking out regular passkey users; successful verification now resets it.
- Passkey removal can no longer delete an account's last login method.
- Google-created accounts now record `email_verified_at` (only `email_verified=true` tokens are accepted), so email notifications work as for GitHub.
- Compose web service now receives `MICROSOFT_*`, `SESSION_DAYS` and `TRUST_PROXY`.

### Added
- Opt-in `TRUST_PROXY` (exact IP/CIDR list) so entry-point rate limits key on real clients behind NPM instead of one shared proxy bucket.
- Real-PostgreSQL API integration suite (`npm run test:integration`, throwaway tmpfs container via `ops/test-integration.sh`).
- Docker images install with `npm ci` from the lockfile; `.dockerignore` excludes `dist` and `var`.
- Reviewed, version-pinned `allowScripts` entries for esbuild's postinstall.

## 1.0.0-rc.1 — 2026-10-19

### Source-level additions
- Passkeys using SimpleWebAuthn with single-use challenges and user-verified credentials.
- Explicit Google, GitHub and tenant-restricted Microsoft account linking, no email-based auto-merge.
- Read-only OpenAI-compatible streaming AI assistant and cancel UI; no privileged write tools.
- Encrypted offsite backup operator scripts and opt-in systemd templates.
- PostgreSQL migrations `0008_passkeys.sql`, `0009_identity_linking.sql`.
- Correction of worker outbound email networking while keeping database private.
- Release smoke test script and source/contract regression checks.

### Known release gates
Dependencies, semantic TypeScript checks, PostgreSQL E2E, real passkey/OAuth/AI, backup restore and Docker deployment **unverified**. Review `ops/V1_RELEASE_GATES.md`.

## 0.4.0 — 2026-10-19
Advanced authentication, collaboration, notifications, read-only AI tools and admin source implementation (see historical v0.4 snapshot).
