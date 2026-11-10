#!/usr/bin/env bash
# Exercises deploy/release.sh (blue/green) end to end on this machine, with stand-ins for systemctl, nginx,
# sudo and the app (tests/deploy/fake.py). While each deploy runs, a probe hits the "site" every 50 ms and
# counts failed requests: zero-downtime means zero.   bash tests/deploy/release.test.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$HERE/../.." && pwd)
T=$(mktemp -d); trap 'pkill -f "fake.py .* $T" 2>/dev/null || true; rm -rf "$T"' EXIT
E=staging; PORT=$((40000 + RANDOM % 2000))
mkdir -p "$T/bin" "$T/etc" "$T/nginx" "$T/root/$E/releases" "$T/root/tools/node_modules/.bin" "$T/run"
echo "PORT=$PORT" > "$T/etc/$E.env"
printf '#!/bin/sh\nexit 0\n' > "$T/root/tools/node_modules/.bin/prisma"
printf '#!/bin/sh\nexit 0\n' > "$T/bin/journalctl"

# systemctl <verb> asson-slot@<env>-<slot>: run/stop a fake app on the slot's port
cat > "$T/bin/systemctl" <<EOF
#!/usr/bin/env bash
v=\$1; u=\$2; s=\${u##*-}; pidf="$T/run/\$s.pid"
port=\$(( $PORT + \$([ "\$s" = a ] && echo 100 || echo 200) ))
stop() { [ -f "\$pidf" ] && kill \$(cat "\$pidf") 2>/dev/null; rm -f "\$pidf"; sleep 0.2; }
case \$v in
  enable|disable) ;;
  stop) stop ;;
  start|restart) stop; python3 "$HERE/fake.py" app \$port "$T/root/$E/slot-\$s" "$T" >/dev/null 2>&1 & echo \$! > "\$pidf" ;;
esac
EOF
# nginx -t / -s reload: the fake front re-reads the upstream file on every request, so reload = make sure it runs
cat > "$T/bin/nginx" <<EOF
#!/usr/bin/env bash
[ "\$1" = -t ] && { [ -f "$T/nginx-broken" ] && exit 1 || exit 0; }
[ -f "$T/run/front.pid" ] && kill -0 \$(cat "$T/run/front.pid") 2>/dev/null && exit 0
python3 "$HERE/fake.py" front $PORT "$T/nginx/$E.upstream.conf" "$T" >/dev/null 2>&1 & echo \$! > "$T/run/front.pid"; sleep 0.3
EOF
cat > "$T/bin/sudo" <<EOF
#!/usr/bin/env bash
c=\$1; shift
case \$c in /usr/bin/systemctl) exec "$T/bin/systemctl" "\$@";; /usr/sbin/nginx) exec "$T/bin/nginx" "\$@";; *) exec "\$c" "\$@";; esac
EOF
# the server runs GNU mv (-T); on macOS the same "don't follow the symlinked target" flag is -h
if ! mv --version >/dev/null 2>&1; then printf '#!/bin/sh\nargs=""; for a in "$@"; do [ "$a" = -Tf ] && a=-fh; [ "$a" = -T ] && a=-h; args="$args \"$a\""; done; eval exec /bin/mv $args\n' > "$T/bin/mv"; fi
chmod +x "$T/bin/"* "$T/root/tools/node_modules/.bin/prisma"
export PATH="$T/bin:$PATH" ASSON_ROOT="$T/root" ASSON_ETC="$T/etc" ASSON_NGINX_DIR="$T/nginx" ASSON_HEALTH_TRIES=15 ASSON_DRAIN_SECONDS=1

release() { # release <id> [broken]
  d="$T/root/$E/releases/$1"; mkdir -p "$d/deploy"; echo "$1" > "$d/RELEASE"; [ "${2:-}" = broken ] && touch "$d/BROKEN"
  cp "$REPO/deploy/release.sh" "$d/deploy/"
  bash "$d/deploy/release.sh" "$E" "$1"
}
live() { curl -fs -m 2 "http://127.0.0.1:$PORT/api/health" | sed -E 's/.*"release": ?"([^"]+)".*/\1/'; }
probe() { : > "$T/fails"; while [ -f "$T/probing" ]; do curl -fs -m 2 "http://127.0.0.1:$PORT/api/health" >/dev/null || echo x >> "$T/fails"; sleep 0.05; done; }
fail() { echo "FAIL: $*"; exit 1; }

# setup.sh's first run: nginx in front, upstream pointing at slot a (nothing deployed yet)
printf 'upstream asson_%s { server 127.0.0.1:%s; keepalive 16; }\n' $E $((PORT + 100)) > "$T/nginx/$E.upstream.conf"
"$T/bin/nginx" -s reload

echo "-- 1. first release goes live in slot a"
release r1 > "$T/log1" || { cat "$T/log1"; fail "first release"; }
[ "$(live)" = r1 ] || fail "r1 not live"; [ "$(cat "$T/root/$E/active-slot")" = a ] || fail "slot a not active"

echo "-- 2. upgrade with shoppers browsing: no failed requests"
touch "$T/probing"; probe & P=$!
release r2 > "$T/log2" || { cat "$T/log2"; fail "second release"; }
sleep 0.5; rm "$T/probing"; wait $P
[ "$(live)" = r2 ] || fail "r2 not live"; [ "$(cat "$T/root/$E/active-slot")" = b ] || fail "slot b not active"
[ ! -s "$T/fails" ] || fail "$(wc -l < "$T/fails") failed requests during the switch"
[ ! -f "$T/run/a.pid" ] || fail "old slot a still running"

echo "-- 3. a broken build never gets traffic"
touch "$T/probing"; probe & P=$!
if release r3 broken > "$T/log3"; then fail "broken release reported success"; fi
rm "$T/probing"; wait $P
[ "$(live)" = r2 ] || fail "r2 should still be live"; [ "$(cat "$T/root/$E/active-slot")" = b ] || fail "active slot changed"
[ ! -s "$T/fails" ] || fail "$(wc -l < "$T/fails") failed requests while a broken build was rejected"
grep -q "never received traffic" "$T/log3" || fail "no explanation in the log"

echo "-- 4. if nginx rejects the switch, the old slot keeps serving"
touch "$T/nginx-broken"
if release r4 > "$T/log4"; then fail "release with broken nginx reported success"; fi
rm "$T/nginx-broken"
[ "$(live)" = r2 ] || fail "r2 should still be live after nginx refused"

echo "-- 5. and the next good release goes out normally"
release r5 > "$T/log5" || { cat "$T/log5"; fail "release after failures"; }
[ "$(live)" = r5 ] || fail "r5 not live"; [ "$(cat "$T/root/$E/active-slot")" = a ] || fail "slot a not active"
[ "$(basename "$(readlink "$T/root/$E/current")")" = r5 ] || fail "current not updated"

echo "ALL PASSED: zero failed requests across upgrades; bad builds and a refused switch never took the site down"
