# Acceptance criteria and definition of done

## Release gates

A feature is **done** only if code + API + persisted state + explicit authorization + accessible UI + tests are present; a screenshot, static mock, green container or agent-generated claim is not sufficient.

## P0 user journeys — mandatory

- **AC-001:** Sign in/out with Google using secured sessions; unauthorized and noninvited users rejected per policy. Session revoked across tabs and API calls.
- **AC-002:** New verified user gets exactly one private personal workspace. They cannot read/edit any other personal content via direct API, global search, export, activity, AI or file endpoint.
- **AC-003:** Team owner invites, member accepts and sees only authorized team data; owner can remove member and access is revoked immediately. Last owner cannot remove self without transfer.
- **AC-004:** User creates task, changes status/priority/date/project, refreshes, and sees persisted values and correct activity record. Cross-workspace references and assignment rejected.
- **AC-005:** Todos can exist without task links; attached todos cannot reference different workspace.
- **AC-006:** Personal My Day is independently selected; simple due-today suggestion doesn't overwrite selection.
- **AC-007:** Reminder at an exact date/time and timezone creates an in-app notification after time; cancellation/snooze and restart/retry work with no duplicate occurrence record.
- **AC-008:** Kanban reorder and status changes persist, keyboard fallback works, tasks' sprint membership is explicit rather than inferred from due dates.
- **AC-009:** Non-admin cannot access system settings page/API even with manual URL. System admin changes controlled setting and sees audit; system admin cannot automatically view private task content.
- **AC-010:** AI read responses cite actual authorized tasks and give no other workspace content; unavailable/disabled provider fails gracefully.
- **AC-011:** AI proposed mutation shows structured diff, requires real approval, rechecks role/version, writes once, records audit, rejects replay and unauthorized ID.
- **AC-012:** Mobile width 320/360/390 and desktop 1280+ are usable with touch, keyboard and screen reader; no critical clipping or inaccessible actions.
- **AC-013:** Production deployment has no exposed DB host port or secret in image/client; service survives restart, migration/rollback plan and backup restore independently verified.

## Security negative test matrix

| Target | Attack/test | Expected |
| --- | --- | --- |
| Task | `GET /.../tasks/<other-workspace-id>` | 403/404, no identifying info |
| List/Search | Use another workspace ID or omit workspace filter | Strict membership filter, no leaks in counts/snippets |
| Mutation | Inject `workspaceId` / `systemAdmin` into PATCH | Reject or ignore disallowed field safely, unchanged DB |
| Invite | Expired, reused or privilege-elevating code | Reject, audit, rate limit |
| Identity | Mismatched OAuth state/subject; email-only merge attempt | Reject, no account hijack |
| Admin | Signed-in member GET/PATCH `/system/*` | 403 and no secrets |
| AI | Inject arbitrary tool name/SQL/secret prompt | Denied, no privileged execution |
| AI | Stale proposal / repeated approval | 409 or idempotent unchanged result |
| Custom provider | SSRF `localhost`, metadata IP, redirects and rebind | Block unless explicitly approved safe local connector |
| Reminder | Two workers lease same due job | One logical notification occurrence |
| Files | Private attachment guessed URL | Deny unauthenticated/cross-workspace |
| UI | Keyboard-only Kanban/confirm, mobile 320px | All critical actions operable |

## Quality check commands (when code exists)

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build` (exact generated scripts may vary); `docker compose config`, service health/readiness, backup restore rehearsal. Use static security scans + manual review. **Record actual results**, failing steps and environment details in implementation status log.

## Suggested performance targets (validate with fixtures)

Authenticated task list/query p95 under ~300ms on baseline fixture and target hardware; UI has no large blocking main-thread work; mobile Lighthouse reports and accessibility audit collected. Targets can change by measured data and resources. AI response latency excluded from core API SLO; monitor separately. No production uptime claim without live telemetry.

## Sign-off checklist

Product feature parity, new personal/team flows, responsive visual review, provider privacy notice, security gate review, migration count reconciliation if used, backup restore proof, rollback proof, user acceptance on staging, actual deployment approval. Status wording: Planned → Designed → Implemented → Tested → Deployed → Verified. Do not automatically skip statuses.
