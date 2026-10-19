# Personal Tracker — Runtime Garden Edition

**Status:** product specification / implementation blueprint, **not an implemented application**.  
**Prepared:** 2026-10-18 · **Language of product UI:** English (localization-ready) · **Working product name:** Personal Tracker  
**Brand attribution:** *Personal Tracker · by Runtime Garden* — use Runtime Garden Design Kit v2, but do **not** redesign Runtime Garden's primary website or CMS.

Personal Tracker is a self-hostable, AI-assisted productivity and project management application for individuals and small teams. It evolves an existing single-user PHP/MySQL application without retaining its single-user data model or dated UX.

## Start here

1. Read `AGENTS.md`, then `docs/00-START-HERE.md`, `docs/01-PRODUCT-REQUIREMENTS.md`, `docs/architecture/01-SYSTEM-ARCHITECTURE.md`, `docs/security/01-SECURITY-THREAT-MODEL.md`, and `docs/quality/01-ACCEPTANCE-CRITERIA.md`.
2. Open this directory as the **workspace root** in OpenCode. Use `prompts/00-MASTER-OPENCODE-PROMPT.md` as the first message.
3. **Do not ask OpenCode to code the entire product in one step.** Follow `docs/09-PHASED-ROADMAP.md`; each phase must pass its gate before progressing.
4. The source PHP archive was analyzed for the specification. Its **raw application archive is deliberately not included** because installer/config files can contain credentials. If a migration is required, make a **private** copy outside version control and follow `docs/migration/01-LEGACY-MAPPING.md`.
5. `references/brand/` contains the approved v2 visual identity and license-unmodified project assets. `references/legacy/dashboard.png` is a **before** reference, not a design target.

## Documents

| Document | Purpose |
| --- | --- |
| `AGENTS.md` | Durable OpenCode engineering rules |
| `prompts/00-MASTER-OPENCODE-PROMPT.md` | Initial agent instruction, copy/paste |
| `prompts/01-FOUNDATION.md` through `prompts/09-RELEASE.md` | Guided phase instructions |
| `docs/00-START-HERE.md` | Scope, decisions, assumptions |
| `docs/01-PRODUCT-REQUIREMENTS.md` | Functional, nonfunctional product requirements |
| `docs/02-USER-JOURNEYS.md` | Personas and journeys |
| `docs/03-FEATURE-CATALOG.md` | Per-module business rules |
| `docs/04-PERMISSIONS-AND-WORKSPACES.md` | Personal/team access boundaries |
| `docs/05-ADMIN-AND-SETTINGS.md` | Embedded system administration |
| `docs/06-API-CONTRACT.md` | Representative contracts and error model |
| `docs/07-DATA-MODEL.md` | Tables, relations and invariants |
| `docs/08-NOTIFICATIONS-AND-SCHEDULER.md` | Reliable reminders and focus events |
| `docs/09-PHASED-ROADMAP.md` | Iterations and exit gates |
| `docs/architecture/*` | Backend/frontend architecture and ADRs |
| `docs/ai/*` | Providers, AI capabilities, tool security, evaluation |
| `docs/design/*` | Brand-aware visual system, UX, responsive flows |
| `docs/security/*` | Threat model, auth and privacy requirements |
| `docs/migration/*` | PHP feature mapping, safe data transfer |
| `docs/quality/*` | Test matrix, quality and acceptance targets |
| `docs/operations/*` | Docker, deployment, observability, backup/rollback |
| `references/` | Sanitized legacy audit, screenshot and brand kit |
| `decisions/` | Architecture decision log and open questions |

## Design decisions

- **Recommended:** Node.js LTS + TypeScript, Fastify API, React/Vite SPA, PostgreSQL, Drizzle ORM, Better Auth, AI SDK, Docker Compose.
- **Deployment:** small modular monolith. Web/API and optional background worker from the same codebase and image, PostgreSQL container on private network. No Redis, Kubernetes, microservices or separate AI server initially.
- **Security:** invite-only private-by-default instance; per-workspace authorization; AI actions use the **same** authorization rules as manual operations. No AI autonomous system-administration privileges.
- **Auth:** Google first; GitHub and Microsoft later; provider configuration explicit, account-linking secure, no automatic identity merging on equal email alone.
- **AI:** native supported adapters plus configurable vetted OpenAI-compatible endpoints. “All providers” means extensibility and well-defined capability testing, not a claim of universal out-of-the-box compatibility.
- **Personal data:** an individual's private workspace must not be exposed to team members or system administrators by default.

## Explicit exclusions

Not a generic social network, billing SaaS, Kubernetes platform, Runtime Garden CMS rewrite, public agent orchestration platform, or unrestricted autonomous operator. Native mobile apps, video conferencing, marketplace integrations and multi-tenant SaaS billing are future candidates, not MVP blockers.

## Supporting docs and source status

Evidence was inspected from `personalTracker.zip` (84 ZIP entries), the supplied dashboard screenshot, Runtime Garden Design Kit v2 and the master/infrastructure references as of 2026-10-18. No code from this blueprint has been built, tested or deployed. Do not interpret this package as a working app.
