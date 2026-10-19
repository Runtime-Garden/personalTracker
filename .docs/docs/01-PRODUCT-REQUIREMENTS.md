# Product requirements document (PRD)

## Product statement

Personal Tracker combines personal planning, action execution, lightweight Agile collaboration, reliable reminders and optional AI-guided operations in one quiet, responsive experience. The default is a private personal workspace, not an enterprise Jira clone; team features activate contextually rather than making personal usage complex.

## Audiences and outcomes

- **Individual:** Quickly capture, prioritize and complete work; plan My Day, preserve focus, reliably receive reminders.
- **Workspace contributor:** Find assigned work, update shared tasks, collaborate in context without seeing unrelated personal data.
- **Team lead:** Prioritize a backlog, assign work, run sprints and understand blockers without micromanagement.
- **System operator:** Manage access/providers/settings and diagnose system health without needing access to members' private task content.

## Functional requirements and acceptance IDs

| ID | Requirement | Priority | Acceptance evidence |
| --- | --- | --- | --- |
| FR-001 | Single instance supports personal + multiple team workspaces | P0 | Isolation tests across three users, two workspaces |
| FR-002 | Google OAuth, secure session lifecycle, account recovery | P0 | OAuth happy/negative paths, revoked session test |
| FR-003 | Invite-only onboarding and team membership roles | P0 | Expired invite, role change, blocked endpoint tests |
| FR-004 | Responsive dashboard and navigation | P0 | 360px, 768px, 1280px test captures |
| FR-005 | CRUD projects, tasks, status, priority, due dates | P0 | Browser and API tests, transaction invariants |
| FR-006 | Personal todos independent of Jira-like tasks | P0 | Optional task link, list/complete flow |
| FR-007 | Reminders with durable delivery state | P0 | Worker retry/timezone/dedup tests |
| FR-008 | Search is scoped by membership & visibility | P0 | Cross-workspace search yields zero leaks |
| FR-009 | Integrated system settings only for operators | P0 | Restricted UI + 403 direct API test |
| FR-010 | Team Kanban, backlog and explicit sprint membership | P1 | Move/assignment/sprint tests |
| FR-011 | AI provider configuration, model selection and capabilities | P1 | Working connector tests, unsupported capability messaging |
| FR-012 | Read-only AI assistant for authorized work | P1 | No unauthorized retrieval / prompt injection test |
| FR-013 | AI previews, confirmation, validated action execution | P1 | Plan → approval → mutation → audit integration test |
| FR-014 | Pomodoro work/break history and focus link | P1 | Accurate timeline after refresh/reconnect |
| FR-015 | Notifications preferences, in-app inbox | P1 | Snooze, read/unread, dedup/quiet hours |
| FR-016 | Admin activity, safe config, member lifecycle | P1 | Separate system-admin from content-owner scopes |
| FR-017 | Reversible legacy import and reports | P1 | Referential mapping, count/hash reconciliation |
| FR-018 | User/workspace export + import preview | P1 | Permission and schema validation |
| FR-019 | Recurring tasks and reminders | P2 | DST + next occurrence semantics |
| FR-020 | Browser push/PWA offline queue | P2 | Explicit opt-in, offline conflict replay |
| FR-021 | Calendar integrations | P2 | OAuth scope, disconnect and sync failures |
| FR-022 | Time tracking, analytics, templates | P2 | Accessible aggregated view |
| FR-023 | Realtime presence | P2 | No dependency on WebSockets for core correctness |

## Main UX rules

Capture in under a few interactions: universal quick-add opens correct default workspace; keyboard shortcuts have visible discoverability and accessible fallback. Actions give immediate feedback but only claim persisted success after API confirmation. Dates are explicit; no confusing “due yesterday” tooltip without timezone clarity. Personal vs team workspace context must remain visible on all major pages.

## Nonfunctional requirements

- **Security:** least privilege, defense in depth, tenant isolation, reliable auth, approved encrypted secrets, strong audit; see threat model.
- **Reliability:** reminder exactly-once *observable delivery record* per channel/idempotency key where feasible; external email delivery is at-least-once with dedup/retries and documented limits. Availability target defined after hosting SLO baseline, not fabricated.
- **Performance targets (to measure, not claims):** under representative development fixtures, p95 authenticated GET API requests <300ms excluding external AI; common desktop navigation feels instant; mobile performance measured with Lighthouse and browser traces. Track DB p95, queue lag and AI latency separately.
- **Accessibility:** WCAG 2.2 AA objective, visible focus, full keyboard paths, 44px comfortable touch targets where feasible, understandable dialogs and status messages.
- **Privacy:** do not send user data to model providers by default; show clear consent and per-provider access. No AI data in public logs.
- **Maintainability:** coherent modules, one API contract source, migrations reviewed, reproducible image, meaningful automated tests.
- **Localization:** English initial; message catalog and timezone/locale formatting separation. Avoid hardcoded locale/date strings.

## Governance and scope boundaries

Site-wide admin can configure signup policy, allowed OAuth providers, global AI connectors, retention, email delivery and job/health views. Team owner/admin can manage only their workspace and its members. Regular users cannot manage instance-level policy. No hidden superuser content read override. Any future support impersonation must use explicit consent, audit and a security review; not part of v1.

## Success definition

A first-time private user can securely sign in, create a workspace, capture tasks/todos, plan day, get reminders and log out. A team owner can invite one teammate and collaborate without seeing either person's personal workspace. AI can answer scoped questions and propose a task update, wait for confirmation and successfully update only the permitted task. Administrator can change settings from the normal app shell without a separate admin login and without gaining invisible access to personal data.
