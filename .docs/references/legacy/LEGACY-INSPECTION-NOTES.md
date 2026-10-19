# Legacy Personal Tracker — code inspection summary

**Source:** User-supplied `personalTracker.zip` examined 2026-10-18. **Not a source-code distribution.** Raw archive intentionally not bundled.

- PHP/PDO/MySQL app with Google OAuth login/allowlist, a web installer, static JS/CSS and one-user global data model.
- Modules/routes observed: `/dashboard`, `/tasks`, `/todo`, `/reminders`, `/important`, `/myday`, `/agile`, `/pomodoro`, `/profile`; API files include `tasks`, `todo`, `reminders`, `kanban`, `sprints`, `pomodoro`, `comments`, `search`, `profile`.
- Tables: `users`, `tasks`, `todo_lists`, `todo_items`, `todo_comments`, `reminders`, `sprints`, `pomodoro_sessions`.
- Single-user design uses unscoped data tables. Multiple accepted login emails are **not** a secure multi-tenant separation mechanism; app README acknowledges tables lack `user_id`.
- Todo item requires a linked task in legacy; new design intentionally makes this relationship optional.
- Sprint board selects tasks by due dates in sprint window; new sprint-task join model eliminates this implicit coupling.
- Kanban movement updates primary task status; new app uses one canonical workflow category plus columns.
- Pomodoro UI countdown persists in `localStorage` and writes session history; a server-authoritative active session design improves multi-device correctness.
- Existing bootstrap sets session cookie flags/security headers and checks CSRF in API; Google integration and database operations must still be independently reviewed for any upgrade. This summary is not a penetration-test result or claim of a confirmed exploit.
- Installer/config may reference credentials. Do not copy PHP configuration, credentials, `.env`, token material or config files into public repo/new AI context.

**Screenshot `dashboard.png`:** 1699×864 PNG showing legacy desktop layout and navigation. Use for feature parity only, never copy its exact CSS/colors.
