#!/bin/sh
set -eu
: "${DB_PASSWORD:?Must set DB_PASSWORD}"
OUT=${1:-./backup}; mkdir -p "$OUT"
# Run against an already deployed stack; never include plaintext credentials in Git.
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" personal-tracker-db pg_dump -U tracker -d tracker --format=custom > "$OUT/tracker-$STAMP.dump"
chmod 600 "$OUT/tracker-$STAMP.dump"
echo "Created $OUT/tracker-$STAMP.dump. Encrypt and ship offsite; rehearse restore in staging."
