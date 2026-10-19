# Docker Compose deployment target — draft, not deployed

## Existing environment compatibility

Runtime Garden hosting convention: Ubuntu Server 24.04 LTS, Docker Engine/Compose, Dockge, NGINX Proxy Manager, Cloudflare, `/opt/stacks/<stack-name>`, shared external `proxy` network for public web containers, private DB networks. This blueprint proposes stack folder `/opt/stacks/personal-tracker` but **does not assert it exists**. The main Runtime Garden CMS, Discord bot, NPM and Dockge are independent workloads; don't reconfigure them during this app build.

## Intended production services

- `tracker-web`: Node/Fastify app serves built React assets and API, exposed only on Docker `proxy` (unique service alias) and private network; no public `ports:` section.
- `tracker-worker`: same build artifact, background jobs only, private network (and controlled outbound email if configured); never publish inbound port.
- `tracker-db`: PostgreSQL on private network only, volume for data, health check, encrypted offsite logical backups. No Docker host port mapping.
- NPM forwards HTTPS requests to web service internal port; configure TLS and trusted proxy headers. API and auth routes same-origin.

## Docker hardening standards

Use multi-stage minimal compatible runtime (Node official slim or distroless if tested; don't blindly use Alpine with incompatible native modules), pinned supported versions/digests, `.dockerignore`, non-root runtime, minimal packages, no build tools in runtime, read-only filesystem when compatible, tmpfs for ephemeral files, only necessary mounts/capabilities, resource limits after measurement, structured logs and healthchecks. No Docker socket mount into app. No hardcoded secrets; inject via external secret files/appropriate environment. Keep credential master encryption key backed up separately and never in image.

## Compose principles

- Unique app-scoped service aliases in `proxy` network; avoid generic `api` name collisions.
- `proxy: external: true`; `tracker-private: internal: true` **only if** egress to DB and other endpoints is compatible; web service may use multiple networks for outbound auth/AI.
- `depends_on` readiness helps startup ordering but does not replace retry logic in app.
- Named volumes only for DB and persistent upload storage; offsite backups must handle both.
- Healthchecks: liveness vs readiness; worker heartbeat/queue lag reported in admin UI (not public).
- Use `docker compose config` **carefully**: it can print secret env values; redact before sharing.
- Never include `docker volume prune`, `docker compose down -v`, or automated cleanup of persistent data in release scripts.

## Deployment verification checklist

1. Verify host inventory, Docker/Compose versions, disk/RAM, shared `proxy` network and name collisions; back up existing stack data.
2. Build pinned image and test locally/staging; run DB migrations on backup-tested data; check rollback compatibility.
3. Create only the new stack in Dockge. Check DB has no public port and only app web is on `proxy`.
4. NPM proxy host, TLS, upstream and app trusted-proxy settings; verify OAuth callback URL matches configured origin precisely.
5. Check Cloudflare Access if protecting internal app, origin bypass restrictions if relying on it; never assume DNS/Access are deployed.
6. Test login, CRUD, AI disabled/provider test, reminders worker, user/team isolation, upload if enabled, log redaction, restore and alerts.
7. Observe load and resource usage; document deployed image digest/commit, migration version, restore point and rollback action.

## Do not auto-deploy

OpenCode has **no authorization** to SSH into VPS, alter NPM/Cloudflare, create DNS, change firewall, attach Dockge network, or delete volumes without explicit user instructions. First deliver staging-ready code and operator docs.
