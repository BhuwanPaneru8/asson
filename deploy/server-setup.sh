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
for e in "${ENVS[@]}"; do install -d -o asson -g asson -m 750 /srv/asson/$e /srv/asson/$e/releases /srv/asson/$e/incoming; done
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
cat > /etc/sudoers.d/asson <<'EOF'
asson ALL=(root) NOPASSWD: /usr/bin/systemctl restart asson@staging, /usr/bin/systemctl restart asson@production, /usr/bin/systemctl enable asson@staging, /usr/bin/systemctl enable asson@production, /usr/bin/systemctl is-active asson@staging, /usr/bin/systemctl is-active asson@production
EOF
chmod 440 /etc/sudoers.d/asson && visudo -cq

step "Scheduled jobs and backups"
cat > /usr/local/bin/asson-cron <<'EOF'
#!/usr/bin/env bash
# asson-cron <env> <path>: call a cron route on a running app (skips quietly if that env isn't deployed)
set -euo pipefail
e=$1; p=$2; f=/etc/asson/$e.env
systemctl is-active -q asson@$e || exit 0
port=$(grep '^PORT=' "$f" | cut -d= -f2); secret=$(grep '^CRON_SECRET=' "$f" | cut -d= -f2)
curl -fsS -m 50 -H "Authorization: Bearer $secret" "http://127.0.0.1:$port$p" >/dev/null || logger -t asson-cron "$e $p failed"
EOF
cat > /usr/local/bin/asson-backup <<'EOF'
#!/usr/bin/env bash
# Nightly compressed dumps of every Asson database; keeps 14 days locally.
set -euo pipefail
d=/var/backups/asson; ts=$(date +%Y%m%d-%H%M)
for e in staging production; do
  db=asson_$e
  sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "$db" || continue
  sudo -u postgres pg_dump -Fc "$db" > "$d/$db-$ts.dump"
done
chown asson:asson "$d"/*.dump 2>/dev/null || true
find "$d" -name '*.dump' -mtime +14 -delete
EOF
chmod 755 /usr/local/bin/asson-cron /usr/local/bin/asson-backup
cat > /etc/cron.d/asson <<'EOF'
SHELL=/bin/bash
*/2 * * * * asson /usr/local/bin/asson-cron production /api/cron/notifications
*/10 * * * * asson /usr/local/bin/asson-cron production /api/cron/payments
*/5 * * * * asson /usr/local/bin/asson-cron staging /api/cron/notifications
*/10 * * * * asson /usr/local/bin/asson-cron staging /api/cron/payments
30 2 * * * root /usr/local/bin/asson-backup
EOF

step "Prisma CLI for migrations"
sudo -u asson -H bash -c 'cd /srv/asson/tools && [ -f package.json ] || npm init -y >/dev/null; npm i --no-audit --no-fund prisma@6.19.3 >/dev/null'

echo; echo "SETUP COMPLETE: $(node -v), $(psql --version | head -1), $(cloudflared --version 2>&1 | head -1)"
free -h | sed -n 1,3p
