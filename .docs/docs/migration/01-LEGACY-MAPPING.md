# Legacy PHP/MySQL audit and migration mapping

## Verified from supplied ZIP (2026-10-18)

`personalTracker.zip` has 84 entries including PHP routes, classes, `database/schema.sql`, `.env.example`, installer, Google OAuth and CSS/JS. README explicitly describes a **single-user** app and zero server runtime dependencies, using PHP + PDO + MySQL, Tailwind build assets and vanilla JS. **No `user_id` or `workspace_id` fields** appear on tasks, todo, reminders, sprint or Pomodoro tables. Original archive must be treated as **private**; this blueprint deliberately excludes raw PHP/config files in case local credentials/installer settings are present.

| Legacy table/module | Observed fields/behavior | New mapping / change |
| --- | --- | --- |
| `users` | `google_id,email,name,timezone,work_hours_*` | Link auth identity via verified Google subject; migrate metadata to authenticated user profile; avoid auto-merge by email |
| `tasks` | title, description, 3 statuses, priority, due_date, important, Kanban fields | Create new task in imported owner's personal workspace/project; map status/column explicitly |
| `todo_lists` | title, description | Private Todo lists under personal workspace |
| `todo_items` | `todo_list_id, task_id NOT NULL`, due, status, position | Preserve links; new system also supports nullable link on later items |
| `todo_comments` | todo item body, `is_system` | Preserve visible change log as imported comments/activity with `origin='legacy_import'` |
| `reminders` | title, description, `remind_at DATETIME`, status, important | Imported reminder with timezone assumption **requiring owner approval**, no default sends until validated |
| `sprints` | name, start/end date, no explicit task assignment | Import project sprints; create explicit memberships only after preview/inference consent |
| `pomodoro_sessions` | work/short/long, started, ended, duration, completed | Map timestamps with validated source time zone, link to imported user |
| Google login | Allowlist account(s), OAuth callback | New Better Auth identities, invite-only, proper internal user scope |
| My Day / Important | Aggregated due-today and important views | My Day becomes explicit per-user plan, with inferred suggestions, not forced mapping |
| Kanban | Due-date sprint membership, status synchronization from column | Migrate to canonical project workflow; document ambiguous board status |
| Timer | Client `localStorage` wall-clock state; sessions stored in DB | Durable server session metadata; local running-only timers are not authoritative imported history |

## Legacy enumerations

Tasks: `not_started|in_progress|completed`; priorities `low|medium|high`; Kanban `backlog|todo|in_progress|review|done`; todos `open|in_progress|done`; reminders `pending|done|dismissed`; sessions `work|short_break|long_break`.

Proposed task status translation: `not_started`→`todo`, `in_progress`→`in_progress`, `completed`→`done`; Kanban `review` becomes separate `review` column within `in_progress` category. If `status` and Kanban column contradict, log in conflicts file and do not silently alter meaning. Map `due_date DATE` to date-only, not midnight UTC.

## Ambiguities to surface

- If allowlisted multiple Google accounts used shared single-user content, which account truly owns it? **Do not distribute tasks automatically.** Require selected destination personal workspace.
- `remind_at DATETIME` and session DATETIME lack timezone metadata; request source timezone before conversion; do not assume UTC.
- Sprint memberships weren't explicit. Suggested inferred membership based on due date is **preview-only** and must be opted in; default import sprints without auto assigning tasks if ambiguous.
- Todo item task FK cascades on task delete; new soft delete policy may differ.
- Old `todo_comments` may have no user author; attribute source `legacy_import` instead of inventing a person.

## Import verification

Use `docs/migration/02-MIGRATION-PROCEDURE.md` for dry-run and rollback. For each legacy table compare counts, mapped IDs, discarded records (ideally zero), checksums, collisions, invalid dates and unresolved relationships. Generate `legacyId → newId` mapping ledger. After import validate user can see all expected records in only one personal workspace and that unrelated accounts cannot access them.
