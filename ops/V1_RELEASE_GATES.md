# Final acceptance gates for v1.0.0 production

Run these after unpacking on a trusted development runner with access to npm and a disposable PostgreSQL database.

## Dependency & build gates

```sh
node --version
npm install
# Commit the generated package-lock.json after review (then use npm ci in CI and Docker).
npm run typecheck
npm run build
npm test
```

Do not ignore TypeScript errors or test failures to ship. Perform a dependency vulnerability audit and check bundled/transitive licenses. Update Docker images to use `npm ci` only **after** the lockfile has been created and reviewed.

## Fresh staging gates

```sh
# Set a nonproduction environment and staging domain; do not target a live DB.
npm run db:migrate
npm run db:status
TARGET_URL=https://staging.example.com node ops/verify-staging.mjs
```

Then validate account enrollment, passkeys, password reset, OAuth callback and explicit linking, personal/team isolation, CRUD, recurrence, attachment private downloads, AI read-only tools, approval replay prevention, email delivery, admin scope, and browser accessibility. Run Chrome/Firefox/Safari at mobile and desktop widths. Simulate provider timeouts and cancellation. Test users from two distinct workspaces to detect data leaks.

## Docker / operations gates

Review `compose.yaml` service image pins and limits; verify NPM-to-web via `proxy`, PostgreSQL isolated, worker outbound email via `egress`, origin protection behind Cloudflare, TLS/cookies, no unintended open host ports, and startup/worker health. Perform a **real** encrypted offsite backup, isolated restore and checksum/content check before marking backup verified. Document image digest and rollback strategy. Never run `docker compose down -v` for this application.

Promote to `1.0.0` only with a dated release record showing positive results for all of the above.

## Release record (fill in on the target server)

Promote `package.json`, `IMAGE_TAG` and the Git tag to `1.0.0` only when every applicable row is filled with a date and PASS.
Rows for features that are deliberately not enabled (for example an OAuth provider without credentials) may be marked `N/A — disabled`.

| Gate | Date | Result / notes |
|---|---|---|
| Local: typecheck, build, unit, real-PostgreSQL integration, browser smoke, Compose rehearsal, backup→restore drill | 2026-10-20 | PASS (rc.2, developer workstation) |
| Server: `docker compose up -d --build`, migrate exited 0, web healthy, worker running | | |
| Server: `TARGET_URL=https://… node ops/verify-staging.mjs` all PASS | | |
| `TRUST_PROXY` set; login rate limit observed per client, not global | | |
| Admin setup, invite, team roles, task/reminder/attachment on mobile + desktop browser | | |
| Reminder delivered by worker on the server | | |
| 2FA enrol + code login + recovery code login | | |
| Passkey register / sign in / remove (one phone, one desktop) | | |
| Email: verification, password reset, reminder email | | |
| Google / GitHub / Microsoft sign-in + link + unlink (each enabled provider) | | |
| AI: connection, ask, stream, proposal approve + reject (each enabled provider) | | |
| Encrypted offsite backup run + restore of that archive on a separate project | | |
