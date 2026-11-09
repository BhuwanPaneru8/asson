#!/usr/bin/env bash
# Connect the server to Cloudflare with a named tunnel (no open web ports). Run as root AFTER
# `cloudflared tunnel login` has been authorized (it writes /root/.cloudflared/cert.pem).
# Re-runnable: creates the tunnel once, (re)routes DNS, rewrites config, restarts the service.
set -euo pipefail
NAME=asson
declare -A HOSTS=([asson.bhuwanpaneru.com]=3000 [staging-asson.bhuwanpaneru.com]=3001)

test -f /root/.cloudflared/cert.pem || { echo "Run: cloudflared tunnel login (and authorize) first"; exit 1; }
cloudflared tunnel list -o json | jq -e ".[] | select(.name==\"$NAME\")" >/dev/null || cloudflared tunnel create "$NAME"
ID=$(cloudflared tunnel list -o json | jq -r ".[] | select(.name==\"$NAME\") | .id")
install -d -m 750 /etc/cloudflared
cp "/root/.cloudflared/$ID.json" /etc/cloudflared/"$ID".json
{
  echo "tunnel: $ID"
  echo "credentials-file: /etc/cloudflared/$ID.json"
  echo "ingress:"
  for h in "${!HOSTS[@]}"; do
    echo "  - hostname: $h"
    echo "    service: http://127.0.0.1:${HOSTS[$h]}"
  done
  echo "  - service: http_status:404"
} > /etc/cloudflared/config.yml
for h in "${!HOSTS[@]}"; do cloudflared tunnel route dns --overwrite-dns "$NAME" "$h"; done
cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate
if [ ! -f /etc/systemd/system/cloudflared.service ]; then cloudflared --config /etc/cloudflared/config.yml service install; fi
systemctl restart cloudflared && systemctl enable cloudflared >/dev/null
sleep 3; systemctl is-active cloudflared && echo "TUNNEL READY: $ID"
