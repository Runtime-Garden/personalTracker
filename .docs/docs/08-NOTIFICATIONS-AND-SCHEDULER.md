# Reminder scheduler, notifications and time correctness

## Scope and architecture

Use the same TypeScript codebase with a worker entrypoint (`apps/worker`) as a separate Compose service **only when background delivery is enabled**, sharing DB and image, no Redis. The web/API doesn't run long timers for reminder delivery. Durable PostgreSQL `jobs` + `notification_occurrences`, `FOR UPDATE SKIP LOCKED` leasing and heartbeat/backoff is adequate for early workloads. If this becomes error-prone, evaluate a maintained PostgreSQL job library before inventing a queue framework; document any dependency.

## Workflow

1. User creates reminder with local datetime and **IANA time zone**; validate nonexistent/ambiguous DST local times. For ambiguous time, ask earlier/later offset; for nonexistent time, ask for adjustment rather than silently shifting.
2. Persist intended zone/local time and computed `timestamptz` instant in transaction. Create occurrence and pending job with stable `dedup_key`.
3. Worker atomically leases due job, re-checks reminder status and recipient policy, creates in-app notification exactly once based on unique occurrence key.
4. For external channels, attempt with timeout; status is `attempted/accepted/failed`, not guaranteed viewed. Retry transient errors with bounded exponential backoff and jitter; dead-letter after capped attempts; alert operator on persistent failures.
5. Mark completed delivery only after durable success record. On crash, lease expires and worker retries; duplicate external sends remain possible unless provider idempotency is supported. The UI must not claim guaranteed exactly-once email.
6. Snooze creates a **new occurrence**, preserving old occurrence history and linkage.

## Notification types

Reminders, assignment, mention, comment, invitation, AI proposal approval ready, AI action finished, sprint start/close, system notices (operator only). User-facing preference matrix by type and channel: in-app as default, email opt-in (or essential security messages), web push later only with browser permission. Quiet hours suppress non-urgent channels while retaining in-app history; reminders may allow bypass as an explicit choice.

## Time semantics

- Due **date** is not a timestamp; it belongs to the user/project calendar day, and display must follow workspace policy.
- Reminder “9 AM tomorrow” requires actor timezone, explicit date and DST handling.
- Tests: Europe/Riga spring/fall transitions; UTC boundaries; user travels/changes zone; worker offline for 48h; multiple worker instances; clock skew; duplicate enqueue; cancel just before send; deleted task; revoked member.
- Never compare due dates using server's `CURDATE()` as the implicit user's local day.

## Worker health and admin

Track `oldest_pending_age`, `jobs_pending`, `failed_jobs`, attempts, worker heartbeat, service duration, external provider response categories. Admin can inspect **redacted** status and issue an audited safe retry, not execute arbitrary job payload. Document retention/purge policy.
