# Security model and release gates

## Assets and trust boundaries

Sensitive assets: private personal/team tasks, comments and attachments; identity sessions; login credentials; AI provider keys; invitation tokens; system settings; notification destinations and historical logs. Trust boundaries: browser↔API; user↔workspace; admin↔private content; backend↔OAuth providers; backend↔LLM endpoint; worker↔delivery provider; host↔Docker services.

## Prioritized threats / mitigations

| Threat | Mitigation | Test |
| --- | --- | --- |
| Cross-workspace IDOR/BOLA | Scope every query and mutation by verified membership and resource ownership; never trust route workspace alone | Request another workspace ID in every entity API, search, export, upload and AI tool |
| Admin overreach | `system_admin` distinct from workspace data access, narrow capability grants, audited changes | Operator cannot list private tasks by default |
| OAuth login CSRF / account takeover | Library-managed `state`/PKCE where applicable, verified callback URI, issuer/audience/subject validation | Replayed/mismatched state, provider subject substitution |
| Identity mis-link | No auto-merge based merely on same email, require authenticated explicit account-link flow | Claimed email from different provider |
| Session theft/fixation | HttpOnly Secure SameSite cookies, session rotation, appropriate TTL, revoke all, CSRF+Origin checks, proxy trust config | Login/logout/expiry/parallel tab tests |
| Unauthorized registration | Invite-only default, admin bootstrap safe and expiring, invitation single-use | Expired and forged invites |
| Injection/XSS | Validated inputs, safe markdown renderer, CSP, escaping, no arbitrary HTML, typed SQL | Stored comment XSS, URL injection |
| CSRF | CSRF token on state-changing cookie-auth endpoints, origin/host allowlist, SameSite as secondary | Cross-origin form and JSON request |
| SQL injection | Parameterized Drizzle queries, no direct AI SQL or user SQL | Common SQLi payloads |
| Provider key exfiltration | Authenticated encryption at rest, separate KEK, write-only key API, logs scrubbed, no export plaintext | Inspect API output/log/export after config |
| AI prompt injection | Retrieved content untrusted, allowlisted tools, policy before retrieval and mutation, approvals | Malicious task text asks to steal keys |
| SSRF from custom AI endpoints | Default denied; secure allowlist, scheme/hostname/IP checks, re-resolve and redirect blocking, disallow metadata/local network without explicit policy | Loopback/link-local/IPv6/rebinding tests |
| Privilege escalations | RBAC per action, no role in normal profile patch, protected last owner | Change own role and remove last owner |
| Notification abuse/data leak | Recipient verified, private content minimal, delivery limits, dedup/leases, safe templates | Cross-user email reminders, forged webhook |
| File upload malware/leaks | MIME sniff, size/type limit, safe generated name, non-executable storage, authorization, virus scan if supported | Upload HTML/SVG/script, path traversal |
| Rate/DoS | IP/user/workspace rate limits, size limits, DB query caps, AI token/tools/time caps | 429 and resource exhaustion simulation |
| Supply-chain/container | Lockfile, audit, SBOM optional, multi-stage pinned image, non-root, private DB and backups | Dependency scan, image inspection |

## Security requirements

- Enforce authorization inside application code, not only NPM/Cloudflare Access or frontend menu visibility.
- All external requests with sensitive headers redacted in telemetry; errors are generic to browser, correlation ID in logs.
- Validate content upload types and store outside web root; ensure markdown links safe schemes. CSP without unnecessary wildcard or unsafe-eval; any intentional exceptions documented.
- Passwordless/social user recovery requires an independently tested path to prevent permanent lockout. Enable 2FA/passkey if library support stable; step-up for dangerous system changes.
- Keep app origin protected against direct-bypass paths when Cloudflare is acting as a security control; remember external OAuth callbacks must still function.
- Secrets never in repo, image, logs, URLs, test fixtures, exported data, client bundles or unreviewed AI context. Bootstrap credentials are one-time and expiring.
- Encrypted credential storage uses authenticated encryption with key versioning, strong entropy, rotation procedure and backup of encryption keys separate from DB backup.
- Backup and restoration may expose all content; operators are trusted infrastructure custodians even if the app UI denies access. Document this distinction, use encrypted backups and controlled access.
- No “superadmin read any content” endpoint, support impersonation or arbitrary script execution in v1.

## Release-blocker checklist

Any reproducible unauthorized cross-workspace read/write, auth bypass, unencrypted provider key, CSRF on settings mutations, unrestricted AI tool execution, unauthenticated admin endpoint, nonfunctional restore, silent reminder loss or known critical/high unmitigated vulnerability blocks production release. Record exceptions only with explicit owner risk sign-off; not via model decision.
