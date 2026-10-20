# Deploying on Ubuntu 24.04 with Dockge and Nginx Proxy Manager

Target layout: Docker Engine + Compose plugin, Dockge managing stacks in `/opt/stacks`, Nginx Proxy Manager (NPM) terminating HTTPS.
Run every command on the server as a user that can use Docker (or with `sudo`).

```text
Internet ──HTTPS──▶ NPM ──http──▶ personal-tracker-web:3000   (network: PROXY_NETWORK)
                                   │
                                   ├── personal-tracker-db      (internal network, no ports)
                                   ├── personal-tracker-worker  (internal + outbound-only egress)
                                   └── personal-tracker-migrate (one-shot, exits 0)
```

## 1. Prerequisites

```bash
docker --version && docker compose version     # Compose v2.20+ recommended
docker ps --format '{{.Names}}' | grep -i -E 'npm|proxy|dockge'
```

- A DNS record (e.g. `tracker.example.com`) pointing to the server. If it is proxied through Cloudflare, read section 6.
- At least 2 GB free RAM during the first image build, about 2 GB disk for images.

## 2. Find the Nginx Proxy Manager network

The web container must share a Docker network with NPM.

```bash
NPM=$(docker ps --format '{{.Names}}' | grep -i -m1 -E 'npm|nginx-proxy-manager')
docker inspect "$NPM" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{$v.IPAddress}}{{"\n"}}{{end}}'
```

- If NPM is already on a network you use for other stacks (often `proxy` or `npm_default`), use that name as `PROXY_NETWORK` in step 4.
- Otherwise create a shared network and attach NPM to it:

  ```bash
  docker network create proxy
  docker network connect proxy "$NPM"
  ```

  To survive an NPM re-deploy, also add the network to NPM's own compose file (`networks: [proxy]` on the service, and `proxy: {external: true}` under `networks:`).

## 3. Get the source into the Dockge stacks directory

```bash
sudo git clone git@github.com:Runtime-Garden/personalTracker.git /opt/stacks/personal-tracker
# or: sudo git clone https://github.com/Runtime-Garden/personalTracker.git /opt/stacks/personal-tracker
cd /opt/stacks/personal-tracker
sudo git checkout v1.0.0-rc.3     # deploy a tag, not a moving branch
```

Dockge detects `compose.yaml` in this directory as the stack **personal-tracker**.

## 4. Create `.env`

```bash
cd /opt/stacks/personal-tracker
sudo cp .env.example .env
sudo chmod 600 .env
echo "DB_PASSWORD=$(openssl rand -hex 24)"
echo "SETUP_TOKEN=$(openssl rand -hex 24)"
echo "APP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Edit `.env` (or use Dockge's `.env` editor) and set at least:

| Variable | Value |
|---|---|
| `APP_URL` | `https://tracker.example.com` — exact public origin, no trailing slash or path |
| `DB_PASSWORD` | generated hex value |
| `SETUP_TOKEN` | generated value (needed once for the first administrator) |
| `APP_ENCRYPTION_KEY` | generated 64-hex value |
| `PROXY_NETWORK` | network from step 2 |
| `TZ` | server-side default timezone, e.g. `Europe/Istanbul` |
| `IMAGE_TAG` | the version you checked out, e.g. `1.0.0-rc.3` |

`NODE_ENV`, `PORT`, `DATABASE_URL` and `COOKIE_SECURE` in `.env.example` are for local development only; Compose sets the production values itself.

**Store `APP_ENCRYPTION_KEY` and `DB_PASSWORD` in your password manager.** Without the encryption key, saved AI API keys and TOTP secrets in a backup cannot be decrypted.

Optional integrations, all disabled when empty:

| Feature | Variables | Provider setting |
|---|---|---|
| Email (verification, password reset, notifications) | `RESEND_API_KEY`, `MAIL_FROM` (verified domain) | — |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Redirect URI `APP_URL/api/auth/google/callback` |
| GitHub sign-in | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Callback URL `APP_URL/api/auth/github/callback` |
| Microsoft Entra sign-in | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (tenant GUID) | Redirect URI `APP_URL/api/auth/microsoft/callback` |

Passkeys need no configuration, but they only work on the exact `APP_URL` hostname over HTTPS.

AI providers are configured by each user in the app (**AI assistant → Connect provider**); keys are encrypted with `APP_ENCRYPTION_KEY`. Operator settings:

| Variable | Default | Purpose |
|---|---|---|
| `AI_ALLOWED_PRIVATE_HOSTS` | empty | Comma-separated hostnames/IPs of self-hosted model gateways on a private network (e.g. `vllm.lan,10.0.0.12`). Custom endpoints are otherwise limited to public HTTPS hosts. |
| `AI_TRIAGE_TIMEOUT_MS` | `8000` | How long a decision model may take to classify a new task before the default priority is used. |

Administrators can disable any provider, including `openai_compatible` / `anthropic_compatible` custom endpoints, in **System control → AI provider policies**.

## 5. Deploy

From Dockge: open the **personal-tracker** stack and press **Deploy**. Or from a shell:

```bash
cd /opt/stacks/personal-tracker
docker compose config --quiet          # validates .env interpolation
docker compose up -d --build
docker compose ps -a
```

Expected: `personal-tracker-db` healthy, `personal-tracker-migrate` **Exited (0)**, `personal-tracker-web` healthy (after about 20 s), `personal-tracker-worker` running.

```bash
docker compose logs personal-tracker-migrate     # "applied 000x_..." on first run, "ok ..." afterwards
docker compose logs --tail=50 personal-tracker-web personal-tracker-worker
```

No host port is published. Do **not** add `ports:` to the database or the web service.

## 6. Nginx Proxy Manager proxy host

