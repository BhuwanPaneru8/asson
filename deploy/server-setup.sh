#!/usr/bin/env bash
# One-time (and safely re-runnable) setup for an Asson server: Ubuntu 24.04, x86_64 or arm64.
# Run as root:  ssh ubuntu@HOST 'sudo bash -s' < deploy/server-setup.sh "<ci public key>"
# Creates: swap, Node 24, PostgreSQL 16 (localhost only), user `asson`, /srv/asson/{staging,production},
# /etc/asson/<env>.env with generated secrets, systemd units, cron jobs, nightly backups, cloudflared.
# Secrets are generated ON the server and never printed.
set -euo pipefail
CI_PUBKEY="${1:-}"
export DEBIAN_FRONTEND=noninteractive
ENVS=(staging production)
declare -A PORT=([staging]=3001 [production]=3000)
declare -A HOST=([staging]=staging-asson.bhuwanpaneru.com [production]=asson.bhuwanpaneru.com)

step() { echo; echo "==> $*"; }

step "Time zone"
timedatectl set-timezone Asia/Kathmandu

step "Swap (2 GB)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
cat > /etc/sysctl.d/90-asson.conf <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
sysctl -q --system

step "Packages and security updates"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl gnupg jq rsync unattended-upgrades fail2ban postgresql postgresql-contrib
dpkg-reconfigure -f noninteractive unattended-upgrades
cat > /etc/apt/apt.conf.d/52asson-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

step "Node.js 24"
if ! node -v 2>/dev/null | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -yq nodejs
fi
node -v

step "cloudflared"
if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -q && apt-get install -yq cloudflared
fi

step "SSH: keys only"
cat > /etc/ssh/sshd_config.d/90-asson.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
systemctl reload ssh || systemctl reload sshd || true
systemctl enable --now fail2ban >/dev/null

step "User asson and folders"
id asson >/dev/null 2>&1 || useradd --create-home --shell /bin/bash asson
usermod -aG systemd-journal asson
install -d -o asson -g asson -m 750 /srv/asson /srv/asson/tools /var/backups/asson
for e in "${ENVS[@]}"; do install -d -o asson -g asson -m 750 /srv/asson/$e /srv/asson/$e/releases /srv/asson/$e/incoming /srv/asson/$e/media; done
install -d -o asson -g asson -m 700 /home/asson/.ssh
touch /home/asson/.ssh/authorized_keys
if [ -n "$CI_PUBKEY" ] && ! grep -qF "$CI_PUBKEY" /home/asson/.ssh/authorized_keys; then echo "$CI_PUBKEY" >> /home/asson/.ssh/authorized_keys; fi
# the owner's Mac key may also deploy/run maintenance as asson
grep -qF "asson-deploy" /home/asson/.ssh/authorized_keys || grep "asson-deploy" /home/ubuntu/.ssh/authorized_keys >> /home/asson/.ssh/authorized_keys || true
chown asson:asson /home/asson/.ssh/authorized_keys && chmod 600 /home/asson/.ssh/authorized_keys

