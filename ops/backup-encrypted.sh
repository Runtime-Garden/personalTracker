#!/bin/sh
# Opt-in operator script. No deletion of Docker volumes. Offsite upload is mandatory.
set -eu
: "${AGE_RECIPIENT:?AGE_RECIPIENT must be an age public recipient}"
: "${OFFSITE_REMOTE:?OFFSITE_REMOTE must be a configured rclone remote:directory}"
command -v age >/dev/null || { echo 'age must be installed on the host' >&2; exit 1; }
command -v rclone >/dev/null || { echo 'rclone must be configured on the host' >&2; exit 1; }
command -v docker >/dev/null || exit 1
case "$AGE_RECIPIENT" in age1*) ;; *) echo 'Invalid age public recipient' >&2; exit 1;; esac
umask 077
DEST=${BACKUP_DIR:-./secure-backups}; mkdir -p "$DEST"
# Staging directory lives next to the archives, not in /tmp: under systemd PrivateTmp the Docker daemon
# would resolve a /tmp path in the host namespace and the uploads snapshot would land elsewhere.
TEMP=$(mktemp -d "$DEST/.staging.XXXXXX")
trap 'rm -rf "$TEMP"' EXIT
trap 'exit 130' HUP INT TERM
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
WEB=$(docker compose ps -q personal-tracker-web)
[ -n "$WEB" ] || { echo 'Web container is not running' >&2; exit 1; }
VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$WEB")
[ -n "$VOLUME" ] || { echo 'Uploads named volume not found' >&2; exit 1; }
# A transaction-consistent PostgreSQL custom format dump; uploads are snapshotted separately.
docker compose exec -T personal-tracker-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TEMP/db.dump"
[ -s "$TEMP/db.dump" ] || { echo 'Database dump is empty' >&2; exit 1; }
# Read-only mount; the archive is streamed to stdout so no host path has to be shared with the daemon.
docker run --rm --network none -v "$VOLUME:/uploads:ro" alpine:3.20 tar -C /uploads -cf - . > "$TEMP/uploads.tar"
(cd "$TEMP" && sha256sum db.dump uploads.tar > checksums.sha256)
printf 'snapshot_utc=%s\ncompose_project=%s\n' "$STAMP" "${COMPOSE_PROJECT_NAME:-personal-tracker}" > "$TEMP/metadata.txt"
FILE="$DEST/personal-tracker-$STAMP.tar.age"
# No pipes: POSIX sh has no pipefail, so a failing tar must not be hidden behind a successful age.
tar -C "$TEMP" -cf "$TEMP/bundle.tar" db.dump uploads.tar checksums.sha256 metadata.txt
age -r "$AGE_RECIPIENT" -o "$FILE.partial" "$TEMP/bundle.tar"
mv "$FILE.partial" "$FILE"
chmod 600 "$FILE"
# Do not label an archive as "offsite" until the remote command exits successfully.
rclone copyto "$FILE" "${OFFSITE_REMOTE%/}/$(basename "$FILE")"
printf 'Encrypted backup copied offsite: %s\n' "$(basename "$FILE")"
