#!/usr/bin/env bash
# Create or reset the owner (ADMIN) login on a server environment, from the owner's Mac.
#   deploy/owner-login.sh <staging|production>
# Run it in a real Terminal tab: the password is typed at a hidden prompt and only its
# bcrypt hash is stored.
set -euo pipefail
ENV_NAME=${1:?usage: deploy/owner-login.sh <staging|production>}
echo "Creating the owner login for $ENV_NAME…"
exec "$(dirname "$0")/with-db.sh" "$ENV_NAME" npx tsx scripts/create-owner.ts
