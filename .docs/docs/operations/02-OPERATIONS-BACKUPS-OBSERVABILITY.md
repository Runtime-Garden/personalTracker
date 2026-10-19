# Operations, observability, backups and rollback

## Health and metrics

Public liveness only minimal OK response; authenticated or internal readiness checks DB, auth dependencies and migrations; worker reports heartbeat/lease status through internal DB state. Structured JSON logs with `requestId`, `userId` only when appropriate, `workspaceId`, code path, status/latency; no provider keys, raw prompts, OAuth tokens, private description fields or unnecessary emails. Add low-overhead metrics: HTTP p50/p95/error, DB latency, active sessions (aggregate), AI requests/errors/tokens, reminder queue backlog/dead letters, worker heartbeat, backup last success.

## Alarm-worthy signals

Web readiness fails, DB disk low, backup stale or fails, worker heartbeat age excessive, oldest reminder queue item overdue, repeated failed OAuth callbacks/CSRF violations, repeated provider 429/500, abnormal AI spend, rate limiting anomalies. Prefer simple alert delivery via existing operator channel/email if authorized, not an unnecessary monitoring stack on day one.

## Backups

- PostgreSQL logical backups on schedule (e.g. daily with retention policy) and point-in-time recovery if requirements justify the added complexity.
- Upload media volumes separately if enabled; secret key material backed up securely **separately** from database dumps.
- Copies encrypted at rest and in transit, access controlled, with at least one offsite location. Test restore into isolated container periodically; log sample task/reminder reconciling.
- Backup plan includes compose/config sans secret leaks, image tags/digests, migration revisions, credentials recovery and disaster recovery owner actions.
- Define RPO/RTO from owner requirements after measurement. Do not claim compliance or uptime without evidence.

## Upgrade

1. Read changelog, review DB migration down/restore strategy and dependency compatibility.
2. Take verified consistent backup and label rollback image and DB snapshot.
3. Deploy to staging, apply forward migrations; run browser/auth/AI/reminder smoke tests.
4. Schedule production maintenance if schema changes are not backward compatible. Drain worker, wait for leased jobs or let lease expire safely.
5. Deploy image by exact tag/digest, run migrations once under lock, warm new app; verify health.
6. Resume worker and observe queue lag, failed job counts and application errors.

## Rollback

Return image tag only when DB schema is backward compatible. Otherwise restore the matching pre-upgrade DB snapshot in maintenance mode and reconcile jobs delivered during upgrade; notify users of any lost window where required. Never reverse migrations by guessing or purge user data automatically. Recheck reminder idempotency after reversion.

## Emergency operations

Disable AI provider via feature flag while retaining manual task CRUD; stop worker when bad scheduling detected but retain job state; revoke leaked credentials and rotate encryption keys with staged re-encryption; disable public signup, revoke compromised sessions. Keep runbooks brief, recorded and role-restricted.
