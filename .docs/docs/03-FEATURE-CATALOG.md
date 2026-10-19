# Feature catalog and domain rules

## Global dashboard

Contextual personal/team workspace switcher; stats for open/in progress/completed/overdue; My Day summary; upcoming reminders; active focus; team sprint snapshot when available. Widgets configurable per user, never global admin-only statistics hidden in personal surface. Counts should use explicit definitions and include empty-state sample guidance instead of fictional data.

## Tasks and projects (P0)

Task: title (required), description (safe rich text/plain initially), unique ID within workspace, project (optional for personal inbox), assignee (must be workspace member), creator, status, priority, importance, due date-only and optionally due instant, start date, estimate, labels, watchers, task links, parent/subtask, archive/soft delete and history. Use explicit workflow transition policy; preserve `completedAt` and `completedBy`. Prevent parent cycles and cross-workspace links. Multi-assignee not default, consider later. Activity stream includes actor and source (`ui`, `ai`, `import`).

Projects: workspace scoped, name/slug, description, icon, state, ordered board columns, optionally sprint behavior, membership inherited from workspace initially (project-level permissions P2). Archive project without silently destroying tasks; support project restore with authorization.

## Todo (P0)

Simple checklist items grouped into personal or workspace lists. A Todo **may** link to a task but does **not** require one (fix legacy mandatory link). `open`, `in_progress`, `done`; ordering, optional date, importance, notes and comments; no global list visibility unless shared. A task's completion must not silently delete linked todos; define sync behavior as explicit user option.

## Reminders (P0)

One-shot datetime, optional associated task/todo, channel preferences, snooze, dismiss/done, secure in-app delivery, optional email. Notification occurrence records separate from reminder definitions. Validate timezone/DST and avoid double-send after restart. Recurrence P2 with explicit RRULE-like semantics and missed-run policy.

## My Day and Important (P0)

`My Day` is a **user-specific planning relationship**, not merely all due-today tasks; optional suggestion list adds due-soon/overdue/important items without auto-select. Important can be marked on tasks, todos and reminders with membership-scoped visibility. Show timezone and date boundary clearly.

## Agile and sprints (P1)

Workspaces may have several projects; projects own backlog, board workflow and sprints. Sprint item association is a **join table or explicit sprint ID**, not inferred from due-date windows. Status and board column use a single canonical workflow ID + status category mapping, avoiding legacy dual-source drift. Board reorder persists stable sortable ranks transactionally; conflict detection for concurrent moves. Roles gate sprint start/close; tasks can be moved in/out as business rule. Historical reports retain snapshots.

## Pomodoro (P1)

Personal sessions with server-persisted start/end, target minutes, actual durations, pause data, optional task link, focus/break modes, day-level summary and preference presets (25/5/15 default, editable). A timer running in the UI is not proof that a session completed; server decides durable state. Protect against overlapping sessions and client manipulation. Optional desktop notifications, opt-in only.

## Search and discovery (P0/P1)

Global shortcut opens workspace-aware search; search tasks, projects, todos, reminders with permission constraints **in the DB query** and limit/pagination. No cross-person leakage in autocomplete, snippets, counts, cache or AI indexes. Consider PostgreSQL full-text/trigram only after actual needs; no external search service initially.

## Collaboration (P1)

Comments, activity records, assignments, mentions, memberships, notifications. Files stored off DB with explicit scope, malware/type/size controls and short-lived access tokens. No public file URLs. Notification fan-out asynchronous and idempotent; actor never sees private comments outside scope.

## Convenience features (P2)

Recurring tasks, presets/templates, custom field collections (constrained), saved filters, CSV export, calendar view, weekly reviews, habit tracking, optional email/web push, PWA, selective realtime. Each must reuse core privacy rules and be measured against complexity/performance cost.

## Cross-cutting invariants

- Every entity has `workspaceId` (or is explicitly user-private) with server-side scope enforcement.
- Deleting a record with dependents is soft-delete/archival unless an intentionally reviewed cascade is specified.
- Each mutating operation is transactional and audited for security-relevant events; AI also reports proposal/run IDs.
- Server validates all strings, sizes, dates, enumerations, identifiers and source/target IDs; never trusts UI-selected workspace or model output.
- Pagination/filtering return no fields not authorized to the caller.
