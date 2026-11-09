#!/usr/bin/env bash
# Build a self-contained release bundle for one environment.
#   deploy/build-bundle.sh <staging|production> <site url> [out.tgz]
# Output: a .tgz with server.js, the traced node_modules (incl. Linux Prisma engines),
# static assets, prisma/ (schema + migrations) and deploy/ (release script).
set -euo pipefail
ENV_NAME=$1; SITE_URL=$2; OUT=${3:-asson-$ENV_NAME.tgz}
export NEXT_OUTPUT=standalone ASSON_ENV=$ENV_NAME NEXT_PUBLIC_SITE_URL=$SITE_URL NEXT_TELEMETRY_DISABLED=1
export ASSON_RELEASE=${ASSON_RELEASE:-$(git rev-parse --short HEAD)}
DIST=.next-bundle
NEXT_DIST_DIR=$DIST npx next build
B=$(mktemp -d)
cp -R "$DIST/standalone/." "$B/"
# standalone keeps the distDir name; server.js reads it from its embedded config
mkdir -p "$B/$DIST" && cp -R "$DIST/static" "$B/$DIST/static"
[ -d public ] && cp -R public "$B/public"
mkdir -p "$B/prisma" && cp -R prisma/schema.prisma prisma/migrations "$B/prisma/"
cp -R deploy "$B/deploy"
echo "$ASSON_RELEASE" > "$B/RELEASE"
# never ship local env files: the server's settings live in /etc/asson/<env>.env
rm -f "$B"/.env "$B"/.env.*
# Prisma engines for both server CPUs must be present
ls "$B"/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node "$B"/node_modules/.prisma/client/libquery_engine-linux-arm64-openssl-3.0.x.so.node >/dev/null
rm -f "$B"/node_modules/.prisma/client/libquery_engine-darwin*.node
tar -czf "$OUT" -C "$B" .
rm -rf "$B"
echo "bundle: $OUT ($(du -h "$OUT" | cut -f1)), release $ASSON_RELEASE"
