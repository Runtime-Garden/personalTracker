# Logical data model (PostgreSQL)

**Auth-owned schemas:** Let Better Auth and enabled plugins generate their user/session/account/verification/organization tables; treat their schema as owned by the auth library, do not blindly duplicate it. Map organizational membership to app workspace roles with an explicit, tested adapter, or use app-owned workspace tables if simpler. Avoid two conflicting role stores. Select one design and record ADR **before migration**.

## App entities

| Entity | Critical fields | Core constraints |
| --- | --- | --- |
| `workspaces` | id, type=`personal|team`, owner_user_id, name, status | personal uniquely bound to owner; team owner must stay member |
| `workspace_memberships` | workspace_id, user_id, role, joined_at, revoked_at | unique active membership; forbid self escalation |
| `projects` | id, workspace_id, name, key, state, archived_at | unique workspace/key; owner scope FK |
| `workflows` | id, workspace_id, project_id?, name | project/workspace consistency |
| `workflow_columns` | id, workflow_id, name, position, category | canonical status categories; no divergent Kanban status |
| `tasks` | id, workspace_id, project_id?, parent_id?, title, status_column_id?, priority, due_date, start_date, assignee_id?, is_important, version, archived_at | same-workspace FK checks; prevent recursive ancestry |
| `task_labels`/`labels` | task_id, label_id; workspace_id | same workspace and unique pair |
| `task_dependencies` | predecessor, successor, kind | same workspace and no cycles for blockers |
| `task_comments` | task_id, actor_id, body, created_at, edited_at | visibility inherits task; soft delete moderation |
| `task_activities` | task_id, actor_id, origin, changes, timestamp | bounded audit, origin and correlation |
| `todo_lists` | id, workspace_id, owner_user_id?, title, visibility | personal-private or team-scoped |
| `todo_items` | id, list_id, workspace_id, linked_task_id?, status, due_date?, rank | linked task nullable, same workspace if present |
| `reminders` | id, workspace_id, owner_user_id, title, scheduled_at_utc, timezone, state, linked_task_id?, version | uniqueness for action ID; validate scheduling |
| `notification_occurrences` | reminder_id, channel, occurrence_key, scheduled_at, delivered_at?, state | unique reminder/channel/occurrence_key |
| `notifications` | user_id, workspace_id?, kind, resource_id?, read_at, payload | never store secrets/PII in outbound templates |
| `sprints` | id, project_id, name, start_on, end_on, state, version | within one project |
| `sprint_tasks` | sprint_id, task_id, rank, added_at | same project/workspace; explicit relation; history policy |
| `focus_sessions` | user_id, task_id?, type, started_at, ended_at?, duration_sec, state | one active per user if product policy |
| `my_day_entries` | user_id, task_id?, todo_item_id?, planning_date, order | exactly one item reference; unique per day |
| `attachments` | resource_type/id, workspace_id, object_storage_key, bytes, mime, status | scoped lookup, never public path |
| `ai_connectors` | owner_scope_type/id, provider, base_url?, key_ciphertext?, enabled, validation_state | no plaintext returned; custom host allowlist |
| `ai_runs` | user_id, workspace_id, provider, model, status, tokens, costs?, request_id | logging redaction, bounded retention |
| `ai_proposals` | run_id, proposer_user_id, workspace_id, delta, base_versions, state, expires_at, approved_by? | immutable submitted diff, idempotent execution |
| `ai_action_audit` | proposal_id, action_type, target_id, before_hash, after_hash, actor_id | immutable append-only events |
| `system_settings` | key, typed_json, version, updated_by | encrypted secrets separate from typed settings |
| `system_audit` | actor_id, action, target_type/id, correlation_id, timestamp | retention, least data |
| `jobs` | id, type, payload, state, run_after, lease_owner, lease_until, attempts, dedup_key | unique dedup, retry/lease strategy |
| `import_runs` | id, actor_id, mapping_version, dry_run, report, state | immutable import report, rollback ledger |

## Integrity and indexes

- UUID/ULID primary keys, proper FKs, deletion policies, `NOT NULL` for required scope fields, DB constraints for supported status/role values.
- Scoped composite indexes: `(workspace_id, status, due_date)`, `(workspace_id, project_id, updated_at)`, `(user_id, planning_date)`, `(state, run_after)` for worker, `(workspace_id, project_id)` for sprint queries, `(workspace_id, id)` for update guards.
- Many app-owned tables use `workspace_id`. Cross-table tenant consistency needs composite FKs, trigger/check as suitable **and** service-layer validation; never rely only on front end.
- Use transaction-safe position/rank operations and versions for concurrent board moves. Soft deletion + purge policy must not break audit integrity.
- All `timestamp` values UTC (`timestamptz`); `DATE` fields deliberately preserve calendar-day semantics; store IANA zone and original user-local scheduling intent where relevant.
- Names and slug uniqueness defined within workspace/project scope; canonical IDs remain immutable.
- Encrypt connector credentials with authenticated encryption (e.g. AES-GCM) and versioned key IDs, keys outside DB/container image. Do not store provider chat contents by default absent user consent.

## Minimal relational invariants to assert in integration tests

A task cannot point to another workspace's project/assignee/parent/sprint/label; a `todo_item.linked_task_id` must be in same workspace; a deleted member cannot be newly assigned; an invitation cannot elevate beyond inviter; personal workspace cannot have second member; two notification workers cannot own the same unexpired lease; approving same AI proposal twice changes data only once.
