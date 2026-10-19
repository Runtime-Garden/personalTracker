# Decision log

| Date | Decision | Status | Reason |
| --- | --- | --- | --- |
| 2026-10-18 | Personal Tracker · by Runtime Garden working identity | Proposed | Reuse approved identity; don't imply primary website rewrite |
| 2026-10-18 | Node.js/TypeScript + Fastify API; React/Vite UI | Proposed | Maintainable unified application stack |
| 2026-10-18 | PostgreSQL + Drizzle | Proposed | Multi-user relations, transactional worker/migration |
| 2026-10-18 | Better Auth with provider plugins | Proposed | Avoid custom auth; verify installed-version compatibility |
| 2026-10-18 | Invite-only private-first signup | Proposed | Safe initial default |
| 2026-10-18 | Integrated system settings; admins not automatically content-readers | Proposed | UX and least privilege |
| 2026-10-18 | Multi-provider AI + strict allowlisted tools | Proposed | Portability and trusted backend control |
| 2026-10-18 | No autonomous destructive AI actions | Proposed | Safe user approval |

## Questions worth owner confirmation (do not block Phase 0)

1. Preferred product URL/subdomain and visibility (internal-only vs internet users)? **Do not assume deployed.**
2. Exact desired login policy: Google-only for first account plus passkey recovery, or also email/password? Default secure account recovery required.
3. Would you want invitations to anyone you invite, or fixed allowlist? Default invite-only.
4. Should teams see personal tasks ever? Default no; explicit copy/share only.
5. AI credential strategy: central admin API keys, personal BYOK, workspace-owned keys, or combination? Default allow policy-controlled BYOK, centrally configured only when permitted.
6. Should email reminders be enabled on day one? Default in-app first, email opt-in when SMTP configured.
7. Do you want legacy data imported into private personal workspace? Default yes, only after dry run and reconciliation.
8. Public-source code license? No license assumed until decided.

## Future change format

`YYYY-MM-DD · ADR-ID · accepted/rejected/superseded · decision · alternatives · security/trade-off · migration/testing impact`
