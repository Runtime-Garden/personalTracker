# Delivery roadmap (mandatory phase gates)

A phase is **done** only if the relevant vertical slice runs and tests pass; don't confuse generated files with deployed functionality.

| Phase | Output | Exit gate |
| --- | --- | --- |
| 0 — Recon/design | Repo decisions, official version compatibility check, threat model, visual wireframes, ADR, capacity assumptions | Owner approves architecture and UI direction |
| 1 — Foundation | Monorepo, app shell, design tokens, CI, health, DB migrations, Better Auth + Google, personal/team workspace boundaries, bootstrap admin | Local login+logout; invite/membership; tenant isolation negatives; mobile shell |
| 2 — Core productivity | Projects, Tasks, Todo, Reminders, My Day, Important, scoped search | End-to-end create/update/filter/reload; persistent state and auth tests |
| 3 — Collaboration/Agile | Team invitations + comments + assignments, Kanban, sprint joins, activity, focus sessions | Explicit sprint membership verified; drag keyboard fallback; no privacy leaks |
| 4 — AI read-only | Approved connectors, test connection, model capability flags, streamed chat, scoped read tools, quotas and redaction | AI cannot access another workspace; disabled state and mock-provider test |
| 5 — AI actions | Typed mutations, diff preview, user approval, idempotent execution, audit, rollback semantics | Injection/permission/concurrency/approval tests green |
| 6 — Admin/operations | System settings integrated, notifications worker, jobs, provider policies, security sessions and data export | Admin UI does real work, ordinary user forbidden, worker test reliable |
| 7 — Migration | Legacy export/import dry run, mapping reports, reconciliation, manual QA | Zero unexpected loss or cross-user mixing, backups/restores tested |
| 8 — Hardening | Integration/browser/a11y/security/performance tests, docs, Docker, backup, release checklist | All P0 gates green; critical/high findings fixed or explicitly accepted |
| 9 — Release | Staging verification, TLS/origin, backups, approved deployment, rollback drill | Go/no-go owner signoff, real smoke tests and status updated |

## Sprint-sized implementation slices

Phase 1: (a) monorepo API health + typed errors, (b) design shell/login, (c) auth/account, (d) workspace table + personal provision, (e) invite/team, (f) policy integration tests. Never build all auth/UI/DB in isolated silos.

Phase 2: (a) project CRUD, (b) task CRUD with filters and details, (c) todo independent linking, (d) reminder scheduling/in-app, (e) day planning/important/search, (f) end-to-end regression.

Phase 3: (a) team task ownership/comments, (b) board with accessible reorder, (c) sprint explicit mapping, (d) Pomodoro persistent sessions, (e) activity and usage metrics.

Phase 4/5 AI: first mock provider and single real connector, read-only retrieval, usage instrumentation, proposal/approval for `create_task`, then expand to other tools. Never launch with unlimited automatic writes.

## Approval and artifacts for every phase

Each phase delivers: a small working increment; migrations if necessary; `.env.example` changes; API contract changes; screenshots for responsive UI; tests and exact results; documented open issues; a short PR/commit summary; a statement of **implemented / tested / deployed / verified**. Stop on unresolved severe auth/data safety issues.

## Possible timeline

Not estimated: actual schedule depends on OpenCode output quality, rework and manual integration verification. Avoid fabricated “one afternoon to production” commitments. Prioritize correct core + safe foundation over broad but superficial screens.
