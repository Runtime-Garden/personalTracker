# Identity, sessions, privacy and retention

## Better Auth integration

Use the officially documented Fastify integration and verify exact installed versions before implementation. Manage auth tables/migrations through documented auth adapter integration; avoid duplicated incompatible session table. Social providers: Google first (required), GitHub and Microsoft in later slice. Other OIDC/OAuth providers possible through vetted integration. All OAuth callbacks must validate issuer, state, nonce/PKCE as applicable, exact redirect URI and verified provider subject; rely on library security facilities rather than homegrown validators.

## Signup and account lifecycle

Instance default `signupMode='invite_only'`; first admin established in controlled one-time bootstrap procedure with secure token expiration and no repeat after setup. Non-invited OAuth users cannot auto-register if policy is disabled; existing users retain login. Authenticate → check invitation/policy → provision user + private workspace transactionally. Account-linking requires authenticated user action and provider subject; never combine by email alone. Support provider disconnect with last-login-method lockout prevention.

## Sessions

Secure, HttpOnly SameSite cookies over HTTPS; server-side session invalidation and device/session list. Session IDs rotate at privilege changes/login, full logout revokes session and invalidates cached API data, request rejects revoked users/members immediately. Guard CSRF on mutations; same-origin CORS policy with explicit allowlist and reverse proxy trust hops verified. For recovery consider passkeys or verified email with rate limiting and strong safeguards; password flows only with maintained hashing/recovery implementation.

## Profile and personal preferences

User owns profile, locale, timezone, focus defaults, notification preferences and private AI connector choices. User must not PATCH system permissions, workspace role, audit history or provider linked-subject fields. Account disable/deletion and legal privacy policies require clean retention flows. Separate profile export from team-owned data export.

## Privacy & third-party AI

Before enabling third-party inference, explain which provider/model receives selected task content, whether retention/policy is provider-controlled, and where key stored. Workspace owner can disable AI on team data. Personal workspace data is not shared with team or system operator via app APIs. Default AI history off/short retention until explicit user opt-in. Log metadata instead of full prompt/response; remove PII in errors and traces.

## Retention recommendations (policy to configure)

- Login audit: limited, policy-defined duration, redacted IP where appropriate.
- System/admin audit: longer, tamper-evident append-only events.
- AI run metadata: minimal default, bounded retention; saved chat opt-in separately.
- Notification delivery events: bounded cleanup after verified completion and grace period.
- Soft-deleted content: retention/purge controlled per workspace with ability to restore for a window.
- Exports/imports: short-lived download access and remove temp files automatically.

No promises about GDPR compliance without legal assessment; design for data minimization, transparent retention, export/deletion, lawful provider controls and operation in the applicable jurisdiction.
