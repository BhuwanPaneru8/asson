#!/usr/bin/env bash
# Runs ON the server as user `asson`, from inside an unpacked release:
#   /srv/asson/<env>/releases/<id>/deploy/release.sh <env> <id>
#
# Blue/green (once server-setup.sh has put nginx in front; /etc/nginx/asson/<env>.upstream.conf exists):
#   migrate → start the new release in the idle slot → health-check it directly (and that it IS the new
#   build) → point nginx at it (graceful reload) → check through nginx → stop the old slot after draining.
#   A release that fails its checks never receives traffic: the old slot keeps serving, zero downtime.
# Otherwise (older servers): migrate → switch `current` → restart → health check → roll back on failure.
#
# Migrations are not rolled back and run while the old release is still serving, so every migration must
# be backward compatible with the previous release (add columns/tables first, drop in a later release).
set -euo pipefail
ENV_NAME=$1; ID=$2
# paths and timings can be overridden only to test this script (tests/deploy/release.test.sh)
ROOT=${ASSON_ROOT:-/srv/asson}; ETC=${ASSON_ETC:-/etc/asson}; NGINX_DIR=${ASSON_NGINX_DIR:-/etc/nginx/asson}
TRIES=${ASSON_HEALTH_TRIES:-45}; DRAIN=${ASSON_DRAIN_SECONDS:-20}
BASE=$ROOT/$ENV_NAME; REL=$BASE/releases/$ID
set -a; . "$ETC/$ENV_NAME.env"; set +a
WANT=$(cat "$REL/RELEASE" 2>/dev/null || echo "")

echo "==> migrate ($ENV_NAME)"
"$ROOT/tools/node_modules/.bin/prisma" migrate deploy --schema "$REL/prisma/schema.prisma"

switch_link() { ln -sfn "$2" "$1.tmp" && mv -Tf "$1.tmp" "$1"; }
# healthy <port> [release]: answers ok (and runs the expected build, if given) within ~90 s
healthy() {
  for _ in $(seq 1 "$TRIES"); do
    body=$(curl -fs -m 5 "http://127.0.0.1:$1/api/health" || true)
    if echo "$body" | grep -q '"ok":true' && { [ -z "${2:-}" ] || echo "$body" | grep -q "\"release\":\"$2\""; }; then return 0; fi
    sleep 2
  done
  return 1
}
prune() { ls -1dt "$BASE"/releases/*/ | tail -n +5 | xargs -r rm -rf; } # keep the 4 newest for rollback

UPSTREAM=$NGINX_DIR/$ENV_NAME.upstream.conf
if [ -f "$UPSTREAM" ]; then
  ACTIVE=$(cat "$BASE/active-slot" 2>/dev/null || echo "")
  if [ "$ACTIVE" = a ]; then IDLE=b; else IDLE=a; fi
  slot_port() { if [ "$1" = a ]; then echo $((PORT + 100)); else echo $((PORT + 200)); fi; }
  IDLE_PORT=$(slot_port $IDLE)

  echo "==> start $ID in slot $IDLE (port $IDLE_PORT); slot ${ACTIVE:-none} keeps serving"
  switch_link "$BASE/slot-$IDLE" "$REL"
  sudo /usr/bin/systemctl enable "asson-slot@$ENV_NAME-$IDLE" >/dev/null 2>&1 || true
  sudo /usr/bin/systemctl restart "asson-slot@$ENV_NAME-$IDLE"
  if ! healthy "$IDLE_PORT" "$WANT"; then
    echo "!! new release unhealthy in slot $IDLE; it never received traffic. Logs:"
    journalctl -u "asson-slot@$ENV_NAME-$IDLE" -n 40 --no-pager 2>/dev/null || true
    sudo /usr/bin/systemctl stop "asson-slot@$ENV_NAME-$IDLE" || true
    exit 1
  fi

  echo "==> switch nginx to slot $IDLE"
  printf 'upstream asson_%s { server 127.0.0.1:%s; keepalive 16; }\n' "$ENV_NAME" "$IDLE_PORT" > "$UPSTREAM.tmp" && mv -f "$UPSTREAM.tmp" "$UPSTREAM"
  if ! { sudo /usr/sbin/nginx -t 2>/dev/null && sudo /usr/sbin/nginx -s reload; } || ! healthy "$PORT" "$WANT"; then
    echo "!! nginx did not take the new slot; pointing it back at slot ${ACTIVE:-a}"
    [ -n "$ACTIVE" ] && printf 'upstream asson_%s { server 127.0.0.1:%s; keepalive 16; }\n' "$ENV_NAME" "$(slot_port "$ACTIVE")" > "$UPSTREAM" && sudo /usr/sbin/nginx -s reload || true
    sudo /usr/bin/systemctl stop "asson-slot@$ENV_NAME-$IDLE" || true
    exit 1
  fi
  echo "$IDLE" > "$BASE/active-slot.tmp" && mv -f "$BASE/active-slot.tmp" "$BASE/active-slot"
  switch_link "$BASE/current" "$REL"
  echo "==> live on slot $IDLE: $(curl -fsS "http://127.0.0.1:$PORT/api/health")"

  if [ -n "$ACTIVE" ]; then
    sleep "$DRAIN" # requests already on the old slot finish (nginx reload is graceful; SIGTERM waits too)
    sudo /usr/bin/systemctl stop "asson-slot@$ENV_NAME-$ACTIVE" || true
    echo "==> slot $ACTIVE stopped"
  fi
  prune
  exit 0
fi

# ---- single-service servers (before blue/green setup) ----
PREV=$(readlink "$BASE/current" 2>/dev/null || true)
echo "==> switch to $ID"
switch_link "$BASE/current" "$REL"
sudo /usr/bin/systemctl enable asson@$ENV_NAME >/dev/null 2>&1 || true
sudo /usr/bin/systemctl restart asson@$ENV_NAME
if healthy "$PORT"; then
  echo "==> healthy: $(curl -fsS "http://127.0.0.1:$PORT/api/health")"
  prune
  exit 0
fi

echo "!! health check failed; logs:"; journalctl -u asson@$ENV_NAME -n 40 --no-pager 2>/dev/null || true
if [ -n "$PREV" ] && [ -d "$PREV" ]; then
  echo "==> rolling back to $(basename "$PREV")"
  switch_link "$BASE/current" "$PREV"; sudo /usr/bin/systemctl restart asson@$ENV_NAME
  healthy "$PORT" && echo "==> rollback healthy" || echo "!! rollback also unhealthy"
fi
exit 1
