# Changelog

## Unreleased (rc.1 stabilisation) — 2026-10-20

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
