#!/bin/bash
# Full backup before a deploy migrates the database. Every host's runtime reload calls it right before its
# migrations; a failed or unreadable backup aborts the deploy, so nothing is migrated without a restorable copy.
#
#   bash veit-framework/scripts/deploy/backup-before-migrate.sh \
#     --name plenivo --database-url "$DATABASE_URL" [--include apps/api/.env ...] [--dir DIR] [--keep N]
#
# Writes DIR/<name>-<timestamp>/ (default DIR /var/backups/veit/<name>, outside the rsynced repo so a
# `rsync --delete` never removes it) with:
#   db.dump      pg_dump custom format of the whole database, checked with pg_restore --list
#   state.tar.gz the --include files (env and config files holding the keys: without them the encrypted
#                values in the dump cannot be read)
#   MANIFEST     commit, time, sizes and sha256 sums
# Keeps the newest N backups (default 10). Restore: see veit-framework/docs/deploy-backup.md.
set -euo pipefail

NAME=""
DATABASE_URL_ARG=""
DIR=""
KEEP=10
INCLUDES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --database-url) DATABASE_URL_ARG="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --keep) KEEP="$2"; shift 2 ;;
    --include) INCLUDES+=("$2"); shift 2 ;;
    *) echo "backup-before-migrate: unbekanntes Argument $1" >&2; exit 2 ;;
  esac
done

[[ "$NAME" =~ ^[a-z0-9-]+$ ]] || { echo "backup-before-migrate: --name fehlt oder ist ungültig" >&2; exit 2; }
[ -n "$DATABASE_URL_ARG" ] || { echo "backup-before-migrate: --database-url fehlt" >&2; exit 2; }
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || { echo "backup-before-migrate: --keep muss >= 1 sein" >&2; exit 2; }
for tool in pg_dump pg_restore tar sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || { echo "backup-before-migrate: $tool fehlt" >&2; exit 1; }
done

DIR="${DIR:-/var/backups/veit/$NAME}"
umask 077
mkdir -p "$DIR"
chmod 700 "$DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$DIR/$NAME-$STAMP"
PARTIAL="$TARGET.partial"
rm -rf "$PARTIAL"
mkdir "$PARTIAL"
trap 'rm -rf "$PARTIAL"' EXIT

log() { echo "[backup:$NAME] $*"; }

log "pg_dump -> $TARGET/db.dump"
pg_dump -Fc --no-owner --dbname="$DATABASE_URL_ARG" -f "$PARTIAL/db.dump"
# Readable dump; a fresh install has no tables yet, so an empty table list is fine.
pg_restore --list "$PARTIAL/db.dump" >/dev/null

PRESENT=()
for f in "${INCLUDES[@]}"; do
  if [ -e "$f" ]; then PRESENT+=("$f"); else log "nicht vorhanden, übersprungen: $f"; fi
done
if [ "${#PRESENT[@]}" -gt 0 ]; then
  log "Dateien -> state.tar.gz (${PRESENT[*]})"
  tar -czf "$PARTIAL/state.tar.gz" -- "${PRESENT[@]}"
  tar -tzf "$PARTIAL/state.tar.gz" >/dev/null
fi

{
  echo "name: $NAME"
  echo "created: $(date -Is)"
  echo "commit: ${DEPLOY_COMMIT:-unknown}"
  echo "host: $(hostname)"
  echo "pg_dump: $(pg_dump --version)"
  (cd "$PARTIAL" && for f in db.dump state.tar.gz; do
    [ -f "$f" ] && echo "$(sha256sum "$f" | cut -d' ' -f1)  $(du -h "$f" | cut -f1)  $f"
  done)
} >"$PARTIAL/MANIFEST"

mv "$PARTIAL" "$TARGET"
trap - EXIT
log "fertig: $TARGET ($(du -sh "$TARGET" | cut -f1))"

# Newest first; only complete backups of this name count.
mapfile -t OLD < <(find "$DIR" -mindepth 1 -maxdepth 1 -type d -name "$NAME-*" ! -name '*.partial' -printf '%f\n' \
  | sort -r | tail -n +"$((KEEP + 1))")
for d in "${OLD[@]}"; do
  rm -rf "${DIR:?}/$d"
  log "altes Backup entfernt: $d"
done
