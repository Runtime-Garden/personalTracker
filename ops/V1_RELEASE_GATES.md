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
