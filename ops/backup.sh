#!/bin/sh
# Plain (unencrypted) local snapshot of the database and uploads. Prefer ops/backup-encrypted.sh for anything
# that leaves this host. Run from the stack directory; never include plaintext credentials in Git.
set -eu
umask 077
OUT=${1:-./backup}; mkdir -p "$OUT"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
WEB=$(docker compose ps -q personal-tracker-web)
[ -n "$WEB" ] || { echo 'Web container is not running' >&2; exit 1; }
VOLUME=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$WEB")
[ -n "$VOLUME" ] || { echo 'Uploads named volume not found' >&2; exit 1; }
# Write to temporary names and rename only on success, so a failed run never leaves a file that looks complete.
docker compose exec -T personal-tracker-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$OUT/tracker-$STAMP.dump.partial"
[ -s "$OUT/tracker-$STAMP.dump.partial" ] || { rm -f "$OUT/tracker-$STAMP.dump.partial"; echo 'Database dump is empty' >&2; exit 1; }
docker run --rm --network none -v "$VOLUME:/uploads:ro" alpine:3.20 tar -C /uploads -cf - . > "$OUT/uploads-$STAMP.tar.partial"
mv "$OUT/tracker-$STAMP.dump.partial" "$OUT/tracker-$STAMP.dump"
mv "$OUT/uploads-$STAMP.tar.partial" "$OUT/uploads-$STAMP.tar"
(cd "$OUT" && sha256sum "tracker-$STAMP.dump" "uploads-$STAMP.tar" > "checksums-$STAMP.sha256")
echo "Created $OUT/tracker-$STAMP.dump and $OUT/uploads-$STAMP.tar. Encrypt and ship offsite; rehearse restore in staging."