step "PostgreSQL tuning (small server, localhost only)"
PGCONF=$(ls -d /etc/postgresql/*/main | tail -1)
cat > "$PGCONF/conf.d/90-asson.conf" <<'EOF'
listen_addresses = 'localhost'
max_connections = 40
shared_buffers = 128MB
effective_cache_size = 384MB
work_mem = 4MB
maintenance_work_mem = 64MB
wal_compression = on
log_min_duration_statement = 1000
EOF
systemctl restart postgresql

step "Databases and env files"
install -d -o root -g asson -m 750 /etc/asson
for e in "${ENVS[@]}"; do
  f=/etc/asson/$e.env
  if [ ! -f "$f" ]; then
    pw=$(openssl rand -hex 24)
    sudo -u postgres psql -qc "CREATE ROLE asson_$e LOGIN PASSWORD '$pw'"
    sudo -u postgres psql -qc "CREATE DATABASE asson_$e OWNER asson_$e"
    cat > "$f" <<EOF
NODE_ENV=production
HOSTNAME=127.0.0.1
PORT=${PORT[$e]}
NEXT_PUBLIC_SITE_URL=https://${HOST[$e]}
DATABASE_URL=postgresql://asson_$e:$pw@localhost:5432/asson_$e?schema=public
DB_POOL_SIZE=5
AUTH_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
NEXT_TELEMETRY_DISABLED=1
EOF
  fi
  # settings added after the first install (kept idempotent for existing servers)
  grep -q '^MEDIA_DIR=' "$f" || echo "MEDIA_DIR=/srv/asson/$e/media" >> "$f"
  # deep health URL for the uptime monitor: https://<host>/api/health/deep?key=<HEALTH_KEY>
  grep -q '^HEALTH_KEY=' "$f" || echo "HEALTH_KEY=$(openssl rand -hex 24)" >> "$f"
  # owner's mobile number(s) for critical alerts, comma-separated (texted only once an SMS gateway is set up)
  grep -q '^ALERT_PHONES=' "$f" || echo "ALERT_PHONES=" >> "$f"
  chown root:asson "$f" && chmod 640 "$f"
done

step "systemd service asson@<env>"
cat > /etc/systemd/system/asson@.service <<'EOF'
[Unit]
Description=Asson web (%i)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
User=asson
Group=asson
EnvironmentFile=/etc/asson/%i.env
Environment=NODE_OPTIONS=--max-old-space-size=384
WorkingDirectory=/srv/asson/%i/current
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

step "Blue/green slots: two app processes per environment, nginx in front (zero-downtime deploys)"
# A deploy starts the new release in the idle slot, checks it, then nginx switches to it gracefully and the
# old slot stops after in-flight requests finish. A release that fails its health check never gets traffic.
# Slot ports: a = PORT+100, b = PORT+200 (production 3100/3200, staging 3101/3201); nginx keeps PORT.
cat > /usr/local/bin/asson-run <<'EOF'
#!/usr/bin/env bash
# asson-run <env>-<slot>: start one blue/green slot (same env file, its own port and release folder)
set -euo pipefail
e=${1%-*}; s=${1##*-}
set -a; . "/etc/asson/$e.env"; set +a
case $s in a) PORT=$((PORT + 100));; b) PORT=$((PORT + 200));; *) echo "unknown slot $s" >&2; exit 2;; esac
export PORT ASSON_SLOT=$s
cd "/srv/asson/$e/slot-$s"
exec /usr/bin/node server.js
EOF
cat > /usr/local/bin/asson-ctl <<'EOF'
#!/usr/bin/env bash
# asson-ctl <env> start|stop|restart|status|logs: act on whichever slot is live (or the old single service)
set -euo pipefail
e=$1; v=$2
if [ -f "/srv/asson/$e/active-slot" ]; then u="asson-slot@$e-$(cat "/srv/asson/$e/active-slot")"; else u="asson@$e"; fi
if [ "$v" = logs ]; then exec journalctl -u "$u" -n 100 -f; fi
exec systemctl "$v" "$u"
EOF
chmod 755 /usr/local/bin/asson-run /usr/local/bin/asson-ctl
cat > /etc/systemd/system/asson-slot@.service <<'EOF'
[Unit]
Description=Asson web slot %i
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
User=asson
Group=asson
Environment=NODE_OPTIONS=--max-old-space-size=384
ExecStart=/usr/local/bin/asson-run %i
Restart=always
RestartSec=3
# SIGTERM lets in-flight requests finish before the old slot goes away
KillSignal=SIGTERM
TimeoutStopSec=30
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

# the deploy user may run exactly these, nothing else
{
  printf 'asson ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /usr/sbin/nginx -s reload'
  for e in staging production; do
    for v in restart enable is-active; do printf ', /usr/bin/systemctl %s asson@%s' "$v" "$e"; done
    for sl in a b; do for v in start stop restart enable disable is-active; do printf ', /usr/bin/systemctl %s asson-slot@%s-%s' "$v" "$e" "$sl"; done; done
  done
  echo
} > /etc/sudoers.d/asson
chmod 440 /etc/sudoers.d/asson && visudo -cq

DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx >/dev/null
rm -f /etc/nginx/sites-enabled/default
install -d -o asson -g asson -m 755 /etc/nginx/asson
for e in staging production; do
  p=${PORT[$e]}; b=/srv/asson/$e
  # first run: slot a takes over the release that is live now, then the old single service stops
  if [ ! -f "$b/active-slot" ]; then
    if [ -L "$b/current" ]; then
      ln -sfn "$(readlink "$b/current")" "$b/slot-a" && chown -h asson:asson "$b/slot-a"
      systemctl enable --now "asson-slot@$e-a"
      for _ in $(seq 1 45); do curl -fs -m 5 "http://127.0.0.1:$((p + 100))/api/health" | grep -q '"ok":true' && break; sleep 2; done
      systemctl disable --now "asson@$e" 2>/dev/null || true
      echo a > "$b/active-slot" && chown asson:asson "$b/active-slot"
    fi
    printf 'upstream asson_%s { server 127.0.0.1:%s; keepalive 16; }\n' "$e" "$((p + 100))" > "/etc/nginx/asson/$e.upstream.conf"
    chown asson:asson "/etc/nginx/asson/$e.upstream.conf"
  fi
  cat > "/etc/nginx/conf.d/asson-$e.conf" <<EOF
# Asson $e: Cloudflare Tunnel -> nginx (127.0.0.1:$p) -> live slot (see $b/active-slot)
include /etc/nginx/asson/$e.upstream.conf;
server {
  listen 127.0.0.1:$p;
  server_name _;
  client_max_body_size 40m;     # photo uploads carry several resized copies
  location / {
    proxy_pass http://asson_$e;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host \$host;
    proxy_buffering off;        # streamed pages arrive as they render
    proxy_read_timeout 120s;
  }
}
EOF
done
nginx -t && systemctl enable --now nginx >/dev/null 2>&1 && systemctl reload nginx

step "Scheduled jobs and backups"
cat > /usr/local/bin/asson-cron <<'EOF'
#!/usr/bin/env bash
# asson-cron <env> <path>: call a cron route on a running app (skips quietly if that env isn't deployed)
set -euo pipefail
e=$1; p=$2; f=/etc/asson/$e.env
[ -f /srv/asson/$e/active-slot ] || systemctl is-active -q asson@$e || exit 0
port=$(grep '^PORT=' "$f" | cut -d= -f2); secret=$(grep '^CRON_SECRET=' "$f" | cut -d= -f2)
curl -fsS -m 50 -H "Authorization: Bearer $secret" "http://127.0.0.1:$port$p" >/dev/null || logger -t asson-cron "$e $p failed"
EOF
cat > /usr/local/bin/asson-backup <<'EOF'
#!/usr/bin/env bash
# Nightly compressed dumps of every Asson database (and hourly production copies, see below): 14 days kept locally, and each dump is
# copied off the server through a write-only Oracle Object Storage link (BACKUP_UPLOAD_URL in
# /etc/asson/backup.env, root-only). The link can add files but not list, read or delete them.
set -euo pipefail
d=/var/backups/asson; ts=$(date +%Y%m%d-%H%M); host=$(hostname -s)
[ -f /etc/asson/backup.env ] && . /etc/asson/backup.env
failed=0
# `asson-backup hourly`: production only, at most an hour of orders at risk. 24 rotating copies (one per
# hour of the day) locally and off-site, so storage stays bounded; the nightly run below keeps 14 days of
# uniquely named dumps. The app's health check reads .last-hourly-ok and alerts if it gets old.
if [ "${1:-}" = hourly ]; then
  db=asson_production
  sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "$db" || exit 0
  install -d -o asson -g asson -m 750 "$d/hourly"
  f="$d/hourly/$db-$(date +%H).dump"
  sudo -u postgres pg_dump -Fc "$db" > "$f.tmp" && mv "$f.tmp" "$f" && chown asson:asson "$f"
  if [ -n "${BACKUP_UPLOAD_URL:-}" ]; then
    curl -fsS -m 300 --retry 3 -T "$f" "${BACKUP_UPLOAD_URL}$host/$db/hourly/$(basename "$f")" >/dev/null \
      || { logger -p user.err -t asson-backup "HOURLY UPLOAD FAILED $(basename "$f")"; exit 1; }
  fi
  date -Is > "$d/.last-hourly-ok"; chmod 644 "$d/.last-hourly-ok"
  exit 0
fi
for e in staging production; do
  db=asson_$e
  sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "$db" || continue
  f="$d/$db-$ts.dump"
  sudo -u postgres pg_dump -Fc "$db" > "$f"
  if [ -n "${BACKUP_UPLOAD_URL:-}" ]; then
    if curl -fsS -m 300 --retry 3 -T "$f" "${BACKUP_UPLOAD_URL}$host/$db/$db-$ts.dump" >/dev/null; then
      logger -t asson-backup "uploaded $db-$ts.dump"
    else
      logger -p user.err -t asson-backup "UPLOAD FAILED $db-$ts.dump"; failed=1
    fi
  fi
done
# Uploaded product photos: files are content-addressed and never change, so copy each one off-site
# exactly once (a list of already-copied files is kept next to the dumps).
for e in staging production; do
  m=/srv/asson/$e/media; list="$d/.media-offsite-$e"
  [ -d "$m" ] && [ -n "${BACKUP_UPLOAD_URL:-}" ] || continue
  touch "$list"
  n=0
  while IFS= read -r rel; do
    if curl -fsS -m 120 --retry 3 -T "$m/$rel" "${BACKUP_UPLOAD_URL}$host/media/$e/$rel" >/dev/null; then
      echo "$rel" >> "$list"; n=$((n+1))
    else
      logger -p user.err -t asson-backup "MEDIA UPLOAD FAILED $e/$rel"; failed=1; break
    fi
  done < <(comm -23 <(cd "$m" && find . -type f ! -name '*.tmp' | sed 's|^\./||' | sort) <(sort "$list"))
  if [ "$n" -gt 0 ]; then logger -t asson-backup "uploaded $n new $e photos"; fi
done
chown asson:asson "$d"/*.dump 2>/dev/null || true
find "$d" -name '*.dump' -mtime +14 -delete
if [ "$failed" = 0 ] && [ -n "${BACKUP_UPLOAD_URL:-}" ]; then date -Is > "$d/.last-offsite-ok"; chmod 644 "$d/.last-offsite-ok"; fi
exit "$failed"
EOF
chmod 755 /usr/local/bin/asson-cron /usr/local/bin/asson-backup
cat > /etc/cron.d/asson <<'EOF'
SHELL=/bin/bash
# heartbeat for the job queue (SMS, payment expiry, stock audit…); the app also runs it in-process
* * * * * asson /usr/local/bin/asson-cron production /api/cron/jobs
*/2 * * * * asson /usr/local/bin/asson-cron staging /api/cron/jobs
30 2 * * * root /usr/local/bin/asson-backup
15 * * * * root /usr/local/bin/asson-backup hourly
EOF

step "Prisma CLI for migrations"
sudo -u asson -H bash -c 'cd /srv/asson/tools && [ -f package.json ] || npm init -y >/dev/null; npm i --no-audit --no-fund prisma@6.19.3 >/dev/null'

echo; echo "SETUP COMPLETE: $(node -v), $(psql --version | head -1), $(cloudflared --version 2>&1 | head -1)"
free -h | sed -n 1,3p
