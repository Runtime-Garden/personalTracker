# v0.4.0 development snapshot → Phase F release gate

No application binaries or full Docker builds were run here. Dependency registry access was unavailable in the source-authoring environment.

On a connected development machine, before any deployment:

```bash
npm install --package-lock-only
npm ci
npm run typecheck
npm run build
npm test
npm run lint:syntax
```

Commit the generated, reviewed `package-lock.json`, then use `npm ci` in **both** Docker stages; remove any `npm install` from builds after the lockfile is verified. Pin runtime images by tested immutable digests.

Stage with a new isolated database and uploads volume; `docker compose -f compose.local.yaml -f compose.dev-db.yaml config` as appropriate. Do not reuse production credentials or volumes.

1. Run `npm run db:status`, inspect 0001–0007 migrations, then apply in an isolated DB with `npm run db:migrate`.
2. Run contract/integration tests for all routes, negative tenant isolation, viewer write rejection, CSRF, OAuth state/PKCE, role transition and rate limiting. Use **provider test accounts**, never production accounts.
3. Run Playwright on desktop/mobile, accessible keyboard flows, upload/download malware policy, browser console errors and contrast.
4. Test Microsoft Entra OAuth in one configured tenant, Google/GitHub, email provider delivery, disabled provider policy, AI tool budget, approval replay, and concurrency/failure paths.
5. Run reminder recurrence through Riga DST spring/fall transitions in a controllable clock/test DB; SQL logic needs real PostgreSQL validation.
6. Test large datasets, p95 API latency, worker retry and graceful shutdown; establish resource limits for the actual VPS.
7. Rehearse restoring both PostgreSQL and uploads from encrypted offsite storage; require a signed operator checklist.
8. Deploy behind NPM with HTTPS; verify public proxy headers, secure cookies, Cloudflare Access/origin bypass where relevant, and healthchecks.

**Known architectural debt:** A few legacy `pg` queries coexist with Drizzle, so the planned ORM conversion is incomplete. Better Auth, passkeys, native streaming across all AI providers and full live OAuth verification are also not complete. These require implementation and review before claiming the original full v1.0 vision.
