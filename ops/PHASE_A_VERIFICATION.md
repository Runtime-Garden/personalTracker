# Phase A verification and go/no-go checklist

## 1. Freeze, build, typecheck

In a trusted online development host:

```bash
node --version             # >=22.16
npm install                # generate lockfile; inspect changes
npm audit --omit=dev       # address actionable findings
npm run typecheck
npm test
npm run build
```

Once the lockfile exists and build passes, use `npm ci` in both Dockerfiles and rebuild without cached dependency layers. Record exact versions and commit hash.

## 2. Development PostgreSQL

```bash
docker compose -f compose.dev-db.yaml up -d
cp .env.example .env         # edit credentials; never commit
set -a; . ./.env; set +a
npm run db:status
npm run db:migrate
npm run db:status
npm run dev:api
npm run dev:web
npm run dev:worker
```

Use a separate browser profile. Register first admin using setup token, then refresh login and task lists. Confirm all are persisted after API restart.

## 3. Negative authorization tests

- Create two users A/B, each with a personal workspace. A task/project/todo/sprint/reminder from A must never be readable or mutable by B via a manually supplied workspace ID or resource ID.
- Create a team; invite B as viewer and assert B can list only member-visible data but cannot write any task/todo/reminder/sprint.
- Remove B; their next request should fail immediately (no access cached indefinitely).
- Reassign task to a foreign-workspace user/project ID; response must be rejected without changing task.
- PATCH a task with stale `version`; return `409`; re-fetch and retry current version successfully.
- Prevent removing/demoting the last workspace owner. Run concurrent ownership-removal cases.
- Admin can see system settings, ordinary users cannot. Admin cannot view unrelated personal tasks.
- Reject bad/expired invitations, replayed approvals, stale AI mutation IDs and foreign resource IDs.
- Run `npm audit` plus manual review of login rate limiting, OAuth PKCE/state/nonce, CSRF, and provider timeout controls.

## 4. Worker / migration

- Two workers concurrently poll a due reminder: exactly one notification record and `delivered` reminder state.
- Restart worker during delivery and after DB timeout; no duplicate or lost notifications.
- Test imported users, projects, tasks, todos, reminders, sprints and comments row counts from a **copy** of the SQLite DB.
- Verify read-only input DB (do not change SQLite checksum), verify GUID mapping and FK checks.
- Re-running migrations must report `ok`; changed SQL checksum must fail closed.
- Re-running import on populated destination must refuse.

## 5. Docker/NPM/VPS checks

```bash
# Run only in staging first:
docker network inspect proxy
docker compose config --quiet
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 personal-tracker-migrate personal-tracker-web personal-tracker-worker
```

Validate NPM upstream `personal-tracker-web:3000`, HTTPS certificate, OAuth redirect (if enabled), cookie `Secure`, TLS redirects and origin bypass. Verify database is not present on any host-exposed port and not on `proxy` network. Test fresh guest, team viewer, editor and admin roles on separate browsers.

## 6. Backup / rollback

- Take a PostgreSQL custom-format backup before schema or app upgrades (see `ops/backup.sh`), encrypt it, copy offsite and verify it is readable with `pg_restore --list`.
- In an isolated staging database, restore using `pg_restore --clean --if-exists` **only when the target is disposable and explicitly selected**. Never point a destructive restore at the live DB by mistake.
- Keep previous known-good image digest and its matching schema baseline; forward-only migrations may not be backward compatible. Before rollback, assess schema compatibility; do not drop columns/tables to make old code start.
- `docker compose down -v` **permanently destroys the database volume**. Do not use it for routine upgrades.

## Formal promotion

Only after the above are documented with actual results, re-label Phase A from `IMPLEMENTED AS SOURCE` to `TESTED`, then obtain explicit approval for production deployment. A passing HTTP `/readyz` alone is insufficient.
