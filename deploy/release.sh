#!/usr/bin/env bash
# Runs ON the server as user `asson`, from inside an unpacked release:
#   /srv/asson/<env>/releases/<id>/deploy/release.sh <env> <id>
# migrate → switch `current` → restart → health check → roll back the switch if unhealthy.
# Migrations are not rolled back, so every migration must be backward compatible with the
# previous release (add columns/tables first, drop in a later release).
set -euo pipefail
ENV_NAME=$1; ID=$2
BASE=/srv/asson/$ENV_NAME; REL=$BASE/releases/$ID
set -a; . /etc/asson/$ENV_NAME.env; set +a

echo "==> migrate ($ENV_NAME)"
/srv/asson/tools/node_modules/.bin/prisma migrate deploy --schema "$REL/prisma/schema.prisma"

PREV=$(readlink "$BASE/current" 2>/dev/null || true)
switch_to() { ln -sfn "$1" "$BASE/current.tmp" && mv -Tf "$BASE/current.tmp" "$BASE/current"; }
healthy() {
  for _ in $(seq 1 45); do
    if curl -fs -m 5 "http://127.0.0.1:$PORT/api/health" | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}

echo "==> switch to $ID"
switch_to "$REL"
sudo /usr/bin/systemctl enable asson@$ENV_NAME >/dev/null 2>&1 || true
sudo /usr/bin/systemctl restart asson@$ENV_NAME
if healthy; then
  echo "==> healthy: $(curl -fsS "http://127.0.0.1:$PORT/api/health")"
  # keep the 4 newest releases for instant rollback
  ls -1dt "$BASE"/releases/*/ | tail -n +5 | xargs -r rm -rf
  exit 0
fi

echo "!! health check failed; logs:"; journalctl -u asson@$ENV_NAME -n 40 --no-pager 2>/dev/null || true
if [ -n "$PREV" ] && [ -d "$PREV" ]; then
  echo "==> rolling back to $(basename "$PREV")"
  switch_to "$PREV"; sudo /usr/bin/systemctl restart asson@$ENV_NAME
  healthy && echo "==> rollback healthy" || echo "!! rollback also unhealthy"
fi
exit 1
