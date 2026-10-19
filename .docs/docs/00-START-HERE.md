# Project charter and decisions

## Problem

Existing Personal Tracker is a functional, single-user PHP/PDO/MySQL application with Google login and modules Tasks, Todo, Reminders, Important, My Day, Agile/Kanban, Sprints and Pomodoro. The screenshot shows a dense desktop navbar, three count cards, active task list, Todo, Pomodoro and sprint widgets. Data tables are not scoped to owners/workspaces, so enabling team logins on the same data model would expose other users' data.

## Goal

Build a modern private-first, self-hostable productivity application for one person **and** invited teams. Deliver beautiful, accessible and responsive UX, rich collaboration, reliable reminders and an optional secure cross-provider AI copilot that can read, propose and (after policy checks) modify authorized data.

## Architectural choice and trade-offs

| Choice | Why | Cost/trade-off |
| --- | --- | --- |
| Full-stack TypeScript on Node | One language, excellent AI/OAuth/UI ecosystem, lower handoff friction for OpenCode | Requires Node runtime and careful concurrency/worker discipline |
| Fastify | Small API, typed validation, straightforward services | UI needs its own React tooling |
| React + Vite SPA | Mobile interactions, Kanban, AI panel, familiar ecosystem | Plan SEO only for public/login pages; app itself is private |
| PostgreSQL + Drizzle | Relational constraints, transactions, migrations, JSON where useful | Extra DB process relative to SQLite; migration from MySQL needed |
| Better Auth | Social/OIDC/session/org support | Library/plugin compatibility must be tested, app RBAC still required |
| AI SDK + custom provider layer | Consistent text/stream/tool interface | Provider capabilities vary; custom endpoints are attack surfaces |
| Database-backed jobs | Reliable low-volume reminders without Redis | Job leasing/recovery and clock semantics must be implemented |
| Modular monolith | Easy deploy/debug/rollback | Requires intentional internal boundaries |

**Do not choose Go solely because it may benchmark faster.** Consider profiling and operational requirements first. A Go migration is a future ADR, not scope for v1.

## In-scope for v1

Multi-user accounts and private workspaces; personal and team workspaces; invite, roles and policies; projects; tasks/subtasks/comments/checklists; todos; reminders and notification center; My Day and Important; Kanban/sprints; Pomodoro; global search; user preferences; integrated admin; AI assistant with supported providers and confirmed tool actions; imports; basic export; accessibility, backups and audit.

## Staged scope

MVP = trustable auth/workspaces, projects/tasks, simple Todo/reminders, responsive shell, no AI writes. Later add Agile/collaboration, AI actions, Pomodoro, admin/ops maturity and migration. Optional recurring rules, calendar sync, web push, offline PWA, time tracking and mobile apps are clearly marked P1/P2 in the feature catalog.

## First-run defaults

- Private self-hosted mode; registrations **closed** initially. First admin created using one-time bootstrap workflow under trusted control, with expiration and no hardcoded password.
- Auth provider enabled only with real credentials. Google as first provider; GitHub and Microsoft as extension.
- Each new user gets a private personal workspace. Team workspaces appear only when created/invited; no automatic visibility across spaces.
- Users can change personal preferences; system admin configures site-level settings. Workspace owners manage their workspaces only.
- AI is opt-in and disabled until a compatible provider/model is configured and an explicit access policy exists.

## Non-goals and assumptions to confirm

Default deployment: Runtime Garden Docker VPS **if explicitly approved**; do not assume deployment or choose production domain. Default language English, translation ready; Europe/Riga is merely a possible user timezone not a forced global default. No billing; invite-only usage. Passwordless Google login can be primary, with secure fallback login to avoid admin lockout (passkey or carefully secured email-based method). Require explicit owner decision before public registration or paid SaaS.

## Vocabulary

- **System admin:** instance-level operator (configuration/health/users), **not automatically authorized to read private content**.
- **Workspace:** privacy/permission boundary. `personal` or `team`.
- **Project:** workspace-scoped grouping for tasks and sprints.
- **Task:** first-class work item; **Todo item:** lightweight checklist, optionally linked to a task.
- **Reminder:** scheduled notification; not equivalent to a task due date.
- **AI proposal:** machine-generated suggested change; **AI action:** authorized backend transaction after policy and (when needed) approval.
