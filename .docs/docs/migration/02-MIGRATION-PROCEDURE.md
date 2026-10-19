# Safe migration execution runbook (not executed)

## Prerequisites

1. Decide destination owner and consent. Choose source timezone (IANA), especially for MySQL `DATETIME` and reminders. Inventory the old database, real data volumes, special encodings and attachment files.
2. Back up **both** legacy DB and new PostgreSQL DB; store encrypted copies with access controls. Prove ability to restore into **temporary** environments, not just file existence.
3. Run importer in dedicated isolated local/staging environment using **read-only legacy MySQL** credentials, never the public old app's live database write privileges. Use snapshot or dump for repeatability.
4. Keep `personalTracker.zip` and `.env` outside source control. Never ingest client secrets from old archive. If old credentials were ever exposed, rotate them separately.

## Data pipeline

`legacy snapshot` → parse schema and charset → extract normalized read-only records → validate/transform and assign destination personal `workspaceId` → write staging report (`dry-run`) → human review of timezone, status conflicts and inferred sprint assignments → idempotent batched import with mapping ledger → reconciliation → QA screens → optional read-only cutover.

Use resumable import run ID, transaction boundaries per bounded batch, foreign-key order, stable mapping (`sourceTable,sourceId,runId`), duplicate guards and rollback ledger. Prefer migration in an empty target workspace; do not overwrite destination data silently. **Never** attempt in-place destructive migration of the PHP production DB.

## Sequencing

1. User/Auth link requires explicit verified owner ID. Do not import sessions, Google client secrets, PHP installer lock or hashed secret data.
2. Create destination personal workspace/project (`Legacy Imported` as default grouping where task project unknown).
3. Import tasks → todo lists → todo items → todo comments → sprints (unassigned unless owner approves inference) → reminders (delivery disabled until verified) → Pomodoro history.
4. Verify row counts, FKs, special characters, dates/times, statuses, manual sample of high-priority/overdue/important items and comments.
5. Verify negative authorization test with another account; verify new app doesn't show all legacy data globally.
6. Only after approval, enable reminder delivery and nominate new system as primary; preserve legacy read-only access temporarily for comparison.

## Reconciliation report

Produce structured Markdown/JSON report with original/new table counts, matched/new IDs, skipped/invalid rows, FKs, collision counts, ambiguous status/timezone/sprint records, anonymized sampled IDs, query/verification timestamps, migration build revision. Do not include raw sensitive task descriptions or provider secrets in report.

## Rollback

Never `DROP DATABASE` or `docker compose down -v` as normal rollback. If import was into isolated empty target, use retained snapshot or ledger-directed deletion **only after dry-run and explicit owner confirmation**. To roll back a live upgrade, deploy previously pinned image + compatible DB state restored from verified backup in maintenance mode. Reverse schema migrations are not automatically safe; document if restore is required.

## Acceptance

Zero unexplained missing rows, zero incorrectly accessible rows, zero unreviewed timezone conversions or sprint inference, stable id mapping, audit provenance and successful independent restore rehearsal. Any loss or mismatch blocks cutover and triggers manual investigation.
