# Planned environment variables and secret policy

This is a **documentation template**, not a `.env` to copy to production. The implementing agent should produce a working `.env.example` with chosen package-specific variable names and validation rules.

| Variable concept | Example/description | Secret? |
| --- | --- | --- |
| `NODE_ENV` | `production` | No |
| `APP_BASE_URL` | `https://<approved-domain>` | No |
| `APP_TRUST_PROXY` | Exact trusted proxy hop / IP policy | No, security-sensitive |
| `PORT` | Internal app port | No |
| `DATABASE_URL` | PostgreSQL connection URI | **Yes** |
| `AUTH_SECRET` | Cryptographically random auth secret | **Yes** |
| `GOOGLE_CLIENT_ID` | OAuth client ID | Limited |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | **Yes** |
| `GITHUB_CLIENT_ID/SECRET` | Optional secondary OAuth | Mixed |
| `MICROSOFT_CLIENT_ID/SECRET` | Optional OIDC | Mixed |
| `AI_ENCRYPTION_KEY` | External key encryption key (key-ID/version aware) | **Critical secret** |
| `AI_ALLOWED_PROVIDER_HOSTS` | Explicit permitted egress hosts | Security-sensitive |
| `SMTP_HOST/USER/PASSWORD` | Optional notification channel | Mixed |
| `STORAGE_ROOT` | Private upload volume path | No |
| `JOB_POLL_INTERVAL_MS` | Capped worker cadence | No |
| `LOG_LEVEL` | `info` prod | No |

Use typed startup validation: missing critical secrets fail closed with safe error, no auto-generated volatile encryption keys that cause unreadable data on restart. Never include real passwords/tokens/secret values in `.env.example`, docs, compose, screenshots or git history. Cross-check deployment-specific callback paths with installed Better Auth integration and reverse proxy.
