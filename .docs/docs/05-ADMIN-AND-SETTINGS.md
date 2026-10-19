# Integrated settings and administration (not a separate app)

## UX rule

All users visit **Settings** in the same shell. Personal Settings is universally available. Workspace Settings appears to team owner/admin. **System** settings appears in the sidebar/settings nav **only if** current user has `system_admin`. Route `/settings/system` and subsections are within the **same app**, theme, navigation and login flow. Hiding controls is only UX; APIs return 403 without system authorization.

## Information architecture

| Path | Audience | Functions |
| --- | --- | --- |
| `/settings/profile` | Everyone | Avatar, display name, locale, timezone, work hours |
| `/settings/appearance` | Everyone | Theme, density, dashboard layout, reduced motion |
| `/settings/security` | Everyone | Sessions, linked identities, 2FA/passkey if supported, export |
| `/settings/notifications` | Everyone | In-app/email choices, quiet hours, digest |
| `/settings/ai` | Everyone | AI opt-in, personal keys, model preference, history policy |
| `/w/:id/settings` | Owner/admin | Workspace branding, team policy, archive/transfer |
| `/w/:id/members` | Owner/admin | Invitations, roles, revoke, ownership transfer |
| `/settings/system` | System admin | Health/status and high-level control cards |
| `/settings/system/general` | System admin | App name, URL, locale defaults, registration policy |
| `/settings/system/auth` | System admin | Enabled OAuth providers, signup approval, session policy |
| `/settings/system/ai` | System admin | Allowed providers/models, usage budgets, approved endpoint hosts |
| `/settings/system/notifications` | System admin | Email transport settings, delivery health, templates |
| `/settings/system/security` | System admin | Retention, audit, rate limits, authorized sessions overview |
| `/settings/system/jobs` | System admin | Job queue health, failed jobs, safe retry (not raw SQL) |
| `/settings/system/backups` | System admin | Backup state summaries and operator checklists, no one-click destructive restore |

## Admin functions, security and safe UX

- Health screen displays app/version, DB connectivity, worker heartbeat, recent failure counts, queue age, backup last success if monitored, and current system status. Redact secrets and PII.
- Global settings stored as validated strongly typed schema, with change history, actor, timestamp and restart-required indicator.
- Provider secrets set/update/remove via write-only masked controls, encrypted at rest; never returned in API payloads, export or logs.
- Signup defaults disabled; switching to public requires deliberate confirmation and abuse protections.
- Disabling the last working auth method must warn or be blocked until tested fallback access works.
- Show safe confirmation screens for dangerous settings (user disable, data retention shortening). Use step-up authentication and distinct audit records.
- System admin can suspend a user or revoke sessions, not secretly open their private dashboard. Support/data-access workflow excluded from MVP.
- Per-workspace administrators see only workspace usage and no system-level provider secrets.

## Server-only system admin tests

Role mismatch yields 403 on data and mutation APIs; anonymized request returns 401; no system flags leak in unauthenticated navigation bootstrap. Worker, cron, AI, config export, metrics endpoints need own distinct capabilities. Check privilege changes propagate immediately and no mass assignment of `system_admin` from profile API.
