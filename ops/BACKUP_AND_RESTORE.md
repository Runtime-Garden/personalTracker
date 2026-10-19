# Personal Tracker · backup and recovery runbook

**Status:** A runbook, not evidence that a backup has ever run successfully.

The application stores user data in two independent persistent systems: PostgreSQL (`personal_tracker_pg`) and private task uploads (`personal_tracker_uploads`). Both are essential for recovery.

## Preparation

- Keep the stack at `/opt/stacks/personal-tracker` and credentials in a non-committed `.env` (permissions 600).
- Confirm `docker compose ps` shows healthy PostgreSQL and a reachable web health check.
- Record immutable image tag/digest, Compose revision and applied SQL migration checksums.
- Choose an encrypted, access-restricted **offsite** storage destination; store the decryption key separately.
- Arrange a maintenance window for an application-consistent backup of both database and uploaded files. A DB dump and file snapshot taken at very different times may refer to missing files.

## Database backup

The operator-only `ops/backup.sh` creates a custom-format `pg_dump` in a chosen local directory. It is plaintext until separately encrypted. Limit shell access and delete plaintext copies securely according to policy (ordinary rm is not guaranteed secure erasure on SSDs).

```bash
cd /opt/stacks/personal-tracker
set -a; . ./.env; set +a
sh ops/backup.sh ./backup
```

Do not print the `DB_PASSWORD` or commit the output. Encrypt the dump and transfer it to an offsite backup repository before treating backup as complete.

## Uploads backup

Use a filesystem-consistent snapshot of the `personal_tracker_uploads` named volume or a temporary maintenance container with **read-only** volume access. The files are keyed UUIDs with content hashes stored in the DB. Record timestamps and checksums.

Example read-only extraction after identifying the actual Compose project-scoped volume name:

```bash
docker volume ls | grep personal_tracker_uploads
# Adapt VOLUME_NAME after verifying the actual name:
# docker run --rm -v VOLUME_NAME:/data:ro -v "$PWD/backup:/output" alpine:3.20 \
#   tar -C /data -cf /output/uploads.tar .
```

Do not execute placeholders as-is, assume a globally named volume, or use `docker compose down -v`.

## Recovery rehearsal in isolated staging

1. Prepare a new staging Compose project, private networks and **empty** volumes. Never restore over live data.
2. Restore a copy of the PostgreSQL dump with `pg_restore` in the staging database.
3. Restore the corresponding private uploads snapshot, then ensure non-root application UID can read and write it.
4. Validate row counts, `schema_migrations`, upload hash/size consistency, and user/workspace authorization.
5. Test login, create/edit tasks, reminders, uploads/downloads, worker and email queue (mock external services).
6. Record recovery time and any failures. Only a successful rehearsal justifies a `backup_verified` claim.

## Rollback

- An older image cannot necessarily run after a newer forward-only migration.
- Rollback requires a **pre-migration database+upload backup**, a matching prior image and a reviewed data-loss window.
- Do not attempt to reverse schema migrations by ad hoc SQL.

## Optional automated encrypted offsite backup (v1 RC)

`ops/backup-encrypted.sh` creates a PostgreSQL `pg_dump` and an upload-volume tar, computes checksums, encrypts them with an **age public recipient**, and transfers the encrypted archive to an **operator-configured rclone remote**. The original volumes are never deleted. A template systemd service and timer live in `ops/systemd/`; **installation is manual and intentionally not attempted here**.

Create `/opt/stacks/personal-tracker/.backup.env` with mode `0600`, accessible only to the systemd service account:

```sh
AGE_RECIPIENT=age1REPLACE_WITH_REAL_PUBLIC_RECIPIENT
OFFSITE_REMOTE=encrypted-backups:personal-tracker
BACKUP_DIR=/opt/stacks/personal-tracker/secure-backups
```

Store the **private age identity** somewhere separate from the VPS, plus its emergency recovery copy. Install `age` and `rclone`, authorize the rclone remote, and run the script manually against a **staging** stack before enabling the timer. Change the timer time only after checking the host timezone and overlap with other maintenance jobs. The script's temporary unencrypted files are removed with `rm`; this is not cryptographic secure erasure on SSDs. No claim of atomicity across DB/upload files; avoid writes or use a storage snapshot/maintenance window for a strict point-in-time restore. Test recovery regularly before relying on this backup method.
