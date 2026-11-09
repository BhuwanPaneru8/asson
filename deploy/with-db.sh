#!/usr/bin/env bash
# Run a command on the owner's Mac against a server environment's database.
#   deploy/with-db.sh <staging|production> <command...>
#   e.g. deploy/with-db.sh production npx tsx prisma/bootstrap.ts
# Opens a private SSH tunnel to the server's PostgreSQL (localhost only there), exports
# DATABASE_URL for the command (read from /etc/asson/<env>.env, never printed), then closes it.
# HOST defaults to the current server; override with ASSON_HOST=...
set -euo pipefail
ENV_NAME=${1:?usage: deploy/with-db.sh <staging|production> <command...>}; shift
[ $# -gt 0 ] || { echo "usage: deploy/with-db.sh <staging|production> <command...>"; exit 2; }
case "$ENV_NAME" in staging|production) ;; *) echo "unknown environment: $ENV_NAME"; exit 2;; esac
HOST=${ASSON_HOST:-140.245.230.86}
KEY=~/.ssh/asson_deploy
PORT=${ASSON_TUNNEL_PORT:-6543}
SOCK=$(mktemp -u /tmp/asson-db-tunnel.XXXXXX)
cd "$(dirname "$0")/.."

ssh -i $KEY -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -f -N -M -S "$SOCK" -L "$PORT:localhost:5432" ubuntu@"$HOST"
trap 'ssh -S "$SOCK" -O exit ubuntu@"$HOST" 2>/dev/null' EXIT

DATABASE_URL=$(ssh -i $KEY -o IdentitiesOnly=yes ubuntu@"$HOST" "sudo grep ^DATABASE_URL= /etc/asson/$ENV_NAME.env | cut -d= -f2-" | sed "s/@localhost:5432/@localhost:$PORT/")
export DATABASE_URL
"$@"
