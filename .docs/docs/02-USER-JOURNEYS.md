# Key user journeys and UX narratives

## 1 — First login / private personal setup

Sign in with Google on calm, brand-aligned login screen → verify provider identity and signup policy → optionally accept invite → auto-provision **Personal** workspace → choose locale/timezone/work hours → create first task → see empty-state onboarding. **Never auto-join a team or expose a new user's personal workspace.** If auth provider is unavailable, display helpful bounded error and recovery path.

## 2 — Capture then plan

Press global `+` or `N` on desktop (never hijack typing in inputs) → quick-add with title, kind, project/workspace, priority and optional date → persists to inbox/task list → assign importance or “My Day” → dashboard summary shows actual status. Mobile: one-handed FAB or prominent add button; form uses bottom sheet when appropriate.

## 3 — Work and focus

Open a task → details drawer/page includes activity, assignee, subtasks and attachments → start 25 minute focus session linked to task → pause/complete → timeline and daily minutes update only on server-acknowledged completion. If browser closes, local display recovers from durable session start/end; don't fake completion.

## 4 — Team onboarding

Owner creates **Team** workspace → picks restricted role → sends expiring invite → invited user signs in and explicitly accepts → sees team projects; cannot discover owner's personal projects, other teams or system settings. Invalid/expired/replayed invite receives bounded error.

## 5 — Sprint management

Owner/team manager creates project backlog → sets sprint dates and capacity → assigns **task membership to sprint explicitly** → board columns reflect workflow status → teammate updates task → sprint burndown shows counts and selected metrics. Moving due date does **not** silently change sprint membership.

## 6 — Natural-language request with AI

User opens AI right rail on currently selected workspace and says “Plan my week from unfinished high-priority tasks” → backend executes scoped, read-only tools → returns prioritized proposal referencing source task IDs and uncertainties → user selects “Apply plan” → backend displays structured diff with task/date changes → user confirms → policy re-check + optimistic concurrency check → transaction and audit → outcome with links to modified tasks. LLM never directly writes DB.

## 7 — Admin in normal UI

Instance admin signs in to same application and sees additional **System** section in Settings/sidebar → navigates `/settings/system` to configure registration, AI/provider allowlist, email delivery and health → server independently verifies `system_admin` for each request. User with a copied URL gets 403 and no sensitive metadata. Team admins see only Workspace Settings.

## 8 — Reminder delivery

User schedules 09:00 in chosen IANA timezone → UTC instant computed deterministically, with DST policy visible → worker locks due event → stores notification and attempts configured email/web push → retries transient errors with exponential backoff/dedup → user can mark done, snooze or reschedule; audit preserves original intention.

## 9 — Logout / revoke / export

User visits Security Settings → sees authenticated sessions and linked accounts → signs out this or all sessions → session invalidated server-side and UI caches cleared → export scoped data with step-up auth when needed. Revocation must not rely only on client localStorage.

## Experience failure cases

Always design: empty list, loading skeleton, slow network, transient 500, conflict 409, revoked membership mid-edit, expired login, unsent reminder provider, unavailable AI provider, unsupported tool calling, offline mobile, narrow device and keyboard-only navigation. Provide retry/resume where safe and avoid losing typed user data.