**Hosts → Proxy Hosts → Add Proxy Host**

- Domain Names: `tracker.example.com`
- Scheme `http`, Forward Hostname `personal-tracker-web`, Forward Port `3000`
- Enable **Block Common Exploits**. Websockets support is not required.
- SSL tab: request a Let's Encrypt certificate, enable **Force SSL**, **HTTP/2**, and **HSTS**.

The application sends its own CSP, HSTS, `X-Frame-Options` and `X-Accel-Buffering: no` (for AI streaming); no extra NPM config is needed for those.

### Client IP for rate limiting (`TRUST_PROXY`)

Login, setup, registration and password-reset rate limits are tracked per client IP. Behind NPM every request arrives from NPM's address, so without this setting all users share **one** limit bucket.

```bash
docker inspect "$NPM" -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'
docker network inspect "$PROXY_NETWORK" -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

Set `TRUST_PROXY` in `.env` to NPM's IP on that network (most precise; re-check it if NPM is recreated) or to the network subnet (stable, but every container on that network is then trusted to set `X-Forwarded-For`). Then run `docker compose up -d`. Never use `true`.

**Behind Cloudflare (orange cloud):** NPM sees Cloudflare edge IPs, so all users behind one edge still share a bucket. A safe fix requires that the origin accepts traffic only from Cloudflare (firewall 80/443 to the Cloudflare IP ranges, or use a Cloudflare Tunnel). Only then add to the proxy host's **Advanced** tab:

```nginx
proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
```

Without origin lock-down, do not add this line: clients could forge the header.

## 7. First start

1. Open `https://tracker.example.com`. You should see **Welcome, administrator**.
2. Enter the `SETUP_TOKEN`, your name, email and a password with 12+ characters. Setup is permanently locked after the first account exists.
3. In **System control**, keep signup on `invite_only` (default) or switch to `open`. Invite users from there or from a team workspace.
4. In **Preferences**, enable 2FA for the admin account and/or register a passkey.

## 8. Verify the deployment

From any machine with Node.js 22+ and the repository checked out:

```bash
TARGET_URL=https://tracker.example.com node ops/verify-staging.mjs
```

All lines must be `PASS` (health, readiness, CSP/HSTS/frame headers, HTTP→HTTPS redirect). Then go through the manual gates in `ops/V1_RELEASE_GATES.md` that apply to the features you enabled:

- Log in and out on a phone and a desktop browser; create a task, reminder and attachment; confirm the reminder notification arrives (worker).
- Register, use and remove a passkey on at least one phone and one desktop.
- Enable 2FA, sign in with a code and with a recovery code.
- For each enabled OAuth provider: new sign-in via invitation, linking from **Preferences**, unlinking.
- For email: verification mail, password reset, a reminder email.
- For AI: add a connection with your own key, ask a question, stream a reply, approve and reject a proposal.

## 9. Backups (required before real use)

The stack has two persistent volumes, `personal-tracker_personal_tracker_pg` and `personal-tracker_personal_tracker_uploads`. Back up both.

```bash
sudo apt install age rclone
age-keygen -o ~/personal-tracker-backup.key   # keep the PRIVATE key OFF this server
rclone config                                 # create a remote, e.g. "b2:my-bucket/personal-tracker"
sudo tee /opt/stacks/personal-tracker/.backup.env >/dev/null <<'EOF'
AGE_RECIPIENT=age1...your-public-key...
OFFSITE_REMOTE=b2:my-bucket/personal-tracker
BACKUP_DIR=/opt/stacks/personal-tracker/secure-backups
EOF
sudo chmod 600 /opt/stacks/personal-tracker/.backup.env
cd /opt/stacks/personal-tracker && sudo sh -c 'set -a; . ./.backup.env; set +a; sh ops/backup-encrypted.sh'
```

The `rclone config` written by your user must also be readable by root (or run the backup as that user). After a successful manual run, enable the daily timer:

```bash
sudo cp ops/systemd/personal-tracker-backup.* /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now personal-tracker-backup.timer
systemctl list-timers | grep personal-tracker
```

**Restore rehearsal:** on a different machine or a separate Compose project with empty volumes, `age -d -i key.txt archive.tar.age | tar -xf -`, `sha256sum -c checksums.sha256`, `pg_restore --no-owner` into an empty `tracker` database, extract `uploads.tar` into the new uploads volume and `chown -R 1000:1000` it. Then compare row counts and attachment hashes. See `ops/BACKUP_AND_RESTORE.md`. A backup that has never been restored is not a verified backup.

## 10. Updating

```bash
cd /opt/stacks/personal-tracker
sudo sh -c 'set -a; . ./.backup.env; set +a; sh ops/backup-encrypted.sh'   # pre-update backup
sudo git fetch --tags && sudo git checkout vX.Y.Z
# set IMAGE_TAG=X.Y.Z in .env, then:
docker compose up -d --build
docker compose logs personal-tracker-migrate
docker compose ps -a     # web and worker must report (healthy)
```

From 1.0.0-rc.2 to 1.0.0-rc.3: migration `0010` is applied automatically (additive; adds indexes and AI tables). The worker now has a healthcheck; it shows `(healthy)` about a minute after start.

Dockge's **Update** button also works: images use `pull_policy: build`, so they are rebuilt from the checked-out source instead of being pulled.

Migrations are forward-only. To roll back, restore the pre-update backup together with the previous tag. Never edit an applied migration.

## Never do this

- `docker compose down -v` or `docker volume rm` on this stack: it deletes the database and uploads.
- Publish the database port, or expose `3000` directly on the host instead of going through NPM.
- Commit or paste `.env` / `.backup.env`, or keep the age private key on the server.
