#!/usr/bin/env bash
# Create or reset the owner (ADMIN) login on a server environment, from the owner's Mac.
#   deploy/owner-login.sh <staging|production> [host]
# Opens a private SSH tunnel to the server's database, runs scripts/create-owner.ts
# (password typed at a hidden prompt, only its bcrypt hash is stored), then closes the tunnel.
# The database URL is read from the server into this shell only; it is never printed.
set -euo pipefail
ENV_NAME=${1:?usage: deploy/owner-login.sh <staging|production> [host]}
HOST=${2:-140.245.230.86}
KEY=~/.ssh/asson_deploy
SOCK=$(mktemp -u /tmp/asson-db-tunnel.XXXXXX)
cd "$(dirname "$0")/.."

ssh -i $KEY -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -f -N -M -S "$SOCK" -L 6543:localhost:5432 ubuntu@"$HOST"
trap 'ssh -S "$SOCK" -O exit ubuntu@"$HOST" 2>/dev/null' EXIT

DATABASE_URL=$(ssh -i $KEY -o IdentitiesOnly=yes ubuntu@"$HOST" "sudo grep ^DATABASE_URL= /etc/asson/$ENV_NAME.env | cut -d= -f2-" | sed 's/@localhost:5432/@localhost:6543/')
export DATABASE_URL
echo "Creating the owner login for $ENV_NAME ($ENV_NAME site)…"
npx tsx scripts/create-owner.ts
